# VeinGuard — Technical Specification

**Version:** 1.0  
**Architecture:** TypeScript product platform + Python scientific service + asynchronous workers  
**Primary persistence:** MongoDB  
**AI provider:** Gemini
**Thermal provider:** FortyGuard

# 1. Architecture principles

1. Scientific computation lives in a scientific service.
2. Long-running provider/simulation/agent work is asynchronous.
3. MongoDB is the durable system of record.
4. Redis is a broker/coordination layer, not durable truth.
5. Provider calls are canonicalized, traceable and cost-aware.
6. Simulation inputs are immutable/reproducible.
7. AI actions are typed, schema-validated and bounded.
8. Feasibility/ranking is deterministic.
9. Browser receives no provider secret.
10. Required runtime never silently substitutes synthetic data.
11. Scientific models and calibration are independently versioned.
12. Benchmark network and synthetic georeferencing are first-class provenance.

# 2. Stack

## Frontend
- Next.js current stable App Router
- TypeScript strict
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Zustand for local transient UI state only
- MapLibre GL JS
- `@xyflow/react`

## API/business layer
- NestJS
- `@nestjs/mongoose`
- MongoDB
- OpenAPI
- global request validation
- Argon2id
- JWT access/refresh
- Server-Sent Events

## Jobs
- BullMQ
- Redis
- local Docker Redis
- hosted Redis configurable

## Scientific service
- Python version supported by current WNTR
- FastAPI
- Pydantic
- WNTR
- EPANET 2.2
- NumPy
- Pandas
- SciPy where justified
- EPANET-MSX only after verified installation/validation

## AI
- Gemini REST `generateContent` client
- env-configurable model
- current default candidate: `gemini-3.6-flash`
- local tool calling

# 3. Repository

```text
veinguard/
├── apps/
│   ├── web/
│   ├── api/
│   └── worker/
├── services/
│   └── simulation/
├── packages/
│   ├── contracts/
│   ├── config/
│   ├── ui/
│   ├── eslint-config/
│   └── tsconfig/
├── data/
│   ├── networks/
│   └── calibration/
├── docs/
│   ├── adr/
│   ├── scientific/
│   └── runbooks/
├── scripts/
├── docker/
├── .github/workflows/
├── AGENTS.md
├── pnpm-workspace.yaml
├── turbo.json
└── docker-compose.yml
```

# 4. Runtime topology

```text
Browser
   |
   v
Next.js
   |
   v
NestJS API ------------------------> MongoDB
   |                                   |
   +-------------------------------> Redis/BullMQ
   |                                   |
   |                                   v
   |                               Nest Worker
   |                               /   |    \
   |                              /    |     \
   v                             v     v      v
FortyGuard API              Simulation Gemini Resilience
                                  |
                                  v
                           Python FastAPI
                                  |
                                  v
                         WNTR / EPANET 2.2
                                  |
                                  v
                         Scientific models
```

# 5. Web responsibilities

`apps/web` owns:
- auth UX;
- Operations map;
- layer/timeline controls;
- asset inspector;
- Digital Twin;
- Intervention Lab;
- agent progress;
- Resilience;
- provenance display.

It does not:
- call FortyGuard directly;
- call Gemini directly;
- calculate hydraulics/chemistry;
- rank scenarios.

Suggested feature layout:

```text
src/features/
├── auth/
├── operations/
├── digital-twin/
├── interventions/
├── agent/
├── resilience/
├── provenance/
└── setup/
```

# 6. NestJS API responsibilities

Modules:

```text
AuthModule
OrganizationsModule
UsersModule
NetworksModule
NetworkVersionsModule
ChemistryProfilesModule
CalibrationProfilesModule
ThermalModule
FortyGuardModule
SimulationsModule
ScenariosModule
AgentModule
ResilienceModule
ProvenanceModule
AuditModule
JobsModule
HealthModule
```

API:
- validates;
- authorizes;
- creates durable resources;
- queues long work;
- returns run IDs quickly;
- serves run/layer summaries;
- exposes SSE;
- never blocks browser HTTP for full provider/simulation lifecycle.

# 7. Worker responsibilities

`apps/worker` is a Nest application context.

Processors:
- `FortyGuardProcessor`
- `SimulationProcessor`
- `AgentProcessor`
- `ResilienceProcessor`

Queues:
```text
fortyguard
simulation
agent
resilience

BullMQ 5+ forbids `:` in the queue name. Redis keys are namespaced with prefix `veinguard`.
```

