# VeinGuard — Codex Prompts, In Order

## Usage

Use **Prompt 00** as the first prompt. Then run Prompts 01–16 as follow-ups, preferably in the same Codex conversation/worktree.

Do not merge these into one mega-prompt.

---

# Prompt 00 — Read, research, verify, plan

```text
You are the lead principal engineer for VeinGuard.

Before writing product code, read these repository documents completely:
- 00_README_FIRST.md
- AGENTS.md
- 01_PRD.md
- 02_TECHNICAL_SPECIFICATION.md
- 03_SCIENTIFIC_MODEL_SPEC.md
- 04_API_AND_DATA_CONTRACTS.md
- 05_UI_UX_SPEC.md
- 06_SECURITY_RELIABILITY_SCALABILITY.md
- 07_CODEX_BUILD_PLAN.md
- 09_ENVIRONMENT_SETUP.md
- 10_TESTING_VALIDATION_RUNBOOK.md
- 11_DEPLOYMENT_AND_COST.md
- 12_SOURCES_AND_DOCS.md
- 13_DECISIONS_AND_OPEN_QUESTIONS.md

Treat them as binding unless current official documentation proves a technical detail has changed.

Act like a very experienced staff/principal engineer who has shipped scientific production systems, temperature/climate data platforms, water-network simulation software, distributed backends, and bounded AI agents.

This must be a live-product-quality codebase, not hackathon spaghetti. Scalability, idempotency, auditability, numerical integrity, security, proper asynchronous processing, and maintainability matter.

FORTYGUARD SOURCE RULE:
Whenever implementing/changing FortyGuard, read https://docs-api.fortyguard.com/ and the exact relevant official page. Never code its contract from memory. Record which pages you consulted.

Also check current primary/official docs for:
- EPA EPANET/WNTR and EPANET-MSX if used
- Groq models/tool use/deprecations/rate limits
- Next.js
- NestJS
- MongoDB
- MapLibre
- React Flow
- BullMQ and selected Redis provider

Do not install dependencies until you verify current stable/runtime-compatible versions.

RUNTIME INTEGRITY:
- no mock FortyGuard runtime;
- no fake EPANET output;
- no random risk data;
- no canned AI-agent response;
- test doubles only in unit tests;
- benchmark network is allowed and must be labeled;
- no real infrastructure actuation.

SCIENCE:
- LLM never calculates hydraulics/chemistry;
- air temperature != water temperature;
- never call modeled water unsafe;
- do not implement unverified Monochloramine/nitrification kinetics;
- V1 nitrification is a transparent conditions indicator unless a validated biological model is implemented.

YOUR TASK IN THIS PROMPT:
1. inspect repo state;
2. read current official docs;
3. produce verified dependency/runtime matrix;
4. identify conflicts between handoff and live docs;
5. propose final repo tree;
6. propose ADR list;
7. identify MATERIAL unresolved questions only;
8. ask me those questions if genuinely blocking/high-impact;
9. do not implement product features yet.

If no material blockers, explicitly say so and tell me Prompt 01 is next.

Report:
- Verified sources
- Runtime/dependencies
- Architecture
- Conflicts/changes
- Material questions
- Next prompt
```

---

# Prompt 01 — Scaffold the monorepo

```text
Proceed with Phase 01 only.

Build the production-quality foundation:
- pnpm workspace + Turborepo
- apps/web: current stable Next.js App Router + strict TypeScript
- apps/api: NestJS strict TypeScript
- apps/worker: NestJS application-context/BullMQ worker foundation
- services/simulation: Python FastAPI package
- packages/contracts, config, ui, eslint-config, tsconfig
- local Docker Compose MongoDB + Redis
- health/live and health/ready
- validated configuration
- root scripts
- CI
- .env.example files
- local bootstrap README

No fake provider services and no business features yet.

Use current compatible stable dependencies, lock them, and explain choices.

Run format/lint/typecheck/unit/build checks that exist.

Do not start EPANET features in this prompt.

End using AGENTS.md phase-report format and say Prompt 02 is next.
```

