import { randomUUID } from "node:crypto";
import { MongoClient, type Collection, type Db } from "mongodb";
import type { RunStatus } from "@repo/contracts";
import type { CachedCompleted, ThermalAcquisition } from "./types";

export interface ThermalStore {
  getCache(requestHash: string): Promise<CachedCompleted | null>;
  putCache(entry: CachedCompleted): Promise<void>;
  createAcquisition(doc: ThermalAcquisition): Promise<ThermalAcquisition>;
  getAcquisition(id: string): Promise<ThermalAcquisition | null>;
  findActiveByHashes(hashes: string[]): Promise<ThermalAcquisition | null>;
  replaceAcquisition(doc: ThermalAcquisition): Promise<void>;
}

export function newAcquisitionId(): string {
  return randomUUID();
}

export class MemoryThermalStore implements ThermalStore {
  private readonly cache = new Map<string, CachedCompleted>();
  private readonly acquisitions = new Map<string, ThermalAcquisition>();

  async getCache(requestHash: string): Promise<CachedCompleted | null> {
    return this.cache.get(requestHash) ?? null;
  }

  async putCache(entry: CachedCompleted): Promise<void> {
    this.cache.set(entry.requestHash, entry);
  }

  async createAcquisition(doc: ThermalAcquisition): Promise<ThermalAcquisition> {
    this.acquisitions.set(doc.id, doc);
    return doc;
  }

  async getAcquisition(id: string): Promise<ThermalAcquisition | null> {
    return this.acquisitions.get(id) ?? null;
  }

  async findActiveByHashes(hashes: string[]): Promise<ThermalAcquisition | null> {
    const set = new Set(hashes);
    for (const item of this.acquisitions.values()) {
      if (item.status === "FAILED" || item.status === "CANCELLED") {
        continue;
      }
      if (item.slices.some((slice) => set.has(slice.requestHash))) {
        return item;
      }
    }
    return null;
  }

  async replaceAcquisition(doc: ThermalAcquisition): Promise<void> {
    this.acquisitions.set(doc.id, doc);
  }
}

export class MongoThermalStore implements ThermalStore {
  private readonly db: Db;

  constructor(client: MongoClient, dbName: string) {
    this.db = client.db(dbName);
  }

  private cacheCol(): Collection<CachedCompleted> {
    return this.db.collection("fortyguard_completed_cache");
  }

  private acqCol(): Collection<ThermalAcquisition> {
    return this.db.collection("thermal_acquisitions");
  }

  async ensureIndexes(): Promise<void> {
    await this.cacheCol().createIndex({ requestHash: 1 }, { unique: true });
    await this.acqCol().createIndex({ id: 1 }, { unique: true });
    await this.acqCol().createIndex({ "slices.requestHash": 1, status: 1 });
  }

  async getCache(requestHash: string): Promise<CachedCompleted | null> {
    const doc = await this.cacheCol().findOne({ requestHash });
    return doc ? stripMongoId(doc) : null;
  }

  async putCache(entry: CachedCompleted): Promise<void> {
    await this.cacheCol().replaceOne({ requestHash: entry.requestHash }, entry, {
      upsert: true,
    });
  }

  async createAcquisition(doc: ThermalAcquisition): Promise<ThermalAcquisition> {
    await this.acqCol().insertOne(doc);
    return doc;
  }

  async getAcquisition(id: string): Promise<ThermalAcquisition | null> {
    const doc = await this.acqCol().findOne({ id });
    return doc ? stripMongoId(doc) : null;
  }

  async findActiveByHashes(hashes: string[]): Promise<ThermalAcquisition | null> {
    const active: RunStatus[] = ["PENDING", "QUEUED", "RUNNING", "SUCCEEDED", "PARTIAL"];
    const doc = await this.acqCol().findOne({
      "slices.requestHash": { $in: hashes },
      status: { $in: active },
    });
    return doc ? stripMongoId(doc) : null;
  }

  async replaceAcquisition(doc: ThermalAcquisition): Promise<void> {
    await this.acqCol().replaceOne({ id: doc.id }, doc);
  }
}

function stripMongoId<T>(doc: T & { _id?: unknown }): T {
  const { _id: _ignored, ...rest } = doc as T & { _id?: unknown };
  void _ignored;
  return rest as T;
}