Each job:
- domain/run ID;
- stable job type;
- idempotency key;
- correlation ID;
- bounded attempts/backoff;
- timeout;
- durable Mongo status.

# 8. Simulation service

The Python service is internal.

Suggested modules:

```text
veinguard_sim/
├── api/
├── epanet/
├── topology/
├── thermal/
├── chemistry/
│   ├── base.py
│   ├── free_chlorine.py
│   ├── monochloramine.py
│   └── nitrification_conditions.py
├── scenarios/
├── constraints/
├── provenance/
└── settings.py
```

Endpoints:
```text
GET  /health/live
GET  /health/ready
POST /v1/networks/validate
POST /v1/networks/topology
POST /v1/simulations/hydraulics
POST /v1/simulations/baseline
POST /v1/simulations/scenario
```

Stateless with respect to organizations/users.

For each run:
- isolated model/workdir;
- no global mutable WNTR network;
- temp cleanup;
- explicit timeout.

# 9. Mongo collections

```text
organizations
users
refreshTokens
networks
networkVersions
geoReferenceTransforms
chemistryProfiles
calibrationProfiles
thermalAcquisitions
thermalSnapshots
simulationRuns
simulationArtifactChunks
scenarios
scenarioRuns
agentRuns
agentEvents
resilienceStudies
jobs
auditLogs
```

Indexes must be intentional.

Examples:
- unique `{organizationId,emailNormalized}`;
- unique `{networkId,sha256}`;
- indexed `thermalSnapshots.requestHash`;
- `simulationRuns {organizationId,createdAt}`;
- `simulationRuns {status,createdAt}`;
- unique `{agentRunId,sequence}`;
- job `idempotencyKey` where semantics require.

Do not store unbounded time series in a single parent document.

# 10. Durable statuses

```text
PENDING
QUEUED
RUNNING
SUCCEEDED
FAILED
CANCELLED
PARTIAL
```

Run record:
- status;
- attempt;
- queued/started/completed timestamps;
- safe error code/message;
- correlation ID;
- worker/Bull job ID.

# 11. FortyGuard client

`FortyGuardClient` owns:
- server-side API key;
- base URL;
- connection/response timeouts;
- response schema validation;
- provider error translation.

No automatic blind retry for ambiguous POSTs that may create duplicate provider work.

# 12. FortyGuard request planner

`FortyGuardRequestPlanner` translates product-level requests to current provider-valid calls.

It must handle:
- AOI validation;
- current account plan/limits;
- 60/80/100m granularity if current docs retain them;
- live/historical/+12h bounds;
- single-hour and range filters;
- same-day range rules;
- crossing midnight;
- date ranges;
- TCM/persistence/exceedance/time-of-measure;
- threshold/direction;
- optional selected Environmental Parameters.

The planner is tested against current docs.

# 13. FortyGuard async acquisition

```text
Create ThermalAcquisition
       |
       v
enqueue provider job
       |
       v
POST FortyGuard
       |
       +--> activity_id persisted
       |
       v
poll GET status
       |
       +--> Processing: backoff
       +--> Completed: validate + persist raw/normalized
       +--> Failed: persist failure
```

Do not keep user request open.

# 14. Canonical real cache

Canonical hash includes:
- endpoint;
- normalized AOI;
- date/time/filter;
- analytic type;
- threshold/direction;
- granularity;
- selected env params;
- normalization version.

Only completed real provider output is cached.

Freshness:
- `LIVE`
- `FORECAST`
- `HISTORICAL`
- `CACHED_REAL`

`CACHED_REAL` includes original provider/fetch time.

# 15. Benchmark network ingestion

For Net3:
1. obtain/source legitimately;
2. record attribution;
3. hash original bytes;
4. parse with WNTR;
5. validate required types;
6. run EPANET smoke;
7. normalize topology;
8. persist immutable version metadata.

Normalized assets:
- RESERVOIR
- TANK
- JUNCTION
- PUMP
- VALVE
- PIPE

Keep source IDs.

# 16. Synthetic georeferencing

Benchmark network coordinates may not be WGS84.

Persist transform:
- source bounds;
- destination AOI bounds;
- scale;
- rotation if used;
- translation;
- transform algorithm/version.

Prefer deterministic affine mapping preserving relative geometry.

UI/provenance:
`SYNTHETIC_GEOREFERENCING`.

# 17. Thermal spatial association

FortyGuard Heatmap returns GeoJSON cells.