---

# Prompt 02 — Real EPANET/WNTR foundation

```text
Proceed with Phase 02 only.

Read current official EPA/WNTR docs before coding.

Implement:
- current compatible WNTR/EPANET 2.2 in simulation service
- legitimate EPA/EPANET Net3 benchmark network with attribution/licensing/source
- SHA-256/version metadata
- .inp validation
- normalized topology
- actual hydraulic simulation
- actual water-age simulation
- structured simulation errors
- simulation API endpoints required by spec
- golden tests comparing VeinGuard wrapper outputs to direct WNTR/EPANET outputs
- invalid network tests
- WNTR/EPANET engine version reporting

Do not implement FortyGuard, Groq or chemistry yet.
Do not generate fake hydraulic data.

Run full Python test suite and relevant contract tests.
Document how to run a Net3 simulation from fresh checkout.

End with required phase report and Prompt 03.
```

---

# Prompt 03 — Thermal science engine

```text
Proceed with Phase 03 only.

Read and verify the primary water-temperature source in 03_SCIENTIFIC_MODEL_SPEC.md before implementing equations/units.

Build a versioned deterministic model:
- buried-pipe boundary with explicit lag/soil parameters
- pipe heat exchange
- hydraulic residence/contact time
- flow direction/reversal
- zero/near-zero flow
- junction mixing
- well-mixed tank energy balance
- optional solar input interface, but do not call FortyGuard yet
- validity/quality flags
- calibration/reference-profile schema
- scientific provenance

Use controlled test/science fixtures only; they must never become runtime provider fallback.

Write ADR-005.

Test limiting behavior, conservation/mixing, zero flow, reversal, units and reproducibility.

Do not implement disinfectant chemistry yet.

End with required phase report and Prompt 04.
```

---

# Prompt 04 — Free Chlorine scientific gate

```text
Proceed with Phase 04 only.

First perform the scientific/engineering gate.

Read current WNTR/EPANET water-quality docs and the primary chlorine-temperature references.

Investigate and TEST how to couple VeinGuard spatial/time-varying water temperature to chlorine reaction behavior. Do not assume EPANET supports arbitrary dynamic coefficients exactly as needed.

Build controlled:
- one-pipe network
- branched network
- constant-temperature baseline
- hot-vs-cool comparison
- state/mass sanity cases

Write ADR-006 selecting a defensible method:
- supported per-link parameterization;
- valid state-preserving stepped coupling;
- EPANET-MSX;
- or another primary-source/current-tool-supported method.

If none is scientifically defensible, STOP and ask me with the tested options. Do not hack around it.

If gate passes, implement:
- FREE_CHLORINE profile
- immutable calibration profile
- source residual
- configured operational target
- supported bulk/wall behavior
- temperature adjustment
- projected residual
- target-breach detection
- provenance/versioning

Never call target breach unsafe water.

Run and report scientific/golden tests.

End with phase report and Prompt 05.
```

---

# Prompt 05 — Monochloramine scientific gate

```text
Proceed with Phase 05 only.

Monochloramine must be a real distinct chemistry model.

Read:
- current WNTR EPANET-MSX docs
- WNTR reaction-library docs and inspect batch_chloramine_decay
- primary chloramine papers in the science/source docs
- current EPA chloramine/nitrification resources

Perform a science gate.

Choose and validate a real chemical-decay implementation with the relevant model inputs (pH, free ammonia, alkalinity, Cl/N ratio, temperature, etc. as actually required).

Do not blindly attach WNTR's batch example if its distribution/tank semantics are unsuitable.

Required validation:
- reproduce reference/known decay behavior
- temperature sensitivity
- relevant chemistry-input sensitivity
- network transport
- tank behavior documented
- validity-range rejection/warnings

Write ADR-007.

Implement:
- MONOCHLORAMINE active profile
- residual projection
- configured target
- provenance
- separate V1 nitrification-CONDITIONS indicator using transparent EPA-supported drivers

Do not claim measured nitrification, nitrite/nitrate concentration, or a probability unless a validated model supports it.

If required authoritative equations/coupling cannot be confirmed, STOP and ask me before substituting a heuristic.

Run all scientific tests.

End with phase report and Prompt 06.
```

