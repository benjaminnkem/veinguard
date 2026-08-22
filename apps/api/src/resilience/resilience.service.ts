import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QUEUE_NAMES } from '@repo/config';
import { HISTORICAL_START } from '@repo/fortyguard';
import { MODEL_NAMES, newId } from '@repo/persistence';
import type { Queue } from 'bullmq';
import { readFileSync } from 'node:fs';
import type { Model } from 'mongoose';
import { JobsService } from '../jobs/jobs.service';
import {
  aoiPath,
  operationsSnapshotPath,
} from '../operations/operations.paths';
import type { OperationsSnapshot } from '../operations/operations.types';
import { aggregateStudy, type StudyEvent } from './resilience.aggregate';
import { CAPTURED_EVENT_HOUR, isCapturedHour } from './resilience.captured';

export const DEMO_ORG_ID = 'veinguard-demo';
export const MAX_EVENTS = 8;

export interface ResilienceJobPayload {
  studyId: string;
  eventIndex: number;
}

interface StudyDoc {
  _id: string;
  organizationId: string;
  name: string;
  eventHours: string[];
  analytics: string[];
  runChemistry: boolean;
  status: string;
  events: Array<Record<string, unknown>>;
  aggregation: Record<string, unknown> | null;
  notices: Record<string, unknown>;
  correlationId: string;
  error: { code: string | null; message: string | null };
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ResilienceService {
  constructor(
    @InjectQueue(QUEUE_NAMES.resilience)
    private readonly queue: Queue<ResilienceJobPayload>,
    @InjectModel(MODEL_NAMES.ResilienceStudy)
    private readonly studies: Model<StudyDoc>,
    private readonly jobs: JobsService,
  ) {}

  context() {
    const aoi = JSON.parse(readFileSync(aoiPath(), 'utf8')) as {
      eligibility?: string;
      polygon?: unknown;
    };
    return {
      networkId: 'epa-net3',
      aoiProfileId: 'demo-aoi-v1',
      historicalStart: HISTORICAL_START,
      maxEvents: MAX_EVENTS,
      capturedEvent: {
        hour: CAPTURED_EVENT_HOUR,
        fixtureId: 'heatmap-2024-07-15T14-demo-aoi-v1',
        label: 'Captured FortyGuard HISTORICAL hour (15 Jul 2024 14:00)',
      },
      analytics: [
        { id: 'TCM', enabled: true },
        {
          id: 'PERSISTENCE',
          enabled: true,
          notice:
            'Associated only when a succeeded event actually returns persistence.',
        },
        {
          id: 'EXCEEDANCE',
          enabled: true,
          notice:
            'Associated only when a succeeded event actually returns exceedance.',
        },
      ],
      notices: {
        sample:
          'Sample size is the count of succeeded events. Failed/missing events are first-class and are not filled in.',
        causation:
          'Recurrence is a count of appearances. It is not a probability and not a causal claim.',
        captured:
          'The 15 Jul 2024 14:00 hour reuses a captured real FortyGuard Completed response (CACHED_REAL). Other hours require a live or cached-real provider response.',
      },
      disclosure:
        aoi.eligibility ??
        'EPA Net3 is an EPA_BENCHMARK network with SYNTHETIC_GEOREFERENCING.',
    };
  }

  async list() {
    const rows = await this.studies
      .find({ organizationId: DEMO_ORG_ID })
      .sort({ createdAt: -1 })
      .lean();
    return rows.map((row) => presentStudy(row));
  }

  async get(id: string) {
    const row = await this.studies
      .findOne({ _id: id, organizationId: DEMO_ORG_ID })
      .lean();
    if (!row) {
      return null;
    }
    const presented = presentStudy(row);
    return {
      ...presented,
      recurrenceGeoJson: recurrencePoints(presented.aggregation),
    };
  }

  async create(
    input: {
      name: string;
      eventHours: string[];
      analytics?: string[];
      runChemistry?: boolean;
    },
    correlationId: string,
  ) {
    const hours = normalizeHours(input.eventHours);
    const analytics = normalizeAnalytics(input.analytics);
    const now = new Date();
    const events = hours.map((hour) => ({
      hour,
      status: 'QUEUED',
      freshness: isCapturedHour(hour) ? 'CACHED_REAL' : null,
      cached: isCapturedHour(hour),
      fixtureId: isCapturedHour(hour)
        ? 'heatmap-2024-07-15T14-demo-aoi-v1'
        : null,
      highHeatAssetIds: [],
      targetBreachAssetIds: [],
      chemistryStatus: null,
      persistenceAvailable: false,
      exceedanceAvailable: false,
      persistenceAssetIds: [],
      exceedanceAssetIds: [],
      error: { code: null, message: null },
    }));
    const created = await this.studies.create({
      _id: newId(),
      organizationId: DEMO_ORG_ID,
      name: input.name,
      eventHours: hours,
      analytics,
      runChemistry: input.runChemistry !== false,
      status: 'QUEUED',
      events,
      aggregation: aggregateStudy(events as unknown as StudyEvent[]),
      notices: {
        sample:
          'Sample size is the count of succeeded events. Failed/missing events are first-class and are not filled in.',
        causation:
          'Recurrence is a count of appearances. It is not a probability and not a causal claim.',
      },
      correlationId,
      error: { code: null, message: null },
      createdAt: now,
      updatedAt: now,
    });
    for (let index = 0; index < hours.length; index += 1) {
      await this.jobs.create({
        organizationId: DEMO_ORG_ID,
        type: 'resilience.event',
        resourceType: 'resilienceStudy',
        resourceId: `${created._id}:${index}`,
        correlationId,
        status: 'QUEUED',
      });
      await this.queue.add(
        'event',
        { studyId: created._id, eventIndex: index },
        {
          jobId: `resilience-${created._id}-${index}-${Date.now()}`,
          attempts: 2,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      );
    }
    return presentStudy(created);
  }
}

export function presentStudy(row: StudyDoc | (StudyDoc & { _id: string })) {
  const events = (row.events ?? []) as unknown as StudyEvent[];
  return {
    id: row._id,
    name: row.name,
    status: row.status,
    eventHours: row.eventHours,
    analytics: row.analytics,
    runChemistry: row.runChemistry,
    events,
    aggregation: {
      ...aggregateStudy(events),
      ...(row.aggregation ?? {}),
      ...aggregateStudy(events),
    },
    notices: row.notices,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function normalizeHours(raw: string[]): string[] {
  const hours: string[] = [];
  for (const value of raw) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw Object.assign(new Error(`Invalid event hour '${value}'.`), {
        code: 'VALIDATION_FAILED' as const,
      });
    }
    if (date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0) {
      throw Object.assign(
        new Error('Event hours must fall on a whole UTC hour.'),
        { code: 'VALIDATION_FAILED' as const },
      );
    }
    const earliest = new Date(`${HISTORICAL_START}T00:00:00.000Z`);
    if (date < earliest || date > new Date()) {
      throw Object.assign(
        new Error(
          `Event hour must be HISTORICAL, from ${HISTORICAL_START} through the current time.`,
        ),
        { code: 'THERMAL_REQUEST_INVALID' as const },
      );
    }
    const iso = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
      ),
    ).toISOString();
    if (!hours.includes(iso)) {
      hours.push(iso);
    }
  }
  if (hours.length > MAX_EVENTS) {
    throw Object.assign(
      new Error(`At most ${MAX_EVENTS} events are allowed in a study.`),
      { code: 'VALIDATION_FAILED' as const },
    );
  }
  return hours;
}