Build spatial index:
- validate polygons;
- index cell geometry;
- map node/link sample points to cell;
- persist feature/cell references per time;
- explicit `NO_THERMAL_COVERAGE`.

V1 pipe sampling:
- midpoint for short normal links;
- optionally multiple samples for links exceeding configured length threshold;
- store sampling strategy version.

# 18. Baseline simulation pipeline

```text
NetworkVersion
 + SimulationOptions
     |
     v
EPANET Hydraulics
     |
     +--> flow/pressure/tank state
     +--> Water Age
     |
ThermalSeries
     |
     v
Water-temperature model
     |
     v
asset/time water-temperature state
     |
ChemistryProfile + Calibration
     |
     v
chemistry transport/coupling
     |
     v
residual state
     |
     v
target + constraint evaluation
     |
     v
artifact + summary + provenance
```

Numerical coupling details are binding in `03_SCIENTIFIC_MODEL_SPEC.md`.

# 19. Scenario isolation

Never modify persisted base network.

Scenario run:
1. load immutable base network/version;
2. instantiate isolated copy;
3. apply typed interventions;
4. run actual model;
5. compute constraints/objective inputs;
6. dispose local model;
7. persist artifacts.

# 20. Intervention schemas

Required discriminated union:
- `CHANGE_PUMP_SCHEDULE`
- `CHANGE_PUMP_SETTING`
- `CHANGE_TANK_CONTROL`
- `CHANGE_VALVE_SETTING`
- `FLUSH_EVENT`
- `CHANGE_BOOSTER_PROFILE`

Every type:
- compatible asset type;
- validated numeric ranges;
- start/end/time horizon validation;
- versioned schema.

No arbitrary EPANET command text.

# 21. Hard constraints

Examples:
- simulation converged;
- pressure >= configured minimum;
- pressure <= configured maximum;
- tank level bounds;
- pump valid;
- valve valid;
- no required service disconnection;
- explicit user constraints.

Result:
```json
{
  "constraintId":"pressure.min",
  "severity":"HARD",
  "passed":false,
  "assetIds":["J-22"],
  "timeIndices":["..."],
  "observed":12.4,
  "limit":14,
  "units":"m",
  "message":"Pressure fell below configured minimum."
}
```

# 22. Deterministic objective

Among feasible candidates only.

Conceptual objective:
```text
w1 * residual_deficit_integral
+ w2 * target_breach_count
+ w3 * flush_water
+ w4 * chemical_increment
+ w5 * energy_delta
+ w6 * switching_complexity
```

Exact weights/units:
- versioned;
- documented;
- not selected by LLM;
- may be scenario/organization configuration.

# 23. Gemini agent architecture

State machine:

```text
RECEIVE_GOAL
 -> PARSE_CONSTRAINTS
 -> INSPECT
 -> BASELINE
 -> GENERATE_CANDIDATES
 -> VALIDATE
 -> SIMULATE
 -> COMPARE
 -> EXPLAIN
 -> COMPLETE
```

Terminal alternatives:
- `FAILED`
- `LIMIT_REACHED`
- `NO_FEASIBLE_SCENARIO`

# 24. Gemini tools

Keep each call focused.

Investigation tools:
- `get_zone_state`
- `get_network_context`
- `get_thermal_context`
- `get_baseline_summary`

Action/decision tools:
- `simulate_scenario`
- `get_scenario_result`
- `compare_feasible_scenarios`

Prefer one strict `simulate_scenario` over many near-duplicate LLM tools.

# 25. Agent bounds

Environment-driven:
- max steps;
- max candidate scenarios;
- max actual simulations;
- max wall-clock time;
- max summary/context bytes/tokens.

The backend enforces structured user constraints before simulation.

# 26. Agent ranking rule

```text
Gemini candidate
 -> schema validation
 -> user-constraint validation
 -> actual simulation
 -> hard constraints
 -> deterministic objective
 -> selected candidate
 -> Gemini explanation
```

Gemini cannot override a rejection.

# 27. Agent persistence

Persist:
- original operator goal;
- structured constraints;
- model ID;
- tool names;
- validated args;
- result summaries/hashes;
- scenario IDs;
- deterministic selected scenario;
- concise rationale;
- timestamps.

Do not persist chain-of-thought.

# 28. Simulation artifacts

`simulationRuns` stores compact summary.

Large data stored in chunks by:
- run;
- variable;
- time window.

