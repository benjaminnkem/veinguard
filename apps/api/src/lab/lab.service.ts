import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { compareScenarios } from '@repo/agent';
import type { ApiEnv } from '@repo/config';
import { QUEUE_NAMES } from '@repo/config';
import { MODEL_NAMES, newId } from '@repo/persistence';
import type { Queue } from 'bullmq';
import { readFileSync } from 'node:fs';
import type { Model } from 'mongoose';
import { API_ENV } from '../config/env.module';
import { JobsService } from '../jobs/jobs.service';
import {
  aoiPath,
  operationsSnapshotPath,
} from '../operations/operations.paths';
import type { OperationsSnapshot } from '../operations/operations.types';
import { AgentService } from '../agent/agent.service';
import {
  ACTUATION_NOTICE,
  DEMO_ORG_ID,
  EPANET_ORIGIN,
  HEAT_UNCHANGED_NOTICE,
} from './lab.constants';
import { validateInterventions } from './lab.interventions';

export interface SimulationJobPayload {
  scenarioId: string;
}

interface ScenarioDoc {
  _id: string;
  organizationId: string;
  name: string;
  baselineRunId: string;
  parentId: string | null;
  status: string;
  interventions: Record<string, unknown>[];
  horizonStart: string;
  sampleTimeSeconds: number;
  networkId: string;
  airTemperatureC: number;
  sourceTemperatureC: number;
  result: Record<string, unknown> | null;
  appliedToTwin: boolean;
  appliedAt: Date | null;
  correlationId: string;
  jobId: string | null;
  agentRunId: string | null;
  error: { code: string | null; message: string | null };
  createdAt: Date;
  updatedAt: Date;
}

interface LabStateDoc {
  _id: string;
  organizationId: string;
  appliedScenarioId: string | null;
  updatedAt: Date;
}

@Injectable()
export class LabService {
  private snapshotCache: OperationsSnapshot | null = null;

  constructor(
    @Inject(API_ENV) private readonly env: ApiEnv,
    @InjectQueue(QUEUE_NAMES.simulation)
    private readonly queue: Queue<SimulationJobPayload>,
    @InjectModel(MODEL_NAMES.Scenario)
    private readonly scenarios: Model<ScenarioDoc>,
    @InjectModel(MODEL_NAMES.LabState)
    private readonly labState: Model<LabStateDoc>,
    private readonly jobs: JobsService,
    private readonly agent: AgentService,
  ) {}

  context() {
    const snapshot = this.snapshot();
    const aoi = JSON.parse(readFileSync(aoiPath(), 'utf8')) as {
      eligibility?: string;
    };
    return {
      baselineRunId: snapshot.snapshotId,
      network: {
        id: snapshot.networkId,
        name: snapshot.name,
        sourceType: snapshot.sourceType,
        sha256: snapshot.sha256,
        geoReferenceType: snapshot.geoReferenceType,
      },
      sampleTimeSeconds: snapshot.sampleTimeSeconds,
      observationTime: snapshot.observationTime,
      horizonStart: EPANET_ORIGIN,
      operationalTargetMgL: snapshot.operationalTargetMgL,
      cards: {
        projectedTargetBreachAssetCount: snapshot.nodes.filter(
          (node) => node.projectedTargetBreach,
        ).length,
        minimumModeledResidualMgL: minDefined(
          snapshot.nodes.map((node) => node.residualMgL ?? null),
        ),
        minimumSamplePressureM: minDefined(
          snapshot.nodes.map((node) => node.pressureM ?? null),
        ),
      },
      catalog: this.catalog(snapshot),
      notices: {
        actuation: ACTUATION_NOTICE,
        heat: HEAT_UNCHANGED_NOTICE,
        time: 'Intervention times are relative to the EPANET scenario origin (t=0). Selected sample is 1 h.',
      },
      groqConfigured: this.env.GROQ_API_KEY.length > 0,
      disclosure:
        aoi.eligibility ??
        'EPA Net3 is an EPA_BENCHMARK network with SYNTHETIC_GEOREFERENCING. Apply is digital-twin only.',
    };
  }

