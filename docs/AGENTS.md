# AGENTS.md — VeinGuard Persistent Repository Instructions

## Mission

Build VeinGuard as a production-minded, auditable heat-aware drinking-water distribution digital twin and decision-support system.

Act like a senior staff/principal engineer experienced in scientific systems, distributed processing, temperature/climate data, water-network simulation, and bounded AI agents.

## Non-negotiable rules

### 1. No mocked required runtime behavior
Forbidden in runtime:
- `MOCK_MODE`;
- synthetic FortyGuard fallback;
- random hydraulic/water-quality values;
- canned AI recommendations;
- fake success responses.

Allowed:
- unit-test doubles inside tests;
- controlled scientific test fixtures;
- official benchmark network data;
- captured **real** provider responses for deterministic replay tests, with provenance.

### 2. Benchmark data must be honest
- EPA/EPANET benchmark network is acceptable.
- Label it `EPA_BENCHMARK`.
- Synthetic geographic placement is `SYNTHETIC_GEOREFERENCING`.
- Never imply benchmark assets are a real city's infrastructure.

### 3. Always source current FortyGuard docs
Before changing FortyGuard integration, read current official docs at:
- https://docs-api.fortyguard.com/
- the exact endpoint page;
- authentication;
- status checking;
- release notes;
- known limitations/constraints if relevant.

Current docs override this handoff if a provider contract changed.

### 4. Primary sources for science
Use:
- EPA EPANET/WNTR official docs;
- EPANET-MSX official docs if used;
- peer-reviewed primary research for thermal/chemistry models.

Do not copy unexplained formulas/constants from blogs.

### 5. Groq is not the physics engine
Groq may:
- interpret an operator goal;
- request compact system context;
- propose typed candidate interventions;
- decide which simulation tool to call;
- summarize deterministic results.

Groq must not:
- calculate hydraulics;
- invent residual values;
- bypass hard constraints;
- numerically rank scenarios itself;
- actuate real infrastructure.

### 6. No real-world actuation in V1
"Apply" means **Apply to Digital Twin**.

### 7. Scientific claim boundaries
Do not call model output "unsafe water."
Use:
- modeled residual;
- configured operational target;
- projected target breach;
- nitrification-favorable conditions.

### 8. Chemistry profiles
Required active V1:
- `FREE_CHLORINE`
- `MONOCHLORAMINE`

Disabled coming soon:
- `CHLORINE_DIOXIDE`
- `ADVANCED_MULTI_SPECIES`

Monochloramine must be a real distinct chemistry model, not renamed chlorine.

### 9. Nitrification
V1 may expose a transparent conditions/risk indicator using documented factors. Do not claim microbial kinetics, nitrite/nitrate concentration, or a probability unless a validated model is actually implemented.

### 10. Ask only for material uncertainty
Stop and ask the user if uncertainty would materially affect:
- scientific validity;
- safety/claims;
- major architecture;
- costs;
- provider contract;
- irrecoverable data model.

Do not ask about ordinary implementation details that can be resolved from current official docs.

## Engineering standards

Write:
- strict TypeScript/Python types;
- cohesive modules;
- explicit validation;
- explicit failure states;
- idempotent jobs;
- bounded retries;
- durable audit/provenance;
- deterministic simulations;
- structured logging;
- correlation IDs;
- testable scientific logic;
- documented assumptions.

Avoid:
- `any` except isolated external boundaries;
- giant services;
- global mutable state;
- magic numeric constants;
- duplicated DTO definitions;
- unbounded `Promise.all`;
- unbounded agent loops;
- full network arrays in LLM prompts;
- client-side secrets;
- local filesystem as durable production state.

## Dependency policy

Before adding packages:
1. verify current stable version;
2. verify runtime compatibility;
3. verify license;
4. prefer mature primary packages;
5. avoid redundant libraries;
6. lock dependencies.

## Service boundaries

### `apps/web`
- Next.js App Router;
- MapLibre;
- React Flow;
- TanStack Query;
- Zustand only for justified local transient state;
- no direct FortyGuard/Groq secrets or calls.

### `apps/api`
- NestJS;
- authentication/authorization;
- domain APIs;
- Mongo durable state;
- enqueue long work;
- SSE;
- provenance/audit.

