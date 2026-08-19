import { Module } from '@nestjs/common';
import { EnvModule } from './config/env.module';
import { HealthModule } from './health/health.module';
import { ThermalModule } from './thermal/thermal.module';

@Module({
  imports: [EnvModule, HealthModule, ThermalModule],
})
export class AppModule {}
