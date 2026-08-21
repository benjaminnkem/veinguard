import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { JobsModule } from '../jobs/jobs.module';
import { QueuesModule } from '../queues/queues.module';
import { LabController } from './lab.controller';
import { LabService } from './lab.service';

@Module({
  imports: [QueuesModule, JobsModule, AgentModule],
  controllers: [LabController],
  providers: [LabService],
  exports: [LabService],
})
export class LabModule {}
