import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { HttpSimulationClient } from "@repo/agent";
import { QUEUE_NAMES, type WorkerEnv } from "@repo/config";
import {
  FortyGuardClient,
  FortyGuardError,
  MongoThermalStore,
  NYC_BLOCK,
  newAcquisitionId,
  planFortyGuardRequests,
  runAcquisitionSlice,
  type CachedCompleted,
} from "@repo/fortyguard";
import { UnrecoverableError, type Job } from "bullmq";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { MongoClient } from "mongodb";
import { WORKER_ENV } from "../config/env.module";

interface ResilienceJobPayload {
  studyId: string;
  eventIndex: number;
}

interface StudyEvent {
  hour: string;
  status: string;
  freshness: string | null;
  cached: boolean;
  fixtureId: string | null;
  meanAirTemperatureC?: number | null;
  statsMeanC?: number | null;
  highHeatAssetIds: string[];
  targetBreachAssetIds: string[];
  chemistryStatus: string | null;
  persistenceAvailable: boolean;
  exceedanceAvailable: boolean;
  persistenceAssetIds: string[];
  exceedanceAssetIds: string[];
  activityId?: string | null;
  requestHash?: string | null;
  error: { code: string | null; message: string | null } | null;
}

const HIGH_HEAT_C = 15;

@Processor(QUEUE_NAMES.resilience)
export class ResilienceProcessor extends WorkerHost {
  private readonly logger = new Logger(ResilienceProcessor.name);
  private readonly mongo: MongoClient;
  private store: MongoThermalStore | undefined;

  constructor(@Inject(WORKER_ENV) private readonly env: WorkerEnv) {
    super();
    this.mongo = new MongoClient(env.MONGODB_URI);
  }

  async onModuleInit(): Promise<void> {
    await this.mongo.connect();
    this.store = new MongoThermalStore(this.mongo, this.env.MONGODB_DB_NAME);
    await this.store.ensureIndexes();
  }

  async onModuleDestroy(): Promise<void> {
    await this.mongo.close();
  }

  async process(job: Job<ResilienceJobPayload>): Promise<void> {
    const studies = this.mongo.db(this.env.MONGODB_DB_NAME).collection<{
      _id: string;
      analytics: string[];
      runChemistry: boolean;
      events: StudyEvent[];
    }>("resilienceStudies");
    const study = await studies.findOne({ _id: job.data.studyId });
    if (!study) {
      this.logger.warn(`Study ${job.data.studyId} was not found.`);
      return;
    }
    const event = study.events[job.data.eventIndex];
    if (!event) {
      return;
    }
    event.status = "RUNNING";
    await studies.updateOne(
      { _id: study._id },
      { $set: { status: "RUNNING", events: study.events, updatedAt: new Date() } },
    );
    try {
      if (event.fixtureId) {
        applyCaptured(event);
      } else {
        const snapshot = await this.acquireLive(event);
        if (study.runChemistry && event.status !== "FAILED" && snapshot) {
          await this.replayChemistry(event, snapshot);
        } else if (!study.runChemistry) {
          event.chemistryStatus = "SKIPPED";
        }
      }
      if (event.status !== "FAILED") {
        event.status = "SUCCEEDED";
      }
    } catch (error) {
      const code =
        error instanceof FortyGuardError ? error.errorCode : "INTERNAL_DEPENDENCY_UNAVAILABLE";
      event.status = "FAILED";
      event.error = {
        code,
        message: error instanceof Error ? error.message : "Resilience event failed.",
      };
      if (error instanceof FortyGuardError && error.kind === "UNAVAILABLE") {
        await persistStudy(this.mongo, this.env.MONGODB_DB_NAME, study._id, study.events);
        throw new UnrecoverableError(error.message);
      }
    }
    await persistStudy(this.mongo, this.env.MONGODB_DB_NAME, study._id, study.events);
  }