---

# Prompt 06 — Real FortyGuard integration

```text
Proceed with Phase 06 only.

Before coding, read current official FortyGuard docs at https://docs-api.fortyguard.com/, specifically:
- Authentication
- Quickstart
- Create Heatmap
- Environmental Parameters
- Check Status
- Release Notes
- current Known Limitations/plan constraints relevant to the account

Implement from the current contract:
- server-only client
- `api-key` authentication
- typed provider-response validation
- asynchronous submission/activity_id/status polling
- request planner
- date/horizon validation
- same-day/cross-midnight splitting
- granularity/AOI validation
- required analytic types
- canonical request hashing
- completed-real-response cache
- LIVE/FORECAST/HISTORICAL/CACHED_REAL
- raw response provenance
- bounded polling/backoff/timeout
- safe provider errors
- duplicate-provider-work protection where possible

Environmental Parameters only where the thermal model has a real need, e.g. tank solar input, and respect current account limits.

There must be NO synthetic thermal fallback.

Add a live integration test only when FORTYGUARD_API_KEY and an explicit live-test flag are present.
Unit tests may mock HTTP; runtime may not.

Report exact FortyGuard pages/fields consulted.

End with phase report and Prompt 07.
```

---

# Prompt 07 — Real end-to-end baseline

```text
Proceed with Phase 07 only.

Connect:
- EPA benchmark network
- deterministic synthetic georeferencing inside an eligible demo AOI
- real FortyGuard ThermalSeries
- spatial cell-to-asset association
- real EPANET hydraulics/water age
- water-temperature model
- selected Free Chlorine or Monochloramine model
- target-breach evaluation
- provenance

Requirements:
- persist georeference transform/version;
- preserve original network coordinates;
- label benchmark + synthetic georeferencing in API/UI metadata;
- explicit no-coverage handling;
- only real completed FortyGuard data;
- baseline artifact + compact summary;
- immutable inputs/model versions reproduce result.

Add an E2E baseline test using a captured REAL FortyGuard response with full provider provenance. It is a recorded real fixture, not invented mock data.

End with phase report and Prompt 08.
```

---

# Prompt 08 — Domain, Mongo, queues, auth and SSE

```text
Proceed with Phase 08 only.

Productionize backend:
- Mongoose schemas and indexes
- organizations/users
- Argon2id auth
- access + rotating refresh tokens
- ADMIN/OPERATOR/VIEWER
- durable jobs
- BullMQ/Redis
- worker processors
- idempotency
- audit
- correlation IDs
- SSE
- OpenAPI
- global validation
- safe errors
- internal simulation service token

Long work returns queued IDs quickly.
Mongo is source of truth; Redis is broker.

Test:
- durable run survives page/process restart;
- idempotency prevents duplicate expensive work;
- worker retry behavior;
- authorization/org isolation;
- SSE reconnect/refetch.

End with phase report and Prompt 09.
```


---

# Prompt 09 — Intervention engine and deterministic optimizer

```text
Proceed with Phase 09 only.

Implement exact typed interventions after verifying actual WNTR/EPANET capabilities:
- CHANGE_PUMP_SCHEDULE
- CHANGE_PUMP_SETTING
- CHANGE_TANK_CONTROL
- CHANGE_VALVE_SETTING
- FLUSH_EVENT
- CHANGE_BOOSTER_PROFILE

Do not leave generic arbitrary control objects in production.

Each scenario:
- starts from immutable base network;
- applies validated actions to an isolated model;
- runs actual simulation;
- calculates resource metrics;
- checks hard constraints;
- stores provenance.

Implement hard constraints and a versioned deterministic objective.

Required tests:
- feasible candidate;
- candidate rejected by an actual simulated pressure/tank/etc violation;
- invalid intervention never reaches simulation;
- base network remains immutable;
- deterministic ranking;
- LLM not involved.

Add scenario comparison API.

End with phase report and Prompt 10.
```

