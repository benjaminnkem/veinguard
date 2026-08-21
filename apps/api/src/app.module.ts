import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { EnvModule } from './config/env.module';
import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';
import { MongoModule } from './mongo/mongo.module';
import { AgentModule } from './agent/agent.module';
import { LabModule } from './lab/lab.module';
import { OperationsModule } from './operations/operations.module';
import { ThermalModule } from './thermal/thermal.module';

@Module({
  imports: [
    EnvModule,
    MongoModule,
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60000, limit: 120 }],
    }),
    AuthModule,
    JobsModule,
    HealthModule,
    ThermalModule,
    AgentModule,
    LabModule,
    OperationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
