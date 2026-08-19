import { Module } from "@nestjs/common";
import { EnvModule } from "./config/env.module";
import { FortyGuardModule } from "./fortyguard/fortyguard.module";
import { HealthModule } from "./health/health.module";
import { QueuesModule } from "./queues/queues.module";

@Module({
  imports: [EnvModule, HealthModule, QueuesModule, FortyGuardModule],
})
export class WorkerModule {}
