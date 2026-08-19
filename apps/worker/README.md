# `apps/worker`

NestJS worker process. Registers BullMQ queues and exposes health over HTTP so the process can be probed.

```bash
pnpm --filter worker dev
```

Listens on `WORKER_HEALTH_PORT` (default 3002).

- `GET /health/live`
- `GET /health/ready`

Processors:

- `fortyguard` — submit/poll FortyGuard activities; cache only Completed real responses