### `apps/worker`
- Nest application context;
- BullMQ processors for FortyGuard, simulation, agent and resilience jobs.

### `services/simulation`
- Python/FastAPI;
- WNTR/EPANET;
- topology;
- thermal model;
- Free Chlorine model;
- Monochloramine model;
- nitrification-conditions model;
- scenario application;
- numerical constraint outputs.

No user-auth/product UI logic belongs here.

## Queue rules

Queues:
- `fortyguard`
- `simulation`
- `agent`
- `resilience`

Every task needs:
- stable type;
- idempotency key;
- durable Mongo status;
- bounded attempts;
- backoff;
- timeout;
- correlation ID;
- explicit terminal failure.

Redis is not the durable source of truth.

## API rules

Nest global validation must reject unknown/invalid data.

Version routes under `/v1`.

Errors:
- machine code;
- safe user message;
- correlation ID.

Never leak provider secrets/errors verbatim.

Simulation service must have internal service authentication and timeouts.

## Provenance

Every simulation stores:
- network/version/checksum;
- source classification;
- georeference transform/version;
- FortyGuard snapshot IDs and activity IDs;
- data freshness;
- canonical request hash;
- WNTR/EPANET versions;
- thermal model/version;
- chemistry model/version;
- calibration profile/version;
- selected chemistry profile;
- scenario parameters;
- agent run ID if applicable.

## Scientific model versioning

Version separately:
- `THERMAL_MODEL_VERSION`
- `FREE_CHLORINE_MODEL_VERSION`
- `MONOCHLORAMINE_MODEL_VERSION`
- `NITRIFICATION_RISK_MODEL_VERSION`

Any change capable of changing numerical outputs requires regression review and model-version bump.

## Groq rules

Default candidate at handoff:
```text
openai/gpt-oss-20b
```

Must remain configurable with `GROQ_MODEL`.

Before deployment re-read:
- https://console.groq.com/docs/models
- https://console.groq.com/docs/deprecations
- https://console.groq.com/docs/tool-use/overview
- https://console.groq.com/docs/rate-limits

Use local tool calling. Keep tool sets small. Validate every argument.

Bound:
- max steps;
- max simulations;
- wall time;
- context/prompt size.

Do not persist/display private chain-of-thought. Persist tool events and concise rationale only.

## FortyGuard rules

The provider API is asynchronous.

Implement:
1. submit;
2. persist `activity_id`;
3. poll in worker;
4. persist Completed raw + normalized result;
5. explicit Failed state.

Cache completed real responses using canonical request hash. A cache hit is `CACHED_REAL`, never `LIVE`.

Request planner must handle current date/filter/AOI/granularity constraints and cross-midnight windows.

## Scientific implementation gate

Before production chemistry coupling:
1. controlled small-network tests;
2. prove direct EPANET/WNTR behavior;
3. prove temperature-model behavior;
4. test chosen chemistry coupling method;
5. write ADR;
6. compare with primary-source/known curve or controlled expected result.

If state continuity/coupling cannot be implemented defensibly, do not fake it. Present options and ask the user.

## UI rules

- source/freshness visible;
- heat does not change after a water-network intervention;
- unknown/no-data is not green;
- status is not color-only;
- every highlighted risk has a `Why?`;
- scenario metrics come only from completed simulation;
- coming-soon profiles are disabled;
- queued/stale/cached/failed/no-coverage states are first-class.

## Security

- secrets server-only;
- redact credentials;
- Helmet/CORS/rate limits;
- Argon2id;
- short-lived access + rotating refresh;
- no arbitrary URL fetch from user input;
- validate/upload `.inp` safely;
- no sensitive real infrastructure in hackathon unless authorized.

## End-of-phase report required

After each Codex phase report:
1. Implemented
2. Key files changed
3. Architecture/science decisions
4. Tests/commands run and results
5. Environment variables added/changed
6. Manual verification
7. Known limitations
8. Material user question, only if blocking/high-impact
9. Next prompt

Final phase must additionally give:
- complete env matrix and credential sources;
- fresh-clone setup;
- full E2E test flow;
- deployment;
- exact model assumptions;
- unresolved risks;
- codebase explanation for a new senior engineer.
