import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { QueuesModule } from '../queues/queues.module';
import { ThermalController } from './thermal.controller';
import { ThermalService } from './thermal.service';

@Module({
  imports: [QueuesModule, JobsModule],
  controllers: [ThermalController],
  providers: [ThermalService],
})
export class ThermalModule {}