Variables:
- PRESSURE
- FLOW
- WATER_AGE
- WATER_TEMPERATURE
- RESIDUAL
- optional chemistry-specific state.

Never place large arrays in Redis.

Layer API should fetch one variable/time range, not full run.

# 29. Public API conventions

Base:
```text
/v1
```

Long-run create:
- validate;
- create durable record;
- enqueue;
- return `202`.

Success:
```json
{"data":{},"meta":{"correlationId":"..."}}
```

Error:
```json
{
  "error":{
    "code":"SIMULATION_CONVERGENCE_FAILED",
    "message":"The simulation did not converge.",
    "correlationId":"..."
  }
}
```

# 30. Key API routes

```text
POST /v1/auth/login
POST /v1/auth/refresh
POST /v1/auth/logout

GET  /v1/networks
GET  /v1/networks/:id
GET  /v1/networks/:id/topology

POST /v1/thermal/acquisitions
GET  /v1/thermal/acquisitions/:id
GET  /v1/thermal/snapshots/:id

POST /v1/simulation-runs
GET  /v1/simulation-runs/:id
GET  /v1/simulation-runs/:id/layers/:layer

POST /v1/scenarios
POST /v1/scenarios/:id/run
POST /v1/scenarios/compare

POST /v1/agent-runs
GET  /v1/agent-runs/:id
GET  /v1/agent-runs/:id/events/stream

POST /v1/resilience-studies
GET  /v1/resilience-studies/:id

GET  /v1/provenance/:runId
```

# 31. SSE

Events:
- job.queued
- job.started
- provider.submitted
- provider.processing
- provider.completed
- simulation.started
- simulation.completed
- scenario.rejected
- agent.tool.started
- agent.tool.completed
- agent.completed
- error

SSE payload is progress, not canonical full state. UI re-fetches resource after important terminal event.

# 32. Authentication

- Argon2id;
- access token short lived;
- refresh token rotated;
- only refresh-token hash stored;
- revoke on logout;
- roles ADMIN/OPERATOR/VIEWER;
- organization isolation on every resource.

Demo user is seeded via real DB seed, not frontend bypass.

# 33. Security

- secrets server-only;
- no `NEXT_PUBLIC_` secret;
- log redaction;
- CORS allow-list;
- Helmet;
- rate limits;
- request size limit;
- AOI geometry complexity limit;
- `.inp` upload safety;
- no arbitrary URL fetch;
- internal simulation token;
- service timeouts;
- no real sensitive infrastructure data without authorization.

# 34. Observability

Structured logs:
- service;
- level;
- correlation ID;
- job/run ID;
- provider activity ID;
- latency;
- status.

Never log credentials/tokens.

Metrics hooks:
- provider call count/cache hit;
- queue depth/wait;
- simulation latency/failure;
- agent steps/simulations;
- Gemini latency/failure;
- SSE connection count.

# 35. Performance

- no EPANET on normal read endpoints;
- simulation queued;
- cached topology;
- spatial index for thermal cells;
- selected layer/time API;
- response compression;
- bounded worker concurrency;
- no unbounded batch;
- resilience lower priority than interactive work.

# 36. Local development

Docker Compose:
- MongoDB;
- Redis.

Apps:
```text
pnpm dev:web
pnpm dev:api
pnpm dev:worker
pnpm dev:simulation
```

Root `pnpm dev` should orchestrate once implemented.

Provider integrations require real credentials. Science-only tests can run without them.

# 37. CI

Required:
1. frozen JS install;
2. format;
3. lint;
4. typecheck;
5. JS unit/integration tests;
6. Python install;
7. Python lint/typecheck/tests;
8. build web/api/worker;
9. simulation Docker build;
10. contract tests;
11. local E2E science path;
12. optional live provider suite behind explicit secrets/flags.

# 38. Deployment

Production-minded deployables remain:
- web;
- API;
- worker;
- simulation;
- MongoDB;
- Redis.

Hackathon may co-locate API + worker if free hosting requires it, but code boundaries stay separable.

# 39. Required ADRs

- ADR-001 service/monorepo boundaries
- ADR-002 queues and durable jobs
- ADR-003 benchmark network/georeferencing
- ADR-004 FortyGuard acquisition/cache
- ADR-005 water-temperature model
- ADR-006 Free Chlorine coupling
- ADR-007 Monochloramine + nitrification scope
- ADR-008 Groq agent boundary (superseded)
- ADR-011 Gemini agent boundary
- ADR-009 simulation artifact storage
- ADR-010 hackathon vs production deployment
