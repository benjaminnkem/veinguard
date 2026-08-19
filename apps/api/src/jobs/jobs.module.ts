import { Module } from '@nestjs/common';
import { EventsService } from '../events/events.service';
import { IdempotencyService } from './idempotency.service';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  controllers: [JobsController],
  providers: [JobsService, IdempotencyService, EventsService],
  exports: [JobsService, IdempotencyService],
})
export class JobsModule {}
