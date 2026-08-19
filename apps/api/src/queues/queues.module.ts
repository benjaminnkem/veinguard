import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_NAMES, QUEUE_PREFIX, type ApiEnv } from '@repo/config';
import { API_ENV } from '../config/env.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [API_ENV],
      useFactory: (env: ApiEnv) => ({
        prefix: QUEUE_PREFIX,
        connection: {
          url: env.REDIS_URL,
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.fortyguard },
      { name: QUEUE_NAMES.agent },
    ),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