  async list() {
    const rows = await this.scenarios
      .find({ organizationId: DEMO_ORG_ID })
      .sort({ createdAt: 1 })
      .lean();
    const state = await this.appliedState();
    return {
      baseline: {
        id: this.snapshot().snapshotId,
        name: 'Baseline',
        status: 'SUCCEEDED',
        feasible: true,
      },
      scenarios: rows.map((row) =>
        presentScenario(row, state.appliedScenarioId),
      ),
      appliedScenarioId: state.appliedScenarioId,
      notices: {
        actuation: ACTUATION_NOTICE,
        heat: HEAT_UNCHANGED_NOTICE,
      },
    };
  }

  async get(id: string) {
    const row = await this.scenarios
      .findOne({ _id: id, organizationId: DEMO_ORG_ID })
      .lean();
    if (!row) {
      return null;
    }
    const state = await this.appliedState();
    return presentScenario(row, state.appliedScenarioId);
  }

  async create(
    input: {
      name: string;
      interventions: unknown;
      baselineRunId?: string;
      horizonStart?: string;
      sampleTimeSeconds?: number;
    },
    correlationId: string,
  ) {
    const parsed = validateInterventions(input.interventions);
    if (!parsed.ok) {
      throw Object.assign(new Error(parsed.message), {
        code: 'SCENARIO_INVALID_INTERVENTION' as const,
      });
    }
    const snapshot = this.snapshot();
    const now = new Date();
    const created = await this.scenarios.create({
      _id: newId(),
      organizationId: DEMO_ORG_ID,
      name: input.name,
      baselineRunId: input.baselineRunId ?? snapshot.snapshotId,
      parentId: null,
      status: 'PENDING',
      interventions: parsed.interventions,
      horizonStart: input.horizonStart ?? EPANET_ORIGIN,
      sampleTimeSeconds: input.sampleTimeSeconds ?? snapshot.sampleTimeSeconds,
      networkId: snapshot.networkId,
      airTemperatureC: snapshot.meanAssociatedAirTemperatureC ?? 20,
      sourceTemperatureC: 15,
      result: null,
      appliedToTwin: false,
      appliedAt: null,
      correlationId,
      jobId: null,
      agentRunId: null,
      error: { code: null, message: null },
      createdAt: now,
      updatedAt: now,
    });
    return presentScenario(created, null);
  }

  async run(id: string, correlationId: string) {
    const row = await this.scenarios.findOne({
      _id: id,
      organizationId: DEMO_ORG_ID,
    });
    if (!row) {
      return null;
    }
    const job = await this.jobs.create({
      organizationId: DEMO_ORG_ID,
      type: 'simulation.scenario',
      resourceType: 'scenario',
      resourceId: row._id,
      correlationId,
      status: 'QUEUED',
    });
    row.status = 'QUEUED';
    row.jobId = job.id;
    row.correlationId = correlationId;
    row.updatedAt = new Date();
    row.error = { code: null, message: null };
    await row.save();
    await this.queue.add(
      'run',
      { scenarioId: row._id },
      {
        jobId: `scenario-${row._id}-${Date.now()}`,
        attempts: 2,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 50,
        removeOnFail: 50,
      },
    );
    return presentScenario(row, null);
  }

  async compare(ids: string[]) {
    const rows = await this.scenarios
      .find({
        _id: { $in: ids },
        organizationId: DEMO_ORG_ID,
        status: 'SUCCEEDED',
      })
      .lean();
    const results = rows
      .map((row) => toCompareInput(row))
      .filter((row): row is NonNullable<typeof row> => row != null);
    const ranked = compareScenarios(results);
    return {
      ...ranked,
      heatUnchanged: true,
      heatNotice: HEAT_UNCHANGED_NOTICE,
      actuationNotice: ACTUATION_NOTICE,
    };
  }

