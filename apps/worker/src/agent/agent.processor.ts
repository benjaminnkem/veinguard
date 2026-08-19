import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import {
  AgentError,
  compactNetworkFromTopology,
  DEFAULT_CONTEXT_MAX_BYTES,
  GroqHttpClient,
  HttpSimulationClient,
  MongoAgentStore,
  runAgentLoop,
} from "@repo/agent";
import { QUEUE_NAMES, type WorkerEnv } from "@repo/config";
import { UnrecoverableError, type Job } from "bullmq";
import { MongoClient } from "mongodb";
import { WORKER_ENV } from "../config/env.module";

interface AgentJobPayload {
  agentRunId: string;
}

@Processor(QUEUE_NAMES.agent)
export class AgentProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentProcessor.name);
  private readonly mongo: MongoClient;
  private store: MongoAgentStore | undefined;

  constructor(@Inject(WORKER_ENV) private readonly env: WorkerEnv) {
    super();
    this.mongo = new MongoClient(env.MONGODB_URI);
  }

  async onModuleInit(): Promise<void> {
    await this.mongo.connect();
    this.store = new MongoAgentStore(this.mongo, this.env.MONGODB_DB_NAME);
    await this.store.ensureIndexes();
  }

  async onModuleDestroy(): Promise<void> {
    await this.mongo.close();
  }

  async process(job: Job<AgentJobPayload>): Promise<void> {
    const store = this.store;
    if (!store) {
      throw new Error("Agent store is not ready.");
    }
    const run = await store.getRun(job.data.agentRunId);
    if (!run) {
      this.logger.warn(`Agent run ${job.data.agentRunId} was not found.`);
      return;
    }
    await this.setJobStatus(run.id, "RUNNING");
    try {
      const groq = new GroqHttpClient({
        apiKey: this.env.GROQ_API_KEY,
        model: this.env.GROQ_MODEL,
        timeoutMs: Math.min(this.env.AGENT_TIMEOUT_MS, 30_000),
      });
      groq.assertConfigured();
      const simulation = new HttpSimulationClient({
        baseUrl: this.env.SIMULATION_SERVICE_BASE_URL,
        token: this.env.SIMULATION_SERVICE_TOKEN,
        timeoutMs: 60_000,
      });
      if (!run.compactNetwork) {
        try {
          const topology = await simulation.topology(
            run.structuredConstraints.networkId ?? run.compactBaseline?.networkId ?? "epa-net3",
          );
          run.compactNetwork = compactNetworkFromTopology(topology);
          await store.replaceRun(run);
        } catch (error) {
          this.logger.warn(`Topology preload skipped: ${String(error)}`);
        }
      }
      const finished = await runAgentLoop({
        run,
        groq,
        simulation,
        store,
        limits: {
          maxSteps: this.env.AGENT_MAX_STEPS,
          maxSimulations: this.env.AGENT_MAX_SIMULATIONS,
          timeoutMs: this.env.AGENT_TIMEOUT_MS,
          contextMaxBytes: DEFAULT_CONTEXT_MAX_BYTES,
        },
      });
      await this.setJobStatus(
        finished.id,
        finished.status === "PARTIAL" ? "PARTIAL" : finished.status,
        finished.error.code
          ? { code: finished.error.code, message: finished.error.message ?? "Agent run failed." }
          : undefined,
      );
    } catch (error) {
      const code = error instanceof AgentError ? error.errorCode : "AGENT_UNAVAILABLE";
      const message = error instanceof AgentError ? error.message : "Agent run failed.";
      const latest = await store.getRun(run.id);
      if (latest) {
        latest.status = "FAILED";
        latest.outcome = "FAILED";
        latest.error = { code, message };
        latest.completedAt = new Date().toISOString();
        latest.updatedAt = latest.completedAt;
        await store.replaceRun(latest);
      }
      await this.setJobStatus(run.id, "FAILED", { code, message });
      if (
        error instanceof AgentError &&
        (error.kind === "UNAVAILABLE" || error.kind === "REQUEST_INVALID")
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
            ...(status === "SUCCEEDED" || status === "FAILED" || status === "PARTIAL"
              ? { completedAt: now }
              : {}),
            ...(error ? { error } : {}),
          },
          ...(status === "RUNNING" ? { $inc: { attempt: 1 } } : {}),
        },
      );
  }
}
