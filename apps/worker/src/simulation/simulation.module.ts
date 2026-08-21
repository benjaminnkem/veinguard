import { Module } from "@nestjs/common";
import { QueuesModule } from "../queues/queues.module";
import { SimulationProcessor } from "./simulation.processor";

@Module({
  imports: [QueuesModule],
  providers: [SimulationProcessor],
})
export class SimulationWorkerModule {}
