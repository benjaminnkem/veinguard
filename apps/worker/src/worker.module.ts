import { Module } from "@nestjs/common";
import { EnvModule } from "./config/env.module";
import { HealthModule } from "./health/health.module";
import { QueuesModule } from "./queues/queues.module";

@Module({
  imports: [EnvModule, HealthModule, QueuesModule],
})
export class WorkerModule {}