  async apply(id: string) {
    const row = await this.scenarios.findOne({
      _id: id,
      organizationId: DEMO_ORG_ID,
    });
    if (!row) {
      return null;
    }
    if (row.status !== 'SUCCEEDED' || !row.result) {
      throw Object.assign(
        new Error(
          'Only a completed scenario simulation can be applied to the digital twin.',
        ),
        { code: 'VALIDATION_FAILED' as const },
      );
    }
    await this.scenarios.updateMany(
      { organizationId: DEMO_ORG_ID, appliedToTwin: true },
      { $set: { appliedToTwin: false, appliedAt: null } },
    );
    row.appliedToTwin = true;
    row.appliedAt = new Date();
    row.updatedAt = row.appliedAt;
    await row.save();
    await this.labState.findOneAndUpdate(
      { organizationId: DEMO_ORG_ID },
      {
        $set: {
          organizationId: DEMO_ORG_ID,
          appliedScenarioId: row._id,
          updatedAt: new Date(),
        },
        $setOnInsert: { _id: DEMO_ORG_ID },
      },
      { upsert: true },
    );
    return {
      appliedScenarioId: row._id,
      notice: ACTUATION_NOTICE,
      heatNotice: HEAT_UNCHANGED_NOTICE,
      scenario: presentScenario(row, row._id),
    };
  }

  async applied() {
    const state = await this.appliedState();
    if (!state.appliedScenarioId) {
      return {
        appliedScenarioId: null,
        afterAvailable: false,
        heatUnchanged: true,
        heatNotice: HEAT_UNCHANGED_NOTICE,
        scenario: null,
      };
    }
    const row = await this.scenarios
      .findOne({
        _id: state.appliedScenarioId,
        organizationId: DEMO_ORG_ID,
      })
      .lean();
    return {
      appliedScenarioId: state.appliedScenarioId,
      afterAvailable: Boolean(row?.result),
      heatUnchanged: true,
      heatNotice: HEAT_UNCHANGED_NOTICE,
      scenario: row ? presentScenario(row, state.appliedScenarioId) : null,
    };
  }

  async startAgent(
    input: {
      goal: string;
      structuredConstraints?: unknown;
    },
    correlationId: string,
  ) {
    const snapshot = this.snapshot();
    return this.agent.create({
      organizationId: DEMO_ORG_ID,
      baselineRunId: snapshot.snapshotId,
      goal: input.goal,
      structuredConstraints: input.structuredConstraints,
      baselineSummary: snapshot as unknown as Record<string, unknown>,
      correlationId,
    });
  }

  private catalog(snapshot: OperationsSnapshot) {
    return {
      pumps: snapshot.links
        .filter((link) => link.type === 'PUMP')
        .map((link) => ({ id: link.id, sourceId: link.sourceId })),
      tanks: snapshot.nodes
        .filter((node) => node.type === 'TANK')
        .map((node) => ({ id: node.id, sourceId: node.sourceId })),
      reservoirs: snapshot.nodes
        .filter((node) => node.type === 'RESERVOIR')
        .map((node) => ({ id: node.id, sourceId: node.sourceId })),
      junctions: snapshot.nodes
        .filter((node) => node.type === 'JUNCTION')
        .map((node) => ({ id: node.id, sourceId: node.sourceId })),
      valves: snapshot.links
        .filter((link) => link.type === 'VALVE')
        .map((link) => ({ id: link.id, sourceId: link.sourceId })),
      types: [
        {
          id: 'CHANGE_PUMP_SCHEDULE',
          label: 'Change pump schedule',
          enabled: true,
        },
        {
          id: 'CHANGE_PUMP_SETTING',
          label: 'Change pump setting',
          enabled: true,
        },
        {
          id: 'CHANGE_TANK_CONTROL',
          label: 'Change tank control',
          enabled: true,
        },
        {
          id: 'CHANGE_VALVE_SETTING',
          label: 'Change valve setting',
          enabled: snapshot.links.some((link) => link.type === 'VALVE'),
          notice: snapshot.links.some((link) => link.type === 'VALVE')
            ? null
            : 'EPA Net3 has no valves.',
        },
        { id: 'FLUSH_EVENT', label: 'Flush event', enabled: true },
        {
          id: 'CHANGE_BOOSTER_PROFILE',
          label: 'Change booster profile',
          enabled: true,
          notice: 'CONCENTRATION mode only. MASS is not implemented in V1.',
        },
      ],
    };
  }

