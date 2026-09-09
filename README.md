# VeinGuard

## A heat-aware drinking-water distribution digital twin

[![CI](https://github.com/benjaminnkem/veinguard/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/benjaminnkem/veinguard/actions/workflows/ci.yml)
[![Live demo](https://img.shields.io/badge/live%20demo-veinguard.oluwadunsin.dev-1769B0)](https://veinguard.oluwadunsin.dev)
[![Built for FortyGuard Hackathon'26](https://img.shields.io/badge/built%20for-FortyGuard%20Hackathon'26-15181F)](https://www.fortyguard.com/hackathon26)

![VeinGuard](apps/web/public/brand/veinguard_logo_cover.png)

> Heat does not stop at the city boundary. It enters the water network through residence time, exposed storage, pipe heat transfer, and disinfectant chemistry. VeinGuard turns that hidden chain into a traceable operational decision.

**Live demo:** [veinguard.oluwadunsin.dev](https://veinguard.oluwadunsin.dev)<br />
**Repository:** [github.com/benjaminnkem/veinguard](https://github.com/benjaminnkem/veinguard)<br />
**Challenge:** [FortyGuard Hackathon’26 — Building the World’s Temperature AI](https://www.fortyguard.com/hackathon26)

VeinGuard is a production-minded prototype for a problem that is easy to describe badly: a water utility may know that a heat event is occurring, and may know the network’s hydraulic state, yet still lack a workflow that connects the two. The result is a gap between environmental intelligence and operational action.

VeinGuard closes that gap with a deliberately bounded chain:

```text
FortyGuard hyperlocal ambient temperature
              ↓
temperature-to-network association
              ↓
EPANET hydraulics + water age
              ↓
modeled water temperature
              ↓
Free Chlorine or Monochloramine residual
              ↓
projected operational-target breach
              ↓
typed intervention scenarios
              ↓
hard-constraint validation
              ↓
deterministic ranking
              ↓
operator explanation and digital-twin preview
```

The important distinction is that VeinGuard does not answer only “where is it hot?” It answers a more useful and more defensible question:

> Given the thermal conditions affecting this modeled distribution network, where is a configured water-quality operational target projected to be breached, when might that happen, what modeled factors explain it, and which feasible intervention performs best when simulated against the network?

This is decision support, not autonomous control. It does not actuate pumps, valves, tanks, or chemical systems in the real world. “Apply” means **Apply to Digital Twin**.

---

## Why this matters

Drinking-water distribution systems are dynamic physical systems. Water can travel through reservoirs, pumps, valves, pipes, storage tanks, dead ends, and mixed-flow junctions before it reaches a monitoring point. The state observed at the end of that journey is not determined by air temperature alone.

Heat changes the context in which the network operates:

- higher environmental temperature changes the thermal boundary condition around exposed or shallow infrastructure;
- pipe and tank heat transfer changes the modeled water-temperature state over residence time;
- residence time and water age determine how long water remains exposed to decay and stagnation effects;
- flow direction, mixing, tank turnover, and operational controls change the path a parcel of water takes;
- temperature-dependent disinfectant decay can move a modeled residual toward or below a configured operational target;
- under a monochloramine profile, high water age, elevated water temperature, low residual, and free ammonia can create conditions favorable for nitrification.

The utility problem is therefore not a single heatmap problem and not a single chemistry problem. It is a systems problem. A high-resolution heat layer becomes operationally meaningful only when it can be associated with network assets, propagated through a deterministic model, compared with explicit constraints, and explained to a human operator.

That is the product VeinGuard demonstrates.

---

## Built for the FortyGuard brief

FortyGuard Hackathon’26 asks builders to create AI applications on top of FortyGuard’s hyperlocal temperature intelligence and turn that data into real-world impact. The official brief describes seven challenge tracks and scores projects on impact and relevance, technical execution, innovation, and communication. VeinGuard is intentionally a cross-track submission:

| FortyGuard track                      | How VeinGuard contributes                                                                                                                     |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Resilient Cities & Infrastructure** | Shows how heat intelligence can support a resilient drinking-water distribution network and prioritize operational attention.                 |
| **Industrial & Enterprise**           | Converts a temperature field into an auditable workflow for operators, water-quality engineers, and resilience planners.                      |
| **Government & Environment**          | Presents heat-aware infrastructure evidence without pretending that a benchmark network is a real city utility.                               |
| **Model Designing**                   | Couples hyperlocal environmental input with hydraulic, thermal, and chemistry models while preserving model versions and validity boundaries. |
| **Agentic AI**                        | Uses Gemini as a bounded operations agent that calls typed local tools, requests simulations, and explains deterministic results.             |
| **Data Analysis & Correlation**       | Replays historical FortyGuard events to identify recurring modeled heat exposure and target-breach patterns.                                  |

The implementation is also shaped around the published judging dimensions:

| Judging dimension             | Evidence in this submission                                                                                                                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Impact & Relevance — 40%**  | A concrete climate-infrastructure use case: connect heat exposure to drinking-water network state, identify modeled target stress, and support a constrained operational response.                                           |
| **Technical Execution — 35%** | Real asynchronous FortyGuard acquisition, WNTR/EPANET execution, versioned thermal and chemistry operators, durable jobs, authenticated service boundaries, typed interventions, isolation tests, and deterministic ranking. |
| **Innovation — 15%**          | A bridge between urban heat intelligence and water-network decision support, with a bounded AI agent orchestrating the workflow without being allowed to become the physics engine or actuator.                              |
| **Communication — 10%**       | A map-first interface, Digital Twin, Intervention Lab, “Why?” explanations, visible freshness and failure states, provenance drawer, live demo, reproducible setup, and explicit scientific limitations.                     |

The project uses FortyGuard as a meaningful environmental dependency, not as a decorative map layer. Without the provider’s granular temperature field, the network cannot receive the same spatially resolved thermal boundary condition. Without the hydraulic and chemistry model, the heat field would not become a defensible operational decision.

See the [official hackathon brief](https://www.fortyguard.com/hackathon26) and the [current FortyGuard API documentation](https://docs-api.fortyguard.com/) for the provider context.

---

## What we built

### 1. A real FortyGuard acquisition path

The backend integrates with the official FortyGuard Temperature API contract:

1. validate a product request and its area/time/granularity constraints;
2. plan provider-valid request slices, including cross-midnight windows;
3. submit an asynchronous heatmap request server-side;
4. persist the provider `activity_id` before polling;
5. poll the provider status endpoint until `Processing`, `Completed`, or `Failed`;
6. validate the completed response and normalize its GeoJSON map data and statistics;
7. persist the raw response and provenance in MongoDB;
8. reuse an exact completed response through a canonical request hash as `CACHED_REAL`.

The browser never receives the FortyGuard API key. A missing provider key results in an explicit unavailable state. A provider outage never causes VeinGuard to invent a temperature field, return a canned success, or silently relabel stale data as live.

The integration follows the current provider pattern of `POST /v1/heatmap` followed by `GET /v1/status/{activity_id}`. The provider-specific implementation and documentation record are in [`packages/fortyguard`](packages/fortyguard), [`docs/adr/ADR-004-fortyguard-acquisition.md`](docs/adr/ADR-004-fortyguard-acquisition.md), and [`docs/12_SOURCES_AND_DOCS.md`](docs/12_SOURCES_AND_DOCS.md).

### 2. An honest network foundation

The demo uses **EPA EPANET Example Network 3 (Net3)**. It is shipped as a benchmark model, labeled throughout the product as:

```text
sourceType: EPA_BENCHMARK
networkId: epa-net3
```

Net3 is not presented as the infrastructure of New York, Phoenix, or any other real city. Its original EPANET drawing coordinates are placed inside a small demo area using a versioned, deterministic affine transformation:

```text
geoReferenceType: SYNTHETIC_GEOREFERENCING
geoReferenceVersion: synthetic-georef-v1
algorithm: UNIFORM_SCALE_CENTERED_AFFINE
```

The placement lets the model associate network assets with FortyGuard cells while preserving the benchmark topology and hydraulic lengths. It does not create a false claim about real utility ownership or real-world geography. The transformation, source classification, and SHA-256 checksum are visible in provenance and stored in [`data/georeference/synthetic-georef-v1.json`](data/georeference/synthetic-georef-v1.json).

### 3. Actual EPANET hydraulics and water age

VeinGuard calls WNTR and EPANET 2.2 for the network calculations that should remain network calculations. The baseline and scenario paths use actual hydraulic execution for:

- pressure and head;
- link flow and direction;
- velocity where available;
- tank state and level constraints;
- convergence status;
- water age.

The Python service does not return a random pressure field or a prewritten scenario answer. A non-convergent or unavailable simulation is a visible failure state. A scenario is not considered feasible simply because an AI model proposed it.

### 4. A temperature model that does not confuse air with water

FortyGuard provides an ambient air-temperature boundary condition at approximately 2 m above ground. It does **not** directly measure the temperature of water inside the demo network. VeinGuard keeps those quantities separate.

The `water-temp-v1` model uses:

- a pipe heat-transfer operator that moves water toward a local boundary temperature over hydraulic residence time;
- a first-order soil-temperature lag for buried infrastructure;
- a well-mixed energy balance for tanks;
- explicit flow, stagnation, reversal, and mixing flags;
- versioned calibration metadata and a literature-reference profile.

The core pipe relationship is represented as:

```text
T_out = T_b + (T_in - T_b) exp(-k τ)
k     = 4U / (ρ c_p D)
```

where `T_b` is the modeled boundary temperature and `τ` is the hydraulic residence time. The model is deliberately explicit about its status: the bundled coefficients are a benchmark demonstration profile, not a utility hold-study calibration.

### 5. Two distinct active chemistry profiles

VeinGuard supports two active V1 disinfection profiles. They are not aliases with different labels.

#### Free Chlorine

The `free-chlorine-v1` profile uses temperature-dependent first-order bulk decay on hydraulic residence times:

```text
dC/dt     = -k(T) C
C_out     = C_in exp(-k(T) τ)
k(T)      = k_ref θ^(T - T_ref)
```

The bundled literature-reference profile uses `T_ref = 20 °C`, `θ = 1.05`, and a bulk decay coefficient of `0.5/day`; wall reaction is off for this V1 bulk analogue. Junctions mix residuals by flow, and tanks use a well-mixed CSTR-style update.

#### Monochloramine

The `monochloramine-v1` profile is a separate residual operator. It uses a temperature-dependent first-order decay rate derived from published half-life behavior at pH 7.5:

- approximately 300 h at 4 °C, implemented as a conservative bound for a source described as “over 300 h”;
- 75 h at 35 °C;
- log-linear interpolation of the rate between those points.

Free ammonia is transported conservatively in V1. pH, alkalinity, and chlorine-to-nitrogen ratio are validated and provenance-bearing inputs; they are not used to invent unsupported kinetic terms. This is intentionally not described as the full Vikesland/Jafvert–Valentine multi-species mechanism or as a drop-in WNTR MSX model.

#### Nitrification conditions indicator

For Monochloramine, VeinGuard exposes a transparent categorical indicator with versioned drivers:

| Driver                             | V1 planning threshold |
| ---------------------------------- | --------------------: |
| High water age                     |              `≥ 48 h` |
| Elevated modeled water temperature |             `≥ 15 °C` |
| Low monochloramine residual        |          `< 1.5 mg/L` |
| Free ammonia present               |       `≥ 0.05 mg-N/L` |

The UI says **“Conditions favorable for nitrification.”** It does not claim that nitrification will occur, does not output a microbial probability, and does not invent nitrite or nitrate concentrations. The indicator is a transparent operational signal for follow-up, not a compliance or laboratory result.

The model cards and decisions are documented in [`docs/scientific`](docs/scientific), [`docs/adr/ADR-005-water-temperature-model.md`](docs/adr/ADR-005-water-temperature-model.md), [`docs/adr/ADR-006-free-chlorine-coupling.md`](docs/adr/ADR-006-free-chlorine-coupling.md), and [`docs/adr/ADR-007-monochloramine-nitrification.md`](docs/adr/ADR-007-monochloramine-nitrification.md).

### 6. A scenario engine with hard boundaries

Operators can create and simulate typed interventions:

- change pump schedule;
- change pump setting;
- change tank control or initial level;
- change valve setting;
- run a flush event;
- change a booster concentration profile.

Every candidate is applied to a deep-copied WNTR model. The persisted base network is checked for mutation before and after the run. Each scenario then runs the actual hydraulic, thermal, and chemistry path, and is checked against hard constraints such as:

- EPANET convergence;
- minimum pressure;
- maximum pressure;
- tank level bounds;
- intervention validity and supported IDs;
- user-declared restrictions such as “no flushing.”

Hard-constraint violations are not merely warnings. A rejected scenario cannot be recommended by the agent and is retained with its rejection reason for operator review.

Feasible scenarios are scored by a deterministic configured objective, not by the LLM. The demo objective can account for:

- residual deficit integral;
- target-breach count;
- flushed water volume;
- chemical increment;
- energy delta or pump-energy proxy;
- switching complexity.

Weights and model versions are stored in [`data/objective/demo-objective-v1.json`](data/objective/demo-objective-v1.json), and the hard constraints are stored in [`data/constraints/demo-constraints-v1.json`](data/constraints/demo-constraints-v1.json).

### 7. Gemini as an operations agent, not a physics engine

The operations agent uses Gemini through local function calling. It receives compact, bounded context and can:

- inspect a compact baseline summary;
- inspect one modeled zone or its upstream/downstream neighborhood;
- inspect associated thermal context;
- propose typed interventions;
- request scenario simulations;
- inspect scenario results;
- request deterministic comparison of completed scenarios;
- write a concise operator-facing rationale.

Gemini cannot:

- calculate hydraulics or chemistry itself;
- fabricate a temperature, residual, pressure, or water-age value;
- bypass hard constraints;
- choose an infeasible scenario;
- send an arbitrary intervention type to the simulator;
- actuate real infrastructure;
- persist or display private chain-of-thought.

The agent is bounded by maximum steps, maximum simulations, wall time, prompt/context size, and per-provider-call timeout. Up to four server-only Gemini keys can be attempted in priority order for quota/rate-limit exhaustion. All-key exhaustion is an explicit failure, not a fallback to a canned recommendation.

The default model is configurable through `GEMINI_MODEL` and is set to `gemini-3.6-flash` for the hackathon build. The boundary is implemented in [`packages/agent`](packages/agent) and documented in [`docs/adr/ADR-011-gemini-agent-boundary.md`](docs/adr/ADR-011-gemini-agent-boundary.md).

### 8. Historical resilience replay

The Resilience surface takes historical FortyGuard hours and replays them against the benchmark network. It records:

- requested, succeeded, and failed/missing events;
- sample size;
- real or cached-real provider status;
- mean environmental temperature and high-heat assets;
- projected target-breach assets when chemistry replay is enabled;
- persistence and exceedance availability;
- provider activity IDs and request hashes.

This is designed to surface recurring modeled vulnerability and planning priorities. It does not claim that a correlation proves causality, and it does not convert the benchmark into a real city network.

---

## The product surfaces

### Operations map

The map-first operational workspace overlays:

- FortyGuard TCM heat cells;
- network assets and links;
- flow and pressure state;
- water age;
- modeled water temperature;
- Free Chlorine or Monochloramine residual;
- projected operational-target breaches;
- Monochloramine nitrification-condition levels where applicable.

It includes a time slider, asset inspection, a “Why?” explanation area, and a provenance drawer. Heat data, freshness, benchmark status, and synthetic georeferencing remain visible so that a visually persuasive map cannot be mistaken for a live utility GIS.

### Digital Twin

The Digital Twin is an interactive React Flow schematic of reservoirs, tanks, pumps, valves, junctions, and pipes. It supports pan/zoom, asset selection, flow direction, upstream/downstream tracing, state coloring, time selection, and before/after scenario preview.

The schematic is a decision-support view of the model. It is not a CAD editor and does not expose a control channel to real infrastructure.

### Intervention Lab

The Intervention Lab makes the simulation boundary visible. It presents a baseline branch and scenario branches, including queued, running, succeeded, failed, and rejected states. For completed scenarios it shows before/after metrics, feasibility, hard-constraint results, objective value, residual and pressure summaries, and the `Apply to Digital Twin` action.

After-state data appears only after a completed scenario simulation. If a scenario has not completed, VeinGuard does not fill the card with guessed values.

### Resilience

The Resilience surface turns a collection of historical heat events into a bounded study. It makes missing coverage and failed events explicit, shows the sample size, and distinguishes environmental recurrence from chemistry replay status.

### Setup and foundation flow

The intended first-run flow is:

```text
network
  → thermal mode / AOI / event
  → chemistry profile
  → operational target and constraints
  → baseline
  → Operations
```

---

## The committed demonstration evidence

The repository includes a deterministic replay fixture of a **real completed FortyGuard response**, preserved with its raw payload and provenance. It is not a synthetic temperature generator and is not described as live data.

| Field                                                   | Demonstration value                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| Provider                                                | FortyGuard                                                         |
| Endpoint                                                | `/v1/heatmap`                                                      |
| Provider activity                                       | `4a569524-4027-4efb-8612-156aba88ae2b`                             |
| Provider observation time                               | `2024-07-15T14:00:00Z`                                             |
| Freshness                                               | `HISTORICAL`                                                       |
| Granularity                                             | `100`                                                              |
| Demo AOI                                                | `demo-aoi-v1`                                                      |
| Request hash                                            | `1943833b1e581e2326ccbfaa8b04038ff32d9d675df7043f4ec638ba78a47cde` |
| Network                                                 | EPA Net3 benchmark                                                 |
| Network checksum                                        | `ea3e825c4fef0b5cba47fb06301bc85253f18b6364dc96c44d9fb492c40faa52` |
| Associated assets                                       | `97 / 97` covered in the captured operations snapshot              |
| Mean associated air temperature                         | approximately `32.19 °C`                                           |
| Demo Free Chlorine target                               | `0.2 mg/L`                                                         |
| Projected target-breach assets in the captured snapshot | `1`, including `J-601`                                             |
| Water-network engine metadata                           | WNTR `1.5.0`, EPANET `2.2`                                         |

The captured snapshot is stored at [`data/fixtures/fortyguard/heatmap-2024-07-15T14-demo-aoi-v1.json`](data/fixtures/fortyguard/heatmap-2024-07-15T14-demo-aoi-v1.json). The derived operations snapshot is stored at [`data/operations/demo-operations-v1.json`](data/operations/demo-operations-v1.json).

These figures describe one historical benchmark replay. They are evidence that the pipeline can connect a real provider payload to a deterministic model run; they are not a claim about a real municipality, a universal water-quality threshold, or a live network condition.

---

## Suggested judge walkthrough

The fastest way to understand the project is to follow one operational question from environmental input to constrained action.

1. Open the [live demo](https://veinguard.oluwadunsin.dev) and authenticate with the supplied demo account, or run the stack locally.
2. Start with the historical FortyGuard snapshot and the EPA Net3 benchmark network.
3. Open **Operations** and show the heat layer and network overlay together.
4. Scrub to the captured hour and select the highlighted projected target-breach asset.
5. Open **Why?** and inspect the associated FortyGuard cell, modeled water temperature, hydraulic state, residual, target, and provenance.
6. Open **Digital Twin** and trace the asset upstream or downstream through the actual benchmark topology.
7. Open **Intervention Lab** and create a candidate such as a pump-setting change, tank-control change, valve-setting change, or booster concentration change.
8. Run the scenario. Wait for the completed simulation; queued and failed states are intentionally visible.
9. Compare multiple completed branches. Show that infeasible branches are rejected and that feasible branches are ranked by the configured deterministic objective.
10. Use the operations agent with a request such as:

    ```text
    Protect the projected target-breach junction over the configured simulation horizon without flushing.
    ```

11. Watch Gemini inspect compact context, propose typed candidates, and request simulations. The agent does not get to invent values or override the no-flush constraint.
12. Apply the selected result to the **Digital Twin** and compare the before/after network state.
13. Confirm that the environmental heat field remains unchanged after the network intervention. Only the simulated water-network state changes.
14. Switch to **Monochloramine** and show the distinct residual, target, free-ammonia context, and nitrification-condition indicator.
15. Open the provenance drawer and show the provider activity, request hash, network checksum, georeference version, engine versions, chemistry/thermal model versions, calibration profile, and scenario metadata.
16. Open **Resilience** and show how historical heat events are replayed with explicit success, failure, missing-data, and sample-size states.

This sequence demonstrates the core product thesis: FortyGuard temperature intelligence is not merely rendered; it is converted into a model-backed, constraint-aware, explainable operational workflow.

---

## Architecture

VeinGuard is a pnpm/Turborepo monorepo with separate UI, domain API, asynchronous worker, and scientific simulation responsibilities.

```text
                                      ┌──────────────────────┐
                                      │  Next.js web app     │
                                      │  MapLibre + ReactFlow│
                                      └──────────┬───────────┘
                                                 │ HTTPS / SSE
                                      ┌──────────▼───────────┐
                                      │ NestJS domain API    │
                                      │ auth · DTOs · audit  │
                                      └──────┬─────────┬─────┘
                                             │         │
                                      MongoDB │         │ BullMQ queues
                                             │         ▼
                                      ┌──────▼───┐  ┌───────────────┐
                                      │ durable  │  │ NestJS worker │
                                      │ state    │  │ provider/jobs │
                                      └──────────┘  └──┬──────┬─────┘
                                                       │      │
                                        FortyGuard API │      │ internal auth / HTTP
                                                       │      ▼
                                      ┌────────────────▼─┐ ┌──────────────┐
                                      │ real thermal      │ │ FastAPI      │
                                      │ acquisition/poll  │ │ simulation   │
                                      └───────────────────┘ │ WNTR/EPANET  │
                                                           └──────────────┘
```

### Runtime components

| Component              | Responsibility                                                                                                   | Main technologies                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/web`             | Authenticated map-first product surfaces, Digital Twin, Intervention Lab, Resilience, provenance, scenario state | Next.js App Router, React, MapLibre GL, React Flow, TanStack Query |
| `apps/api`             | Versioned domain API, auth, validation, durable job records, SSE, audit, scenario and study APIs                 | NestJS, MongoDB/Mongoose, class-validator, Helmet, throttling      |
| `apps/worker`          | Long-running work and provider orchestration                                                                     | Nest application context, BullMQ, Redis, MongoDB                   |
| `services/simulation`  | Network parsing, topology, EPANET hydraulics, water age, thermal model, chemistry, constraints, objective        | Python, FastAPI, WNTR, EPANET 2.2                                  |
| `packages/fortyguard`  | Provider client, request planner, polling, canonical hashing, real-response cache, freshness                     | Strict TypeScript                                                  |
| `packages/agent`       | Gemini client, typed tools, bounded loop, compact context, deterministic comparison                              | Strict TypeScript                                                  |
| `packages/contracts`   | Shared enums and API/domain vocabulary                                                                           | TypeScript                                                         |
| `packages/persistence` | Durable identifiers and schema definitions                                                                       | TypeScript                                                         |

### Queue model

Long work is durable in MongoDB and dispatched through bounded BullMQ queues:

| Queue        | Work                                                                    |
| ------------ | ----------------------------------------------------------------------- |
| `fortyguard` | Submit and poll provider activities; persist raw and normalized results |
| `simulation` | Run isolated scenario simulations and persist terminal results          |
| `agent`      | Run bounded Gemini tool-use workflows and public event summaries        |
| `resilience` | Replay historical event batches with partial-failure accounting         |

Every task carries a stable type, idempotency key or resource identity, correlation context, bounded attempts/backoff, timeout behavior, durable status, and an explicit terminal failure state. Redis is a work broker, not the source of truth.

---

## API and simulation surfaces

### Public domain API

All product routes are versioned under `/v1` and protected by the API auth layer except health and documentation routes.

| Route                                   | Purpose                                           |
| --------------------------------------- | ------------------------------------------------- |
| `POST /v1/auth/login`                   | Start a session                                   |
| `POST /v1/auth/refresh`                 | Rotate access credentials                         |
| `POST /v1/auth/logout`                  | End a session                                     |
| `GET /v1/auth/me`                       | Read the current user and role                    |
| `POST /v1/thermal/acquisitions`         | Plan and enqueue a FortyGuard acquisition         |
| `GET /v1/thermal/acquisitions/:id`      | Read acquisition status, freshness, and result    |
| `GET /v1/jobs/:id`                      | Read durable job status                           |
| `GET /v1/jobs/:id/events`               | Follow job progress through SSE                   |
| `GET /v1/operations/demo`               | Read the captured operations snapshot             |
| `GET /v1/operations/demo/layers/:layer` | Read a map layer                                  |
| `GET /v1/operations/demo/assets/:id`    | Inspect one modeled asset                         |
| `GET /v1/operations/demo/provenance`    | Read source and model provenance                  |
| `GET /v1/operations/demo/twin`          | Read the Digital Twin graph                       |
| `GET /v1/operations/demo/twin/trace`    | Trace network context                             |
| `GET /v1/lab/demo`                      | Read Intervention Lab baseline context            |
| `POST /v1/lab/scenarios`                | Create a typed scenario branch                    |
| `POST /v1/lab/scenarios/:id/run`        | Enqueue a scenario simulation                     |
| `POST /v1/lab/scenarios/compare`        | Rank completed scenarios deterministically        |
| `POST /v1/lab/scenarios/:id/apply`      | Apply a completed result to the Digital Twin only |
| `POST /v1/lab/agent-runs`               | Enqueue an operations-agent run                   |
| `GET /v1/resilience/demo`               | Read historical replay context                    |
| `POST /v1/resilience/studies`           | Create a bounded historical study                 |
| `GET /v1/resilience/studies/:id`        | Read study events and aggregate status            |
| `GET /v1/openapi.json`                  | Read the generated API contract                   |

### Internal simulation service

The FastAPI simulation service is authenticated with a service bearer token. Its health endpoints are public; simulation calls are not.

| Route                                    | Purpose                                                               |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `POST /v1/networks/validate`             | Parse and validate an EPANET input model                              |
| `POST /v1/networks/topology`             | Normalize nodes and links                                             |
| `POST /v1/simulations/hydraulics`        | Run EPANET hydraulics and water age                                   |
| `POST /v1/simulations/water-temperature` | Run one thermal timestep                                              |
| `POST /v1/simulations/free-chlorine`     | Run temperature-aware Free Chlorine residual                          |
| `POST /v1/simulations/monochloramine`    | Run distinct Monochloramine residual and conditions indicator         |
| `POST /v1/simulations/baseline`          | Run benchmark + FortyGuard + hydraulics + thermal + chlorine baseline |
| `POST /v1/simulations/scenario`          | Run an isolated typed intervention scenario                           |
| `POST /v1/simulations/scenarios/compare` | Deterministically rank feasible and rejected scenarios                |

---

## Run it locally

### Prerequisites

- Git
- Node.js 18 or newer; Node.js 22 is recommended and used in CI
- pnpm 9
- Docker Desktop with Docker Compose
- Python 3.11–3.13 for WNTR; Python 3.12 is used in CI
- `openssl` for local secret generation

### One-command bootstrap

From the repository root:

```bash
pnpm bootstrap
```

This command:

1. creates local environment files from the checked-in examples;
2. generates JWT and internal simulation secrets;
3. starts MongoDB and Redis through Docker Compose;
4. installs the locked JavaScript workspace dependencies;
5. creates `services/simulation/.venv` and installs the Python service.

Add real provider credentials after bootstrap. Never commit `.env` files.

```env
# apps/api/.env and apps/worker/.env
FORTYGUARD_API_KEY=...
GEMINI_API_KEY_1=...
GEMINI_API_KEY_2=...
GEMINI_API_KEY_3=...
GEMINI_API_KEY_4=...
```

The FortyGuard key and Gemini keys are server/worker credentials. They are not browser-public environment variables.

### Manual setup

```bash
pnpm setup:env
pnpm dev:infra
pnpm install --frozen-lockfile
pnpm setup:simulation
```

### Seed the demo account

Set a local password of at least 12 characters in `apps/api/.env`:

```env
DEMO_USER_EMAIL=demo@veinguard.local
DEMO_USER_PASSWORD=use-a-local-password-at-least-12-chars
```

Then run the idempotent seed:

```bash
pnpm seed:demo
```

The seed creates or updates the `veinguard-demo` organization and an `ADMIN` demo user. Do not use the example password in a deployed environment.

### Start the stack

In one terminal:

```bash
pnpm dev:simulation
```

In another:

```bash
pnpm dev
```

Local surfaces:

| Service         | URL                                                                      |
| --------------- | ------------------------------------------------------------------------ |
| Web             | [http://localhost:3000](http://localhost:3000)                           |
| API live        | [http://localhost:3001/health/live](http://localhost:3001/health/live)   |
| API ready       | [http://localhost:3001/health/ready](http://localhost:3001/health/ready) |
| Worker live     | [http://localhost:3002/health/live](http://localhost:3002/health/live)   |
| Simulation live | [http://localhost:8000/health/live](http://localhost:8000/health/live)   |
| API docs        | [http://localhost:3001/docs](http://localhost:3001/docs)                 |

Readiness is intentionally different from liveness. The API remains not ready until its durable dependencies respond, and the worker/simulation features remain unavailable when their required dependencies or credentials are missing.

### Environment matrix

| Variable group                                                                                                             | Where it belongs        | Why it exists                                                                    |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_MAP_STYLE_URL_*`, `NEXT_PUBLIC_APP_ENV`                                           | `apps/web/.env.local`   | Browser-safe API and map-style configuration only                                |
| `MONGODB_URI`, `MONGODB_DB_NAME`                                                                                           | API and worker          | Durable organizations, users, jobs, acquisitions, scenarios, studies, provenance |
| `REDIS_URL`                                                                                                                | API and worker          | BullMQ queue transport                                                           |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`                                                                                  | API                     | Access and rotating refresh credentials                                          |
| `SIMULATION_SERVICE_BASE_URL`, `SIMULATION_SERVICE_TOKEN`                                                                  | API, worker, simulation | Authenticated internal simulation calls                                          |
| `FORTYGUARD_API_BASE_URL`, `FORTYGUARD_API_KEY`                                                                            | API/worker              | Server-side provider acquisition and polling                                     |
| `FORTYGUARD_POLL_*`, `FORTYGUARD_HTTP_TIMEOUT_MS`, `FORTYGUARD_ACTIVITY_TIMEOUT_MS`                                        | API/worker              | Bounded provider retries and activity polling                                    |
| `GEMINI_API_KEY_1..4`, `GEMINI_MODEL`                                                                                      | Worker only             | Bounded operations-agent tool calling                                            |
| `AGENT_MAX_STEPS`, `AGENT_MAX_SIMULATIONS`, `AGENT_TIMEOUT_MS`                                                             | API/worker              | Agent safety and cost bounds                                                     |
| `NETWORK_DATA_DIR`, `CALIBRATION_DATA_DIR`                                                                                 | Simulation              | Benchmark and model-card locations                                               |
| `THERMAL_MODEL_VERSION`, `FREE_CHLORINE_MODEL_VERSION`, `MONOCHLORAMINE_MODEL_VERSION`, `NITRIFICATION_RISK_MODEL_VERSION` | Simulation              | Versioned scientific provenance                                                  |
| `MAX_CONCURRENT_SIMULATIONS`, `SIMULATION_TIMEOUT_SECONDS`                                                                 | Simulation              | Bounded scientific workload                                                      |

The full checked-in examples are [`apps/api/.env.example`](apps/api/.env.example), [`apps/worker/.env.example`](apps/worker/.env.example), [`apps/web/.env.local.example`](apps/web/.env.local.example), and [`services/simulation/.env.example`](services/simulation/.env.example).

---

## Verification and tests

The repository includes JavaScript unit/contract tests, API tests, scientific tests, isolation tests, golden EPANET tests, and opt-in live-provider tests.

Run the workspace checks:

```bash
pnpm format:check
pnpm lint
pnpm check-types
pnpm test
pnpm --filter api test:e2e
pnpm build
```

Run the simulation checks:

```bash
cd services/simulation
source .venv/bin/activate
ruff check veinguard_sim tests
mypy veinguard_sim
pytest
```

The Python test suite covers, among other things:

- direct EPANET/Net3 execution and convergence;
- topology normalization and benchmark metadata;
- synthetic georeferencing and asset association;
- pipe, soil, tank, and mixing thermal behavior;
- Free Chlorine temperature response and transport;
- distinct Monochloramine half-life behavior;
- nitrification-condition thresholds and wording;
- typed interventions and scenario isolation;
- hard-constraint rejection and deterministic objective behavior.

Live FortyGuard and live Gemini tests are opt-in because they consume external quota. Captured completed provider responses can be replayed deterministically only when their provenance is preserved.

Continuous integration is defined in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) and runs the locked JavaScript checks, API E2E suite, Python lint/type/test checks, and the simulation Docker build.

---

## Deployment

The repository includes a single-container Render deployment for the hackathon demo. `docker/render/supervisor.mjs` starts the web app, API, worker, simulation service, and routing gateway in one container. MongoDB and Redis remain external durable services.

The public routes are:

| Public path     | Destination                                                      |
| --------------- | ---------------------------------------------------------------- |
| `/`             | Next.js web app                                                  |
| `/api/*`        | NestJS API with the `/api` prefix removed                        |
| `/simulation/*` | FastAPI simulation service with the `/simulation` prefix removed |
| `/worker/*`     | Worker health endpoints                                          |

Deployment instructions, Render settings, required variables, and smoke checks are in [`docker/README.md`](docker/README.md).

The live deployment currently exposes:

- [public web app](https://veinguard.oluwadunsin.dev);
- [gateway liveness](https://veinguard.oluwadunsin.dev/health/live);
- [API liveness](https://veinguard.oluwadunsin.dev/api/health/live);
- [simulation liveness](https://veinguard.oluwadunsin.dev/simulation/health/live).

The hosted demo is suitable for a hackathon walkthrough. It is not an always-on production water-operations system: the free hosting tier can cold-start, its container filesystem is ephemeral, and real operational deployments would require utility-authorized data, managed infrastructure, stronger identity controls, site calibration, and formal validation.

---

## Data honesty and safety boundaries

VeinGuard is designed to make the boundary between evidence, model output, and recommendation visible.

### What is real

- The captured FortyGuard heatmap response and its raw provider payload.
- FortyGuard activity IDs, request hash, endpoint, timestamp, and freshness metadata.
- The EPA Net3 benchmark `.inp` network and its SHA-256 checksum.
- EPANET 2.2 hydraulic and water-age calculations when a run completes.
- The versioned code and calibration profiles used by the thermal and chemistry operators.
- The event and scenario records persisted by the API/worker stack.

### What is modeled

- Network asset placement inside the demo AOI: synthetic georeferencing.
- Water temperature: VeinGuard heat-transfer calculation driven by environmental boundary conditions and hydraulics.
- Disinfectant residual: VeinGuard deterministic transport/decay operators coupled to hydraulic residence time.
- Nitrification: categorical favorable-conditions indicator, not microbial kinetics.
- Scenario feasibility and ranking: deterministic constraint evaluation and objective scoring.

### Language the product intentionally uses

- “modeled residual”;
- “configured operational target”;
- “projected below configured operational target”;
- “projected target breach”;
- “conditions favorable for nitrification”;
- “historical replay using real FortyGuard data”;
- “EPA benchmark network”;
- “decision-support simulation.”

It does not use model output to declare water “safe,” “unsafe,” or “contaminated.” It does not call the benchmark a real city network. It does not say that FortyGuard directly measures water temperature. It does not claim that a nitrification condition indicator proves nitrification will occur. Those distinctions are central to the design, not legal footnotes added after the fact.

### Failure states are product states

The product treats the following as meaningful states that should be shown to an operator:

- queued;
- running;
- cached real;
- historical;
- stale or unavailable;
- no thermal coverage;
- provider failed;
- simulation failed;
- convergence failed;
- chemistry input outside reference range;
- agent unavailable;
- agent limit reached;
- no feasible scenario.

Unknown or uncovered data is not silently colored green. A provider failure does not become a synthetic temperature. A scenario without a completed simulation does not receive a guessed after-state.

---

## Known limitations and responsible next steps

This is a serious hackathon prototype, not a production utility control platform. The limitations are explicit because a system that hides them would be less useful to the people it is intended to support.

1. **Benchmark topology:** Net3 is an EPA benchmark, not an authorized utility network. A real deployment needs utility-provided topology, asset identity, operating rules, and data governance.
2. **Synthetic geography:** the demo placement is an affine transformation for spatial association. It must be replaced by an authorized GIS transform for real infrastructure.
3. **Thermal calibration:** `literature-water-temp-v1` uses a bounded benchmark profile. Site-specific soil, burial, pipe, tank, solar, and weather calibration would be required for operational use.
4. **Free Chlorine chemistry:** V1 uses a first-order bulk analogue with wall reaction off. A utility deployment should calibrate bulk and wall effects against hold studies and field observations.
5. **Monochloramine chemistry:** V1 is a reduced first-order residual model anchored to published half-life behavior. It is not the full multi-species autodecomposition mechanism and does not claim to replace a validated MSX or site-specific model.
6. **Nitrification:** V1 is a transparent conditions indicator. It does not predict microbial populations, nitrite, nitrate, or a probability of nitrification.
7. **Sensor integration:** no SCADA, AMI, laboratory, online residual, temperature sensor, or telemetry feed is connected in V1.
8. **Actuation:** there is no real pump, valve, tank, booster, or flushing actuation. Human-authorized operational integration is a future boundary requiring a separate safety case.
9. **Uncertainty:** the current demo produces deterministic point estimates. Future work should add calibrated uncertainty ensembles, sensitivity analysis, and observation assimilation rather than implying false precision.
10. **Coverage and provider limits:** FortyGuard entitlements, AOI limits, forecast horizon, historical availability, granularity, rate limits, and regional coverage can change. The planner and documentation must continue to follow the current provider contract.

The next responsible expansion is not “let the agent control the utility.” It is to add authorized data, calibrated parameters, field validation, uncertainty, stronger identity/access controls, and independent review before any operational recommendation is treated as more than modeled decision support.

---

## Repository map

```text
veinguard/
├── apps/
│   ├── web/                     # Next.js product UI
│   ├── api/                     # NestJS domain API and auth
│   └── worker/                  # BullMQ processors and integrations
├── services/
│   └── simulation/              # FastAPI + WNTR/EPANET scientific service
├── packages/
│   ├── agent/                   # Gemini boundary, local tools, agent loop
│   ├── contracts/               # Shared TypeScript contracts
│   ├── config/                  # Environment and queue configuration
│   ├── fortyguard/               # Provider client, planner, polling, cache
│   ├── persistence/             # Durable schemas and IDs
│   ├── ui/                      # Shared UI primitives
│   └── ...                      # TypeScript and lint configuration
├── data/
│   ├── calibration/             # Versioned scientific profiles
│   ├── constraints/             # Hard-constraint profiles
│   ├── fixtures/fortyguard/     # Captured real provider replay payloads
│   ├── georeference/            # Synthetic transform metadata
│   ├── networks/                # EPA Net3 benchmark and attribution
│   ├── objective/               # Deterministic scoring profiles
│   └── operations/              # Derived demo operations snapshot
├── docs/
│   ├── adr/                     # Architecture decision records
│   ├── scientific/              # Model cards and scientific boundaries
│   └── ...                      # PRD, API, security, testing, deployment
├── docker/                     # Local and Render container instructions
├── scripts/                    # Environment and simulation setup
├── AGENTS.md                   # Persistent repository engineering rules
└── docker-compose.yml          # Local MongoDB and Redis
```

---

## Scientific and platform references

The implementation keeps its source trail in [`docs/12_SOURCES_AND_DOCS.md`](docs/12_SOURCES_AND_DOCS.md). The most important references are:

- [FortyGuard Temperature API documentation](https://docs-api.fortyguard.com/)
- [FortyGuard Hackathon’26 brief](https://www.fortyguard.com/hackathon26)
- [FortyGuard API release notes](https://docs-api.fortyguard.com/docs/release-notes)
- [U.S. EPA EPANET](https://www.epa.gov/water-research/epanet)
- [U.S. EPA WNTR documentation](https://usepa.github.io/WNTR/)
- [U.S. EPA EPANET 2.2 repository](https://github.com/USEPA/EPANET2.2)
- [Blokker, Pan, van Laarhoven (2024), drinking-water temperature model](https://doi.org/10.3390/w16192796)
- [García-Ávila et al. (2020), chlorine decay and temperature](https://doi.org/10.1016/j.mex.2020.101002)
- [Vikesland, Ozekin, Valentine (2001), monochloramine decay](<https://doi.org/10.1016/S0043-1354(00)00406-1>)
- [Roy, Sathasivan, Kastl (2020), simplified chloramine decay model](https://doi.org/10.1016/j.scitotenv.2020.140410)
- [Google Gemini generateContent API](https://ai.google.dev/api/generate-content)
- [Google Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling)

---

## Final note

VeinGuard is built around a simple belief: climate intelligence becomes valuable when it can survive contact with a real operational workflow.

That means the temperature source must be real. The network calculation must be real. The chemistry profile must declare what it does and does not represent. An intervention must be simulated before it is compared. A constraint failure must remain a failure. An AI agent must be useful without being granted authority it cannot safely hold. And every important number must be traceable to its source, model version, calibration profile, and run.

VeinGuard is our attempt to make that entire chain visible—from hyperlocal heat, to modeled water state, to a human-auditable decision about what to investigate next.
