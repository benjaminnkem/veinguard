import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { QUEUE_NAMES, type WorkerEnv } from "@repo/config";
import {
  FortyGuardClient,
  FortyGuardError,
  MongoThermalStore,
  maybeFetchSolar,
  runAcquisitionSlice,
  summarizeAcquisition,
} from "@repo/fortyguard";
import { UnrecoverableError, type Job } from "bullmq";
import { MongoClient } from "mongodb";
import { WORKER_ENV } from "../config/env.module";

interface FortyGuardJobPayload {
  acquisitionId: string;
  sliceIndex: number;
}

@Processor(QUEUE_NAMES.fortyguard)
export class FortyGuardProcessor extends WorkerHost {
  private readonly logger = new Logger(FortyGuardProcessor.name);
  private readonly mongo: MongoClient;
  private store: MongoThermalStore | undefined;
  private readonly client: FortyGuardClient;

  constructor(@Inject(WORKER_ENV) private readonly env: WorkerEnv) {
    super();
    this.mongo = new MongoClient(env.MONGODB_URI);
    this.client = new FortyGuardClient({
      baseUrl: env.FORTYGUARD_API_BASE_URL,
      apiKey: env.FORTYGUARD_API_KEY,
      timeoutMs: env.FORTYGUARD_HTTP_TIMEOUT_MS,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.mongo.connect();
    this.store = new MongoThermalStore(this.mongo, this.env.MONGODB_DB_NAME);
    await this.store.ensureIndexes();
  }

  async onModuleDestroy(): Promise<void> {
    await this.mongo.close();
  }

  async process(job: Job<FortyGuardJobPayload>): Promise<void> {
    if (!this.env.FORTYGUARD_API_KEY) {
      throw new FortyGuardError(
        "UNAVAILABLE",
        "FortyGuard is not configured. Thermal acquisition is unavailable.",
      );
    }
    const store = this.store;
    if (!store) {
      throw new Error("Thermal store is not ready.");
    }
    const acquisition = await store.getAcquisition(job.data.acquisitionId);
    if (!acquisition) {
      this.logger.warn(`Acquisition ${job.data.acquisitionId} was not found.`);
      return;
    }
    await this.setJobStatus(acquisition.id, "RUNNING");
    try {
      const updated = await runAcquisitionSlice({
        acquisition,
        sliceIndex: job.data.sliceIndex,
        client: this.client,
        store,
        poll: {
          initialDelayMs: this.env.FORTYGUARD_POLL_INITIAL_MS,
          maxDelayMs: this.env.FORTYGUARD_POLL_MAX_MS,
          timeoutMs: this.env.FORTYGUARD_ACTIVITY_TIMEOUT_MS,
        },
      });
      const latest = await store.getAcquisition(updated.id);
      if (latest) {
        const summarized = summarizeAcquisition(latest);
        if (summarized.status === "SUCCEEDED" && summarized.includeSolarIrradiance) {
          try {
            await maybeFetchSolar({
              acquisition: summarized,
              client: this.client,
              store,
              poll: {
                initialDelayMs: this.env.FORTYGUARD_POLL_INITIAL_MS,
                maxDelayMs: this.env.FORTYGUARD_POLL_MAX_MS,
                timeoutMs: this.env.FORTYGUARD_ACTIVITY_TIMEOUT_MS,
              },
            });
            await this.setJobStatus(summarized.id, "SUCCEEDED");
            return;
          } catch (error) {
            this.logger.warn(
              `Solar env-params follow-up failed; heatmap remains SUCCEEDED. ${String(error)}`,
            );
          }
        }
        await store.replaceAcquisition(summarized);
        await this.setJobStatus(summarized.id, summarized.status);
      }
    } catch (error) {
      const latest = await store.getAcquisition(acquisition.id);
      if (latest) {
        const slice = latest.slices[job.data.sliceIndex];
        if (slice) {
          slice.error = {
            code: error instanceof FortyGuardError ? error.errorCode : "THERMAL_ACTIVITY_FAILED",
            message: error instanceof FortyGuardError ? error.message : "FortyGuard slice failed.",
          };
        }
        latest.error = slice?.error;
        await store.replaceAcquisition(summarizeAcquisition(latest));
        await this.setJobStatus(latest.id, "FAILED", {
          code: error instanceof FortyGuardError ? error.errorCode : "THERMAL_ACTIVITY_FAILED",
          message: error instanceof FortyGuardError ? error.message : "FortyGuard slice failed.",
        });
      }
      if (
        error instanceof FortyGuardError &&
        (error.kind === "AMBIGUOUS_POST" || error.kind === "REQUEST_INVALID")
      ) {
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
  }

  private async setJobStatus(
    resourceId: string,
    status: string,
    error?: { code: string; message: string },
  ): Promise<void> {
    const now = new Date();
    await this.mongo
      .db(this.env.MONGODB_DB_NAME)
      .collection("jobs")
      .updateMany(
        { resourceId },
        {
          $set: {
            status,
            updatedAt: now,
            ...(status === "RUNNING" ? { startedAt: now } : {}),
            ...(status === "SUCCEEDED" || status === "FAILED" ? { completedAt: now } : {}),
            ...(error ? { error } : {}),
          },
          ...(status === "RUNNING" ? { $inc: { attempt: 1 } } : {}),
        },
      );
  }
}
