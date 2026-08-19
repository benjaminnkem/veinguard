import { Global, Module } from "@nestjs/common";
import { parseWorkerEnv, type WorkerEnv } from "@repo/config";

export const WORKER_ENV = Symbol("WORKER_ENV");

export function loadWorkerEnv(): WorkerEnv {
  return parseWorkerEnv(process.env);
}

@Global()
@Module({
  providers: [
    {
      provide: WORKER_ENV,
      useFactory: loadWorkerEnv,
    },
  ],
  exports: [WORKER_ENV],
})
export class EnvModule {}