  private snapshot(): OperationsSnapshot {
    if (!this.snapshotCache) {
      this.snapshotCache = JSON.parse(
        readFileSync(operationsSnapshotPath(), 'utf8'),
      ) as OperationsSnapshot;
    }
    return this.snapshotCache;
  }

  private async appliedState(): Promise<{ appliedScenarioId: string | null }> {
    const doc = await this.labState
      .findOne({ organizationId: DEMO_ORG_ID })
      .lean();
    return { appliedScenarioId: doc?.appliedScenarioId ?? null };
  }
}

export function presentScenario(
  row: ScenarioDoc | (ScenarioDoc & { _id: string }),
  appliedScenarioId: string | null,
) {
  const result = row.result;
  const constraints = Array.isArray(result?.constraints)
    ? (result?.constraints as Array<Record<string, unknown>>)
    : [];
  const hardFails = constraints.filter(
    (item) => item.severity === 'HARD' && item.passed === false,
  );
  return {
    id: row._id,
    name: row.name,
    status: row.status,
    baselineRunId: row.baselineRunId,
    interventions: row.interventions,
    horizonStart: row.horizonStart,
    sampleTimeSeconds: row.sampleTimeSeconds,
    feasible: result?.feasible === true,
    objective: typeof result?.objective === 'number' ? result.objective : null,
    metrics: (result?.metrics as Record<string, unknown> | undefined) ?? null,
    hydraulics:
      (result?.hydraulics as Record<string, unknown> | undefined) ?? null,
    constraints,
    hardConstraintViolations: hardFails.map((item) => ({
      id: typeof item.id === 'string' ? item.id : '',
      message:
        typeof item.message === 'string'
          ? item.message
          : 'Hard constraint failed.',
      assetIds: Array.isArray(item.assetIds) ? item.assetIds : [],
      observed: item.observed ?? null,
      limit: item.limit ?? null,
      units: item.units ?? null,
    })),
    networkState:
      (result?.networkState as Record<string, unknown> | undefined) ?? null,
    appliedToTwin: row.appliedToTwin || row._id === appliedScenarioId,
    jobId: row.jobId,
    agentRunId: row.agentRunId,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toCompareInput(row: ScenarioDoc) {
  const result = row.result;
  if (!result) {
    return null;
  }
  const constraints = Array.isArray(result.constraints)
    ? (result.constraints as Array<Record<string, unknown>>)
    : [];
  return {
    scenarioRunId: row._id,
    feasible: result.feasible === true,
    objective: typeof result.objective === 'number' ? result.objective : null,
    constraints: constraints.map((item) => ({
      id: typeof item.id === 'string' ? item.id : '',
      severity: typeof item.severity === 'string' ? item.severity : undefined,
      passed: item.passed === true,
    })),
    metrics: result.metrics as
      | {
          flushWaterLiters?: number;
          chemicalIncrementMg?: number;
          energyDeltaKwh?: number | null;
          switchingComplexity?: number;
          targetBreachCount?: number;
          residualDeficitIntegral?: number;
        }
      | undefined,
  };
}

function minDefined(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value != null);
  return present.length ? Math.min(...present) : null;
}