  private async acquireLive(event: StudyEvent): Promise<CachedCompleted | null> {
    if (!this.env.FORTYGUARD_API_KEY) {
      event.status = "FAILED";
      event.error = {
        code: "THERMAL_PROVIDER_UNAVAILABLE",
        message: "FortyGuard is not configured. This hour was not filled with synthetic heat.",
      };
      return null;
    }
    const store = this.store;
    if (!store) {
      throw new Error("Thermal store is not ready.");
    }
    const hour = new Date(event.hour);
    const start = hour.toISOString().replace(/\.\d{3}Z$/, "+00:00");
    const end = new Date(hour.getTime() + 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, "+00:00");
    const product = {
      mode: "HISTORICAL" as const,
      aoi: NYC_BLOCK,
      time: { start, end },
      granularityMeters: 100 as const,
      analytics: ["TCM"] as Array<"TCM">,
    };
    const plan = planFortyGuardRequests(product);
    const slice = plan.slices[0];
    if (!slice) {
      throw new FortyGuardError("REQUEST_INVALID", "Planner produced no heatmap slice.");
    }
    event.requestHash = slice.requestHash;
    const cached = await store.getCache(slice.requestHash);
    if (cached) {
      event.cached = true;
      event.freshness = "CACHED_REAL";
      event.activityId = cached.activityId;
      event.statsMeanC = cached.stats.mean ?? null;
      event.meanAirTemperatureC = cached.stats.mean ?? null;
      return cached;
    }
    const client = new FortyGuardClient({
      baseUrl: this.env.FORTYGUARD_API_BASE_URL,
      apiKey: this.env.FORTYGUARD_API_KEY,
      timeoutMs: this.env.FORTYGUARD_HTTP_TIMEOUT_MS,
    });
    const acquisition = await store.createAcquisition({
      id: newAcquisitionId(),
      organizationId: "veinguard-demo",
      status: "QUEUED",
      mode: "HISTORICAL",
      productRequest: product,
      slices: [
        {
          requestHash: slice.requestHash,
          providerRequest: slice.providerRequest,
          freshness: slice.freshness,
          observationOrForecastTime: slice.observationOrForecastTime,
        },
      ],
      includeSolarIrradiance: false,
      centroid: plan.centroid,
      correlationId: "resilience",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const updated = await runAcquisitionSlice({
      acquisition,
      sliceIndex: 0,
      client,
      store,
      poll: {
        initialDelayMs: this.env.FORTYGUARD_POLL_INITIAL_MS,
        maxDelayMs: this.env.FORTYGUARD_POLL_MAX_MS,
        timeoutMs: this.env.FORTYGUARD_ACTIVITY_TIMEOUT_MS,
      },
    });
    const snapshot = updated.slices[0]?.snapshot;
    if (!snapshot) {
      throw new FortyGuardError("ACTIVITY_FAILED", "Heatmap completed without map data.");
    }
    event.cached = false;
    event.freshness = "HISTORICAL";
    event.activityId = snapshot.activityId;
    event.statsMeanC = snapshot.stats.mean ?? null;
    event.meanAirTemperatureC = snapshot.stats.mean ?? null;
    return snapshot;
  }

  private async replayChemistry(event: StudyEvent, snapshot: CachedCompleted): Promise<void> {
    try {
      const client = new HttpSimulationClient({
        baseUrl: this.env.SIMULATION_SERVICE_BASE_URL,
        token: this.env.SIMULATION_SERVICE_TOKEN,
        timeoutMs: 120_000,
      });
      const result = await client.runBaseline({
        networkId: "epa-net3",
        snapshot: {
          provenance: {
            provider: "FORTYGUARD",
            endpoint: snapshot.endpoint,
            activityId: snapshot.activityId,
            fetchedAt: snapshot.fetchedAt,
            freshness: snapshot.originalFreshness,
            requestHash: snapshot.requestHash,
          },
          rawResponse: snapshot.rawResponse as Record<string, unknown>,
        },
        sampleTimeSeconds: 3600,
      });
      const summary = (result.summary ?? {}) as { targetBreachAssetIds?: string[] };
      const nodes = Object.values(
        (result.nodes ?? {}) as Record<string, { id?: string; associatedAirTemperatureC?: number }>,
      );
      event.targetBreachAssetIds = summary.targetBreachAssetIds ?? [];
      event.highHeatAssetIds = nodes
        .filter(
          (node) =>
            node.associatedAirTemperatureC != null && node.associatedAirTemperatureC >= HIGH_HEAT_C,
        )
        .map((node) => String(node.id ?? ""))
        .filter(Boolean);
      event.chemistryStatus = "SUCCEEDED";
    } catch (error) {
      event.chemistryStatus = "FAILED";
      event.error = {
        code: "INTERNAL_DEPENDENCY_UNAVAILABLE",
        message:
          error instanceof Error
            ? `Thermal succeeded; chemistry replay failed: ${error.message}`
            : "Thermal succeeded; chemistry replay failed.",
      };
    }
  }
}

async function persistStudy(
  mongo: MongoClient,
  dbName: string,
  id: string,
  events: StudyEvent[],
): Promise<void> {
  const succeeded = events.filter((event) => event.status === "SUCCEEDED").length;
  const failed = events.filter((event) => event.status === "FAILED").length;
  const pending = events.filter(
    (event) => event.status !== "SUCCEEDED" && event.status !== "FAILED",
  ).length;
  let status = "RUNNING";
  if (pending === 0) {
    if (failed === 0) {
      status = "SUCCEEDED";
    } else if (succeeded === 0) {
      status = "FAILED";
    } else {
      status = "PARTIAL";
    }
  }
  await mongo
    .db(dbName)
    .collection<{ _id: string }>("resilienceStudies")
    .updateOne(
      { _id: id },
      {
        $set: {
          status,
          events,
          aggregation: {
            requested: events.length,
            succeeded,
            failed,
            cachedReal: events.filter((event) => event.cached || event.freshness === "CACHED_REAL")
              .length,
            chemistrySucceeded: events.filter((event) => event.chemistryStatus === "SUCCEEDED")
              .length,
            sampleSize: succeeded,
          },
          updatedAt: new Date(),
        },
      },
    );
}

function applyCaptured(event: StudyEvent): void {
  const snapshot = JSON.parse(
    readFileSync(join(repoRoot(), "data/operations/demo-operations-v1.json"), "utf8"),
  ) as {
    nodes: Array<{
      id: string;
      associatedAirTemperatureC?: number | null;
      projectedTargetBreach?: boolean;
    }>;
    meanAssociatedAirTemperatureC?: number | null;
  };
  event.status = "SUCCEEDED";
  event.freshness = "CACHED_REAL";
  event.cached = true;
  event.chemistryStatus = "SUCCEEDED";
  event.meanAirTemperatureC = snapshot.meanAssociatedAirTemperatureC ?? null;
  event.highHeatAssetIds = snapshot.nodes
    .filter(
      (node) =>
        node.associatedAirTemperatureC != null && node.associatedAirTemperatureC >= HIGH_HEAT_C,
    )
    .map((node) => node.id);
  event.targetBreachAssetIds = snapshot.nodes
    .filter((node) => node.projectedTargetBreach)
    .map((node) => node.id);
  event.error = { code: null, message: null };
}

function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, "data", "operations", "demo-operations-v1.json"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return process.cwd();
}
