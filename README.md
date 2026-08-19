# VeinGuard

Heat-aware drinking-water distribution digital twin and decision-support system. Built for the FortyGuard Hackathon '26 as a production-minded codebase.

This repository is a pnpm/Turborepo workspace:

- `apps/web` — Next.js App Router
- `apps/api` — NestJS HTTP API
- `apps/worker` — NestJS BullMQ worker + health server
- `services/simulation` — Python FastAPI scientific service
- `packages/contracts` — shared TypeScript contracts
- `packages/config` — shared env/queue configuration

Provider keys never belong in the browser. There is no mock FortyGuard, EPANET, or Groq fallback in runtime.

## Prerequisites

- Node.js 18+ (22 recommended)
- pnpm 9
- Docker Desktop
- Python 3.11+ (3.12 recommended; 3.12 is used in CI)
- openssl (for local secret generation)

## Fresh clone

```bash
pnpm bootstrap
```

That copies env files, generates JWT/simulation tokens, starts Mongo and Redis, installs JavaScript dependencies, and creates the simulation virtualenv.

Then add real provider keys to:

- `apps/api/.env`
- `apps/worker/.env`

```env
FORTYGUARD_API_KEY=...
GROQ_API_KEY=...
```

Copy the same FortyGuard/Groq values into the worker env. Do not commit `.env` files.

Manual equivalent:

```bash
pnpm setup:env
pnpm dev:infra
pnpm install
pnpm setup:simulation
```

## Develop

```bash
pnpm dev
pnpm dev:simulation
```

| Process         | URL                                |
| --------------- | ---------------------------------- |
| Web             | http://localhost:3000              |
| API live        | http://localhost:3001/health/live  |
| API ready       | http://localhost:3001/health/ready |
| Worker live     | http://localhost:3002/health/live  |
| Simulation live | http://localhost:8000/health/live  |

`/health/ready` is 503 until Mongo and Redis respond. That is intentional: missing dependencies are not faked.

## Checks

```bash
pnpm format:check
pnpm lint
pnpm check-types
pnpm test
pnpm build
```

Simulation (from `services/simulation` with the venv active):

```bash
ruff check veinguard_sim tests
mypy veinguard_sim
pytest
```

## Phase status

Phase 01 is foundation only. EPANET, FortyGuard acquisition, chemistry, and the Groq agent are later phases.
