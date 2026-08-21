import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { AgentError, HttpSimulationClient } from "@repo/agent";
import { QUEUE_NAMES, type WorkerEnv } from "@repo/config";
import { UnrecoverableError, type Job } from "bullmq";
import { MongoClient } from "mongodb";
import { WORKER_ENV } from "../config/env.module";

interface SimulationJobPayload {
  scenarioId: string;
}

interface ScenarioDoc {
  _id: string;
  interventions: unknown[];
  horizonStart: string;
  sampleTimeSeconds: number;
  networkId: string;
  airTemperatureC?: number;
  sourceTemperatureC?: number;
  status: string;
  result?: unknown;
  error?: { code: string | null; message: string | null };
  updatedAt?: Date;
}

@Processor(QUEUE_NAMES.simulation)
export class SimulationProcessor extends WorkerHost {
  private readonly logger = new Logger(SimulationProcessor.name);
  private readonly mongo: MongoClient;

  constructor(@Inject(WORKER_ENV) private readonly env: WorkerEnv) {
    super();
    this.mongo = new MongoClient(env.MONGODB_URI);
  }

  async onModuleInit(): Promise<void> {
    await this.mongo.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.mongo.close();
  }

  async process(job: Job<SimulationJobPayload>): Promise<void> {
    this.logger.log(`Processing scenario ${job.data.scenarioId}`);
    const collection = this.mongo.db(this.env.MONGODB_DB_NAME).collection<ScenarioDoc>("scenarios");
    const scenario = await collection.findOne({ _id: job.data.scenarioId });
    if (!scenario) {
      this.logger.warn(`Scenario ${job.data.scenarioId} was not found.`);
      return;
    }
    await this.setStatus(scenario._id, "RUNNING");
    const client = new HttpSimulationClient({
      baseUrl: this.env.SIMULATION_SERVICE_BASE_URL,
      token: this.env.SIMULATION_SERVICE_TOKEN,
      timeoutMs: 120_000,
    });
    try {
      const result = await client.runScenario({
        networkId: scenario.networkId || "epa-net3",
        horizonStart: scenario.horizonStart,
        interventions: scenario.interventions,
        sampleTimeSeconds: scenario.sampleTimeSeconds,
        scenarioRunId: scenario._id,
        airTemperatureC: scenario.airTemperatureC,
        sourceTemperatureC: scenario.sourceTemperatureC,
      });
      const now = new Date();
      await collection.updateOne(
        { _id: scenario._id },
        {
          $set: {
            status: "SUCCEEDED",
            result,
            updatedAt: now,
            error: { code: null, message: null },
          },
        },
      );
      await this.setJob(scenario._id, "SUCCEEDED");
    } catch (error) {
      const code =
        error instanceof AgentError ? error.errorCode : "INTERNAL_DEPENDENCY_UNAVAILABLE";
      const message =
        error instanceof AgentError ? error.message : "Simulation service request failed.";
      await collection.updateOne(
        { _id: scenario._id },
        {
          $set: {
            status: "FAILED",
            updatedAt: new Date(),
            error: { code, message },
          },
        },
      );
      await this.setJob(scenario._id, "FAILED", { code, message });
      if (error instanceof AgentError && error.kind === "UNAVAILABLE") {
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
  }

  private async setStatus(id: string, status: string): Promise<void> {
    const now = new Date();
    await this.mongo
      .db(this.env.MONGODB_DB_NAME)
      .collection<ScenarioDoc>("scenarios")
      .updateOne(
        { _id: id },
        {
          $set: {
            status,
            updatedAt: now,
          },
        },
      );
    await this.setJob(id, status === "RUNNING" ? "RUNNING" : status);
  }

  private async setJob(
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
