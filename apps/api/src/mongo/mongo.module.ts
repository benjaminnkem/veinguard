import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import type { ApiEnv } from '@repo/config';
import {
  AgentEventSchema,
  AgentRunSchema,
  AuditLogSchema,
  IdempotencySchema,
  JobSchema,
  LabStateSchema,
  MODEL_NAMES,
  OrganizationSchema,
  RefreshTokenSchema,
  ResilienceStudySchema,
  ScenarioSchema,
  SimulationRunSchema,
  UserSchema,
} from '@repo/persistence';
import { API_ENV } from '../config/env.module';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [API_ENV],
      useFactory: (env: ApiEnv) => ({
        uri: env.MONGODB_URI,
        dbName: env.MONGODB_DB_NAME,
      }),
    }),
    MongooseModule.forFeature([
      { name: MODEL_NAMES.Organization, schema: OrganizationSchema },
      { name: MODEL_NAMES.User, schema: UserSchema },
      { name: MODEL_NAMES.RefreshToken, schema: RefreshTokenSchema },
      { name: MODEL_NAMES.Job, schema: JobSchema },
      { name: MODEL_NAMES.Idempotency, schema: IdempotencySchema },
      { name: MODEL_NAMES.AuditLog, schema: AuditLogSchema },
      { name: MODEL_NAMES.SimulationRun, schema: SimulationRunSchema },
      { name: MODEL_NAMES.AgentRun, schema: AgentRunSchema },
      { name: MODEL_NAMES.AgentEvent, schema: AgentEventSchema },
      { name: MODEL_NAMES.Scenario, schema: ScenarioSchema },
      { name: MODEL_NAMES.LabState, schema: LabStateSchema },
      { name: MODEL_NAMES.ResilienceStudy, schema: ResilienceStudySchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class MongoModule {}
