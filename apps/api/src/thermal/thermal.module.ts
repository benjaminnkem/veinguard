import { Module } from '@nestjs/common';
import { QueuesModule } from '../queues/queues.module';
import { ThermalController } from './thermal.controller';
import { ThermalService } from './thermal.service';

@Module({
  imports: [QueuesModule],
  controllers: [ThermalController],
  providers: [ThermalService],
})
export class ThermalModule {}