function normalizeAnalytics(raw: string[] | undefined): string[] {
  const allowed = new Set(['TCM', 'PERSISTENCE', 'EXCEEDANCE']);
  const selected = raw?.length ? raw : ['TCM'];
  const unique = [...new Set(selected.map((item) => item.toUpperCase()))];
  for (const item of unique) {
    if (!allowed.has(item)) {
      throw Object.assign(new Error(`Unknown analytic '${item}'.`), {
        code: 'VALIDATION_FAILED' as const,
      });
    }
  }
  if (!unique.includes('TCM')) {
    unique.unshift('TCM');
  }
  return unique;
}

function recurrencePoints(aggregation: ReturnType<typeof aggregateStudy>) {
  const snapshot = JSON.parse(
    readFileSync(operationsSnapshotPath(), 'utf8'),
  ) as OperationsSnapshot;
  const byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const features = aggregation.recurringTargetBreachAssets.flatMap((row) => {
    const node = byId.get(row.id);
    if (!node || node.longitude == null || node.latitude == null) {
      return [];
    }
    return [
      {
        type: 'Feature' as const,
        id: row.id,
        properties: {
          id: row.id,
          count: row.count,
          sampleSize: row.sampleSize,
          recurring: row.recurring,
          kind: 'target-breach',
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [node.longitude, node.latitude],
        },
      },
    ];
  });
  return { type: 'FeatureCollection' as const, features };
}
