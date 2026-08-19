import { InjectQueue } from '@nestjs/bullmq';
import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ApiEnv } from '@repo/config';
import { QUEUE_NAMES } from '@repo/config';
import { MODEL_NAMES } from '@repo/persistence';
import type { Model } from 'mongoose';
import {
  AgentError,
  compactBaselineFromSummary,
  GroqHttpClient,
  MemoryAgentStore,
  MongoAgentStore,
  newAgentRunId,
  normalizeConstraints,
  type AgentEvent,
  type AgentRun,
  type AgentStore,
} from '@repo/agent';
import { RETIRED_GROQ_MODELS } from '@repo/agent';
import type { Queue } from 'bullmq';
import { MongoClient } from 'mongodb';
import { API_ENV } from '../config/env.module';

export interface AgentJobPayload {
  agentRunId: string;
}

@Injectable()
export class AgentService implements OnModuleInit, OnModuleDestroy {
  private readonly mongo: MongoClient;
  private store!: AgentStore;

  constructor(
    @Inject(API_ENV) private readonly env: ApiEnv,
    @InjectQueue(QUEUE_NAMES.agent)
    private readonly queue: Queue<AgentJobPayload>,
    @InjectModel(MODEL_NAMES.SimulationRun)
    private readonly simulations: Model<{
      _id: string;
      organizationId: string;
      summary: Record<string, unknown> | null;
    }>,
  ) {
    this.mongo = new MongoClient(env.MONGODB_URI);
  }

  async onModuleInit(): Promise<void> {
    if (this.env.NODE_ENV === 'test') {
      this.store = new MemoryAgentStore();
      return;
    }
    await this.mongo.connect();
    const mongoStore = new MongoAgentStore(
      this.mongo,
      this.env.MONGODB_DB_NAME,
    );
    await mongoStore.ensureIndexes();
    this.store = mongoStore;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.env.NODE_ENV !== 'test') {
      await this.mongo.close();
    }
  }

  assertAvailable(): void {
    const client = new GroqHttpClient({
      apiKey: this.env.GROQ_API_KEY,
      model: this.env.GROQ_MODEL,
    });
    client.assertConfigured();
    if (RETIRED_GROQ_MODELS.has(this.env.GROQ_MODEL)) {
      throw new AgentError(
        'UNAVAILABLE',
        `GROQ_MODEL '${this.env.GROQ_MODEL}' is retired.`,
      );
    }
  }

  async create(input: {
    organizationId: string;
    baselineRunId: string;
    goal: string;
    structuredConstraints?: unknown;
    baselineSummary?: Record<string, unknown>;
    correlationId: string;
  }): Promise<{ run: AgentRun; queued: boolean }> {
    this.assertAvailable();
    const now = new Date().toISOString();
    let compactBaseline = input.baselineSummary
      ? compactBaselineFromSummary(input.baselineRunId, input.baselineSummary)
      : null;
    if (!compactBaseline) {
      const stored = await this.simulations
        .findOne({
          _id: input.baselineRunId,
          organizationId: input.organizationId,
        })
        .lean();
      if (stored?.summary) {
        compactBaseline = compactBaselineFromSummary(
          input.baselineRunId,
          stored.summary,
        );
      }
    }
    const run: AgentRun = {
      id: newAgentRunId(),
      organizationId: input.organizationId,
      status: 'QUEUED',
      outcome: null,
      goal: input.goal,
      structuredConstraints: normalizeConstraints(input.structuredConstraints),
      baselineRunId: input.baselineRunId,
      modelId: this.env.GROQ_MODEL,
      compactBaseline,
      compactNetwork: null,
      selectedScenarioRunId: null,
      rationale: null,
      scenarioRunIds: [],
      correlationId: input.correlationId,
      jobId: null,
      error: { code: null, message: null },
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
    };
    await this.store.createRun(run);
    await this.queue.add(
      'run',
      { agentRunId: run.id },
      {
        jobId: `agent-${run.id}`,
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
    return { run, queued: true };
  }

  async get(id: string, organizationId: string): Promise<AgentRun | null> {
    return this.store.getRun(id, organizationId);
  }

  async events(
    id: string,
    organizationId: string,
    afterSequence = 0,
  ): Promise<AgentEvent[]> {
    const run = await this.store.getRun(id, organizationId);
    if (!run) {
      return [];
    }
    return this.store.listEvents(id, afterSequence);
  }
}
