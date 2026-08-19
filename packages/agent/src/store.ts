import { randomUUID } from "node:crypto";
import { MongoClient, type Collection, type Db } from "mongodb";
import type { AgentEvent, AgentRun } from "./types";

export function newAgentRunId(): string {
  return randomUUID();
}

export interface AgentStore {
  createRun(run: AgentRun): Promise<AgentRun>;
  getRun(id: string, organizationId?: string): Promise<AgentRun | null>;
  replaceRun(run: AgentRun): Promise<void>;
  appendEvent(event: AgentEvent): Promise<AgentEvent>;
  listEvents(agentRunId: string, afterSequence?: number): Promise<AgentEvent[]>;
  nextSequence(agentRunId: string): Promise<number>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryAgentStore implements AgentStore {
  readonly runs = new Map<string, AgentRun>();
  readonly events = new Map<string, AgentEvent[]>();

  async createRun(run: AgentRun): Promise<AgentRun> {
    this.runs.set(run.id, clone(run));
    this.events.set(run.id, []);
    return clone(run);
  }

  async getRun(id: string, organizationId?: string): Promise<AgentRun | null> {
    const found = this.runs.get(id);
    if (!found) {
      return null;
    }
    if (organizationId && found.organizationId !== organizationId) {
      return null;
    }
    return clone(found);
  }

  async replaceRun(run: AgentRun): Promise<void> {
    this.runs.set(run.id, clone(run));
  }

  async appendEvent(event: AgentEvent): Promise<AgentEvent> {
    const list = this.events.get(event.agentRunId) ?? [];
    const stored = { ...event, id: event.id ?? randomUUID() };
    list.push(stored);
    this.events.set(event.agentRunId, list);
    return stored;
  }

  async listEvents(agentRunId: string, afterSequence = 0): Promise<AgentEvent[]> {
    return (this.events.get(agentRunId) ?? []).filter((item) => item.sequence > afterSequence);
  }

  async nextSequence(agentRunId: string): Promise<number> {
    const list = this.events.get(agentRunId) ?? [];
    return list.length === 0 ? 1 : list[list.length - 1]!.sequence + 1;
  }
}

interface AgentRunDoc extends Omit<AgentRun, "id"> {
  _id: string;
}

interface AgentEventDoc extends Omit<AgentEvent, "id"> {
  _id: string;
}

export class MongoAgentStore implements AgentStore {
  private readonly db: Db;

  constructor(client: MongoClient, dbName: string) {
    this.db = client.db(dbName);
  }

  async ensureIndexes(): Promise<void> {
    await this.runsCol().createIndexes([
      { key: { organizationId: 1, createdAt: -1 } },
      { key: { status: 1, createdAt: -1 } },
    ]);
    await this.eventsCol().createIndexes([{ key: { agentRunId: 1, sequence: 1 }, unique: true }]);
  }

  async createRun(run: AgentRun): Promise<AgentRun> {
    const { id, ...rest } = run;
    await this.runsCol().insertOne({ ...rest, _id: id } as AgentRunDoc);
    return run;
  }

  async getRun(id: string, organizationId?: string): Promise<AgentRun | null> {
    const query: Record<string, string> = { _id: id };
    if (organizationId) {
      query.organizationId = organizationId;
    }
    const doc = await this.runsCol().findOne(query);
    return doc ? fromRunDoc(doc) : null;
  }

  async replaceRun(run: AgentRun): Promise<void> {
    const { id, ...rest } = run;
    await this.runsCol().replaceOne({ _id: id }, { ...rest, _id: id } as AgentRunDoc);
  }

  async appendEvent(event: AgentEvent): Promise<AgentEvent> {
    const id = event.id ?? randomUUID();
    const rest = { ...event };
    delete rest.id;
    await this.eventsCol().insertOne({ ...rest, _id: id } as AgentEventDoc);
    return { ...event, id };
  }

  async listEvents(agentRunId: string, afterSequence = 0): Promise<AgentEvent[]> {
    const docs = await this.eventsCol()
      .find({ agentRunId, sequence: { $gt: afterSequence } })
      .sort({ sequence: 1 })
      .toArray();
    return docs.map(fromEventDoc);
  }

  async nextSequence(agentRunId: string): Promise<number> {
    const last = await this.eventsCol().find({ agentRunId }).sort({ sequence: -1 }).limit(1).toArray();
    return last[0] ? last[0].sequence + 1 : 1;
  }

  private runsCol(): Collection<AgentRunDoc> {
    return this.db.collection<AgentRunDoc>("agentRuns");
  }

  private eventsCol(): Collection<AgentEventDoc> {
    return this.db.collection<AgentEventDoc>("agentEvents");
  }
}

function fromRunDoc(doc: AgentRunDoc): AgentRun {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id };
}

function fromEventDoc(doc: AgentEventDoc): AgentEvent {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id };
}
