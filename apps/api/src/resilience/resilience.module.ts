import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { QueuesModule } from '../queues/queues.module';
import { ResilienceController } from './resilience.controller';
import { ResilienceService } from './resilience.service';

@Module({
  imports: [QueuesModule, JobsModule],
  controllers: [ResilienceController],
  providers: [ResilienceService],
})
export class ResilienceModule {}
