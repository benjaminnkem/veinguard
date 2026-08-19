import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import type { WorkerEnv } from "@repo/config";
import type { HealthCheck, HealthLiveData, HealthReadyData } from "@repo/contracts";
import { Redis } from "ioredis";
import { MongoClient } from "mongodb";
import { WORKER_ENV } from "../config/env.module";

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly mongo: MongoClient;
  private readonly redis: Redis;

  constructor(@Inject(WORKER_ENV) private readonly env: WorkerEnv) {
    this.mongo = new MongoClient(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 1500,
    });
    this.redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 1500,
      lazyConnect: true,
    });
  }

  live(): HealthLiveData {
    return {
      status: "ok",
      service: "veinguard-worker",
    };
  }

  async ready(): Promise<HealthReadyData> {
    const checks = await Promise.all([this.checkMongo(), this.checkRedis()]);
    const ready = checks.every((check) => check.status === "up");
    return {
      status: ready ? "ready" : "not_ready",
      service: "veinguard-worker",
      checks,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.mongo.close(), this.redis.quit()]);
  }

  private async checkMongo(): Promise<HealthCheck> {
    try {
      await this.mongo.connect();
      await this.mongo.db(this.env.MONGODB_DB_NAME).command({ ping: 1 });
      return { name: "mongo", status: "up" };
    } catch (error) {
      return {
        name: "mongo",
        status: "down",
        detail: error instanceof Error ? error.message : "Mongo ping failed",
      };
    }
  }

  private async checkRedis(): Promise<HealthCheck> {
    try {
      if (this.redis.status === "wait") {
        await this.redis.connect();
      }
      const pong = await this.redis.ping();
      if (pong !== "PONG") {
        return {
          name: "redis",
          status: "down",
          detail: `Unexpected ping response: ${String(pong)}`,
        };
      }
      return { name: "redis", status: "up" };
    } catch (error) {
      return {
        name: "redis",
        status: "down",
        detail: error instanceof Error ? error.message : "Redis ping failed",
      };
    }
  }
}
