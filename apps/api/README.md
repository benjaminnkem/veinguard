# `apps/api`

NestJS HTTP API for VeinGuard.

```bash
pnpm --filter api dev
```

Listens on `PORT` (default 3001).

- `GET /health/live` — process is up
- `GET /health/ready` — Mongo and Redis both respond
- `POST /v1/auth/login` — Argon2id login; returns access + refresh
- `POST /v1/auth/refresh` — rotating refresh
- `POST /v1/auth/logout` — revoke refresh family
- `GET /v1/auth/me`
- `POST /v1/thermal/acquisitions` — plan and enqueue a real FortyGuard heatmap (OPERATOR/ADMIN)
- `GET /v1/thermal/acquisitions/:id` — poll durable acquisition status
- `GET /v1/jobs/:id` and `GET /v1/jobs/:id/events` — durable job + SSE
- `GET /v1/openapi.json` — OpenAPI document
