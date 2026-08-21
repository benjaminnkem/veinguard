import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { QueuesModule } from '../queues/queues.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

@Module({
  imports: [QueuesModule, JobsModule],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
