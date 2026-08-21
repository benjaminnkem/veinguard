import { Module } from "@nestjs/common";
import { AgentWorkerModule } from "./agent/agent.module";
import { EnvModule } from "./config/env.module";
import { FortyGuardModule } from "./fortyguard/fortyguard.module";
import { HealthModule } from "./health/health.module";
import { QueuesModule } from "./queues/queues.module";
import { SimulationWorkerModule } from "./simulation/simulation.module";

@Module({
  imports: [
    EnvModule,
    HealthModule,
    QueuesModule,
    FortyGuardModule,
    SimulationWorkerModule,
    AgentWorkerModule,
  ],
})
export class WorkerModule {}