---

# Prompt 10 — Groq agent

```text
Proceed with Phase 10 only.

Before coding, read current official Groq:
- Models
- Deprecations
- Tool Use/local tool calling
- Structured Outputs limitations
- Rate Limits

Do not use a retired model.

Use GROQ_MODEL configuration. Current handoff candidate is openai/gpt-oss-20b, but live docs win.

Build bounded VeinGuard operations agent.

The agent gets compact summaries, not full network arrays.

Use small local tool sets:
- get_zone_state
- get_network_context
- get_thermal_context
- get_baseline_summary
- simulate_scenario
- get_scenario_result
- compare_feasible_scenarios

The VeinGuard app executes tools.

Limits:
- AGENT_MAX_STEPS
- AGENT_MAX_SIMULATIONS
- wall timeout
- context cap

Enforce user constraints such as "no flushing" BEFORE candidate simulation.

Flow:
goal
-> inspect
-> candidate generation
-> strict schema validation
-> real simulations
-> deterministic hard constraints/objective
-> selected result
-> Groq concise explanation

Persist goal, tool names, validated args, result summaries/hashes, scenario IDs, selected scenario and concise rationale.

Do NOT persist/display chain-of-thought.

Add agent evaluations:
- no-flush constraint
- impossible goal/no feasible plan
- malformed tool args
- simulation failure
- Groq 429/timeout
- step limit
- simulation limit
- hard-constraint rejection
- prompt asking to bypass constraints
- prompt asking for real actuation

Manual scenarios must work if Groq is unavailable.

End with phase report and Prompt 11.
```

---

# Prompt 11 — Operations map

```text
Proceed with Phase 11 only.

Build production-quality Next.js Operations UI using current MapLibre docs.

Requirements:
- map-first layout;
- basemap configured by public env;
- real FortyGuard GeoJSON;
- benchmark network overlay;
- asset markers;
- pressure/flow/water-age/water-temperature/residual layers;
- target-breach layer;
- chemistry-aware layers;
- timeline;
- LIVE/FORECAST/HISTORICAL/CACHED_REAL;
- benchmark/georeference disclosure;
- summary cards;
- asset inspector;
- Why/drivers;
- provenance drawer;
- queued/loading/no-coverage/provider-error/simulation-error;
- accessible non-color-only status;
- fetch selected layer/time, not giant full artifact.

Free Chlorine layers:
- residual
- water age
- water temp
- target

Monochloramine:
- residual
- water age
- water temp
- nitrification conditions
- free ammonia only if actually modeled
- target

No placeholder map values.

End with phase report and Prompt 12.
```

---

# Prompt 12 — Digital Twin

```text
Proceed with Phase 12 only.

Use current @xyflow/react docs.

Build:
- Reservoir node
- Tank node
- Pump node
- Junction node
- Valve node
- Pipe edge
- pan/zoom/fit
- state styling from actual run
- selected-time sync
- upstream/downstream trace
- flow direction
- asset inspector
- map -> twin deep link
- scenario preview/before-after

Do NOT build full CAD/network editing.
Do NOT permit arbitrary topology changes.

Use actual topology and completed run metrics only.

End with phase report and Prompt 13.
```

---

# Prompt 13 — Intervention Lab and Agent UX

```text
Proceed with Phase 13 only.

Build:
- baseline/scenario branch view
- manual typed scenario editor
- run statuses
- deterministic comparison
- hard-constraint rejection explanation
- agent goal input
- structured constraint chips
- SSE events
- candidate cards
- best feasible plan
- concise explanation
- apply-to-digital-twin only
- before/after map/twin

Critical:
For the same scenario time, FortyGuard heat does not change after intervention. Only the network simulation changes.

Visible statement:
"Decision-support simulation. No real infrastructure was actuated."

End with phase report and Prompt 14.
```

