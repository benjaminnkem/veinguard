# `apps/api`

NestJS HTTP API for VeinGuard.

```bash
pnpm --filter api dev
```

Listens on `PORT` (default 3001).

- `GET /health/live` — process is up
- `GET /health/ready` — Mongo and Redis both respond
- `POST /v1/thermal/acquisitions` — plan and enqueue a real FortyGuard heatmap
- `GET /v1/thermal/acquisitions/:id` — poll durable acquisition status
