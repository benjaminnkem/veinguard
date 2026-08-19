import { Module } from "@nestjs/common";
import { QueuesModule } from "../queues/queues.module";
import { AgentProcessor } from "./agent.processor";

@Module({
  imports: [QueuesModule],
  providers: [AgentProcessor],
})
export class AgentWorkerModule {}
