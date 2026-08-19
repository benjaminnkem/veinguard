import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import type { WorkerEnv } from "@repo/config";
import helmet from "helmet";
import { WORKER_ENV } from "./config/env.module";
import { WorkerModule } from "./worker.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(WorkerModule);
  const env = app.get<WorkerEnv>(WORKER_ENV);
  app.use(helmet());
  await app.listen(env.WORKER_HEALTH_PORT);
}

void bootstrap();
