import { Module } from "@nestjs/common";
import { QueuesModule } from "../queues/queues.module";
import { ResilienceProcessor } from "./resilience.processor";

@Module({
  imports: [QueuesModule],
  providers: [ResilienceProcessor],
})
export class ResilienceWorkerModule {}