---

# Prompt 14 — Resilience

```text
Proceed with Phase 14 only.

Build historical resilience studies:
- select/acquire eligible REAL FortyGuard historical events;
- reuse cached-real where exact;
- bounded concurrency;
- partial failures;
- recurrence aggregation;
- events processed/succeeded/failed;
- recurring target-breach assets/zones;
- persistence/exceedance associations only where meaningful;
- map/table;
- provenance.

Do not fabricate missing events.
Do not imply causation from simple correlation.
Always show sample size and failures.

End with phase report and Prompt 15.
```

---

# Prompt 15 — Hardening

```text
Proceed with Phase 15 only.

Perform a principal-engineer hardening pass.

Security:
- secrets
- auth
- CORS
- Helmet
- rate limiting
- upload/AOI validation
- service auth
- log redaction
- path traversal/SSRF
- dependency audit

Reliability:
- retries
- ambiguous provider submissions
- idempotency
- worker restart
- simulation timeout
- provider outage
- no fake fallback
- SSE reconnect

Scalability:
- Mongo indexes
- artifact sizes
- map payload
- worker concurrency
- Redis/BullMQ command behavior
- simulation CPU/memory
- backpressure

Accessibility:
- map controls/legend
- keyboard
- tables
- statuses
- reduced motion

Observability:
- structured logs
- correlation IDs
- health/readiness
- metrics hooks

Run/fix all required tests/builds.
Do not add speculative product features.

End with phase report and Prompt 16.
```

---

# Prompt 16 — Deployment, complete E2E, final handoff

```text
Proceed with Phase 16 and final handoff.

First re-check current official FortyGuard and Groq docs/deprecations.

Configure the selected zero-cost hackathon deployment and document a separate production topology.

Do not commit secrets.

Run as much of the full flow as credentials permit:
1. fresh DB/bootstrap
2. seeded real demo user
3. benchmark Net3 load
4. real FortyGuard historical acquisition
5. Free Chlorine baseline
6. Monochloramine baseline
7. actual target-breach scenario if a real selected event/model produces one
8. manual interventions
9. actual hard-constraint rejection case
10. Groq goal/tool loop
11. deterministic selected scenario
12. before/after
13. provenance
14. resilience smoke
15. browser E2E
16. lint/typecheck/tests/build
17. deployment smoke

If the selected real event does not produce a useful modeled breach, do not alter numbers. Transparently test other eligible real historical events and choose one whose actual behavior demonstrates the workflow.

FINAL REQUIRED RESPONSE TO ME:

A. Explain what VeinGuard now does end to end.

B. Exact repository architecture and why.

C. Complete environment-variable matrix grouped by web/API/worker/simulation:
- required/optional
- example format
- secret/public
- where I obtain each credential/value

D. Verify/update every `.env.example`.

E. Fresh-clone setup from zero:
- Node/pnpm
- Python
- Docker
- Mongo/Redis
- provider keys
- app start
- DB seed

F. How to test EACH integration:
- FortyGuard
- EPANET/WNTR
- thermal model
- Free Chlorine
- Monochloramine
- nitrification conditions
- Groq
- queues
- Operations map
- Digital Twin
- agent
- Resilience

G. Exact full demo/E2E script.

H. Deployment instructions.

I. Current cost/free-tier assumptions and limitations.

J. Security/reliability/scientific limitations.

K. All source docs used, especially current FortyGuard pages.

L. Commands/tests actually run and results.

M. Remaining TODO/blockers. Required MVP TODOs should be zero. If something required cannot be completed, say exactly why.

N. Explain the codebase as if I am the next senior engineer taking ownership.

Do not merely say "everything works." Prove it with command outputs, test results, run IDs and provider activity IDs where available.
```
