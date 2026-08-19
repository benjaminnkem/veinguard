import { Module } from "@nestjs/common";
import { QueuesModule } from "../queues/queues.module";
import { FortyGuardProcessor } from "./fortyguard.processor";

@Module({
  imports: [QueuesModule],
  providers: [FortyGuardProcessor],
})
export class FortyGuardModule {}
