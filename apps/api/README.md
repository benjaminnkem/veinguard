# `apps/api`

NestJS HTTP API for VeinGuard.

```bash
pnpm --filter api dev
```

Listens on `PORT` (default 3001).

- `GET /health/live` — process is up
- `GET /health/ready` — Mongo and Redis both respond
