# VeinGuard — Environment & Local Setup Specification

Codex must reconcile this target with actual implementation and keep every `.env.example` current.

# 1. Prerequisites

Verify current supported versions:
- Git;
- Node.js supported by current Next/Nest;
- Corepack/pnpm;
- Python supported by current WNTR;
- Docker/Compose;
- any current WNTR/EPANET native runtime requirement.

# 2. Web

`apps/web/.env.local.example`

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/v1
NEXT_PUBLIC_MAP_STYLE_URL_LIGHT=https://tiles.openfreemap.org/styles/positron
NEXT_PUBLIC_MAP_STYLE_URL_DARK=https://tiles.openfreemap.org/styles/dark
NEXT_PUBLIC_APP_ENV=development
```

Only genuinely public values.

# 3. API

`apps/api/.env.example`

```env
NODE_ENV=development
PORT=3001
APP_BASE_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000

MONGODB_URI=mongodb://localhost:27017/veinguard
MONGODB_DB_NAME=veinguard
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=2592000

SIMULATION_SERVICE_BASE_URL=http://localhost:8000
SIMULATION_SERVICE_TOKEN=

FORTYGUARD_API_BASE_URL=https://api.fortyguard.com
FORTYGUARD_API_KEY=
FORTYGUARD_POLL_INITIAL_MS=2000
FORTYGUARD_POLL_MAX_MS=15000
FORTYGUARD_ACTIVITY_TIMEOUT_MS=600000

GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b

AGENT_MAX_STEPS=8
AGENT_MAX_SIMULATIONS=5
AGENT_TIMEOUT_MS=180000

LOG_LEVEL=info
```

Timeouts/concurrency are initial config and must be benchmarked.

# 4. Worker

```env
NODE_ENV=development

MONGODB_URI=mongodb://localhost:27017/veinguard
MONGODB_DB_NAME=veinguard
REDIS_URL=redis://localhost:6379

SIMULATION_SERVICE_BASE_URL=http://localhost:8000
SIMULATION_SERVICE_TOKEN=

FORTYGUARD_API_BASE_URL=https://api.fortyguard.com
FORTYGUARD_API_KEY=

GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b

FORTYGUARD_POLL_INITIAL_MS=2000
FORTYGUARD_POLL_MAX_MS=15000
FORTYGUARD_ACTIVITY_TIMEOUT_MS=600000

SIMULATION_QUEUE_CONCURRENCY=1
FORTYGUARD_QUEUE_CONCURRENCY=2
AGENT_QUEUE_CONCURRENCY=1
RESILIENCE_QUEUE_CONCURRENCY=1

AGENT_MAX_STEPS=8
AGENT_MAX_SIMULATIONS=5
AGENT_TIMEOUT_MS=180000

LOG_LEVEL=info
```

# 5. Simulation

`services/simulation/.env.example`

```env
APP_ENV=development
HOST=0.0.0.0
PORT=8000

SERVICE_TOKEN=

NETWORK_DATA_DIR=../../data/networks
CALIBRATION_DATA_DIR=../../data/calibration

MAX_CONCURRENT_SIMULATIONS=1
SIMULATION_TIMEOUT_SECONDS=120

THERMAL_MODEL_VERSION=water-temp-v1
FREE_CHLORINE_MODEL_VERSION=free-chlorine-v1
MONOCHLORAMINE_MODEL_VERSION=monochloramine-v1
NITRIFICATION_RISK_MODEL_VERSION=nitrification-conditions-v1

# Only if selected WNTR/MSX installation requires explicit path:
WNTR_PATH_TO_EPANETMSX=
```

Model version must also be represented in code/model registry; env alone is not provenance.

# 6. Live integration flags

```env
RUN_LIVE_FORTYGUARD_TESTS=false
RUN_LIVE_GROQ_TESTS=false
```

These flags control cost-consuming integration tests only. They are not runtime mock switches.

# 7. Local Docker

Docker Compose should provide:
- MongoDB;
- Redis.

Expected eventual commands:

```bash
docker compose up -d mongo redis
pnpm install --frozen-lockfile
pnpm dev
```

Repository should include a Python bootstrap command/script.

# 8. Credentials

## FortyGuard
Obtain hackathon/organization API key.

Server-only:
```env
FORTYGUARD_API_KEY=
```

Verify account entitlement in current docs/dashboard.

## Groq
Create GroqCloud API key:
```env
GROQ_API_KEY=
```

Server/worker only.

## Mongo
Local: Docker.

Hosted: Atlas Free cluster/user/network access:
```env
MONGODB_URI=
```

## Redis
Local Docker or compatible hosted Redis:
```env
REDIS_URL=
```

## Map
MapLibre style provider. Theme toggle selects light or dark:
```env
NEXT_PUBLIC_MAP_STYLE_URL_LIGHT=https://tiles.openfreemap.org/styles/positron
NEXT_PUBLIC_MAP_STYLE_URL_DARK=https://tiles.openfreemap.org/styles/dark
```
Only use browser-public token/style as provider permits.

# 9. Demo user

Required seed:
```bash
pnpm seed:demo
```

It should:
- create organization/user idempotently;
- hash password;
- accept secure environment/prompt input or generate;
- never commit production credentials.

# 10. Fail-fast configuration

Examples:
- no Mongo => API not ready;
- no Redis => worker not ready;
- no FortyGuard key => thermal acquisition feature unavailable, no fake data;
- no Groq key => agent unavailable, manual simulation still works;
- simulation token mismatch => internal call denied.
