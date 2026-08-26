# Docker

Local development currently runs **MongoDB** and **Redis** from the repository-root `docker-compose.yml`.

```bash
docker compose up -d --wait
```

Compose binds Mongo `27017` and Redis `6379`. If those ports are already taken by another local stack, either stop that stack or point `MONGODB_URI` / `REDIS_URL` at the existing instances.

The simulation service image lives at `services/simulation/Dockerfile` and must be built from the repository root so `data/networks` is included:

```bash
docker build -f services/simulation/Dockerfile -t veinguard-simulation .
```

## Render Free Docker deployment

The Render deployment uses one `Web Service` on the Free plan. It is not a
Render Background Worker: `docker/render/supervisor.mjs` runs the API,
BullMQ worker, simulation service, Next.js app, and the gateway in one
container. `docker/render/gateway.mjs` exposes the public routes:

| Public path     | Container process                               |
| --------------- | ----------------------------------------------- |
| `/`             | Next.js web app                                 |
| `/api/*`        | Nest API, with `/api` stripped                  |
| `/simulation/*` | FastAPI simulation, with `/simulation` stripped |
| `/worker/*`     | Worker health endpoints only                    |

In Render, create **New → Web Service**, connect this repository, select
**Docker**, and set:

```text
Dockerfile path: docker/Dockerfile.render
Docker build context: .
Instance type: Free
Health check path: /health/live
```

Leave Render's **Build Command**, **Start Command**, and Docker command blank.
The Dockerfile performs the build and its `CMD` starts the supervisor, exactly
as in the Collage deployment pattern.

Do not create a Render MongoDB, Postgres, Redis, Key Value, Background Worker,
or second web service for this topology. Add the custom domain
`veinguard.oluwadunsin.dev` to this one Web Service. Render's managed TLS will
then cover the domain; DNS should point the `veinguard` subdomain at the
service hostname shown by Render.

Required environment variables:

```env
NODE_ENV=production
APP_BASE_URL=https://veinguard.oluwadunsin.dev
CORS_ORIGINS=https://veinguard.oluwadunsin.dev

MONGODB_URI=
MONGODB_DB_NAME=veinguard
REDIS_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

SIMULATION_SERVICE_TOKEN=<random secret, at least 16 characters>

FORTYGUARD_API_BASE_URL=https://api.fortyguard.com
FORTYGUARD_API_KEY=<real FortyGuard key, if thermal acquisition is enabled>

GEMINI_API_KEY_1=<server-only Gemini key, if the agent is enabled>
GEMINI_API_KEY_2=<optional>
GEMINI_API_KEY_3=<optional>
GEMINI_API_KEY_4=<optional>
GEMINI_MODEL=gemini-3.6-flash

NEXT_PUBLIC_API_BASE_URL=/api/v1
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_MAP_STYLE_URL_LIGHT=https://tiles.openfreemap.org/styles/positron
NEXT_PUBLIC_MAP_STYLE_URL_DARK=https://tiles.openfreemap.org/styles/dark
```

`SIMULATION_SERVICE_TOKEN` is injected into the simulation child process as its
`SERVICE_TOKEN`; it only needs to be supplied once. The supervisor assigns
the internal simulation URL (`http://127.0.0.1:8000`) and ports (`3000`,
`3001`, `3002`, `8000`) and leaves Render's public `PORT` for the gateway
(`10000`). Do not set the four internal ports as the Render service port.
`STARTUP_TIMEOUT_MS` is optional; it defaults to `120000` so a remote Mongo
connection has time to establish during a cold start.

Optional tuning variables can be copied from the environment specification in
`docs/09_ENVIRONMENT_SETUP.md`. The image supplies safe demo defaults for
simulation data paths and model versions.

Verify after deployment:

```bash
curl -fsS https://veinguard.oluwadunsin.dev/health/live
curl -fsS https://veinguard.oluwadunsin.dev/api/health/live
curl -fsS https://veinguard.oluwadunsin.dev/simulation/health/live
curl -fsS https://veinguard.oluwadunsin.dev/health/ready
```

The first request after 15 minutes of inactivity can take roughly a minute on
Render Free while the container starts. The Free workspace also has a shared
monthly instance-hour allowance, and the container filesystem is ephemeral;
MongoDB and Redis are the durable stores. This is suitable for a hackathon
demo, not an always-on production water-operations system.
