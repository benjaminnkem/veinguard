import { Global, Module } from '@nestjs/common';
import { parseApiEnv, type ApiEnv } from '@repo/config';

export const API_ENV = Symbol('API_ENV');

export function loadApiEnv(): ApiEnv {
  return parseApiEnv(process.env);
}

@Global()
@Module({
  providers: [
    {
      provide: API_ENV,
      useFactory: loadApiEnv,
    },
  ],
  exports: [API_ENV],
})
export class EnvModule {}
