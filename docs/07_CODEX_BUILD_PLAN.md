# VeinGuard — Ordered Codex Build Plan

Do not build the product in one prompt. Each phase must remain runnable/testable.

## Phase 00 — Research and architecture verification
Read handoff + AGENTS. Re-check current:
- FortyGuard;
- EPA/WNTR/EPANET/MSX;
- Gemini;
- Next/Nest/Mongo;
- MapLibre/React Flow;
- BullMQ/Redis.

Verify runtime/package compatibility. Propose ADRs. Ask only material unresolved questions. No product feature code.

## Phase 01 — Monorepo foundation
Build:
- pnpm/Turborepo;
- Next web;
- Nest API;
- Nest worker;
- Python FastAPI service;
- contracts/config/UI packages;
- Docker Mongo/Redis;
- CI;
- health;
- env validation;
- root scripts.

Exit: fresh clone starts and checks pass.

## Phase 02 — EPANET/WNTR foundation
Build:
- Net3 source/attribution;
- hash/version;
- `.inp` validation;
- topology normalization;
- real hydraulics;
- real water age;
- simulation endpoints;
- golden direct-vs-wrapper tests.

Exit: actual EPANET outputs.

## Phase 03 — Thermal science engine
Build:
- buried-pipe model;
- tank model;
- contact time;
- flow reversal;
- stagnant water;
- mixing;
- calibration/profile;
- provenance;
- ADR-005;
- scientific tests.

No provider call yet.

## Phase 04 — Free Chlorine science gate
Before production:
- current EPANET/WNTR quality docs;
- one-pipe/branch tests;
- choose defensible temperature/chemistry coupling;
- ADR-006.

Then implement:
- Free Chlorine profile;
- calibration;
- residual;
- target breach;
- tests.

## Phase 05 — Monochloramine science gate
Inspect:
- WNTR MSX;
- reaction library;
- primary chloramine papers;
- EPA nitrification material.

Choose/validate a real Monochloramine model, network transport and tank semantics. ADR-007.

Implement:
- Monochloramine residual;
- target;
- nitrification-conditions indicator.

Ask user rather than invent kinetics if evidence/tooling is insufficient.

## Phase 06 — FortyGuard real integration
Build:
- real auth/client;
- current schemas;
- async activity/status workflow;
- request planner;
- cross-midnight/date handling;
- cache;
- provenance;
- historical replay;
- optional env params only when justified;
- opt-in live integration test.

No synthetic provider fallback.

## Phase 07 — End-to-end baseline
Connect:
- benchmark network;
- synthetic georeferencing;
- real FortyGuard;
- thermal association;
- EPANET;
- thermal model;
- selected chemistry;
- target detection;
- provenance.

Exit: reproducible real-data baseline.

## Phase 08 — Domain/persistence/queues/auth/SSE
Productionize:
- schemas/indexes;
- organizations/users;
- auth/roles;
- durable jobs;
- BullMQ;
- worker;
- idempotency;
- audit;
- SSE;
- OpenAPI/errors.

## Phase 09 — Intervention + optimizer
Implement all typed interventions.
Build:
- isolated scenario application;
- real simulations;
- hard constraints;
- deterministic objective;
- compare API;
- real rejected candidate tests.

## Phase 10 — Gemini agent
Current official docs first.
Build:
- configurable supported model;
- local tool calling;
- bounded state machine;
- compact context;
- typed args;
- actual scenario simulation;
- deterministic selection;
- explanation;
- eval suite.

## Phase 11 — Operations UI
Build:
- MapLibre;
- thermal/network layers;
- profile layers;
- timeline;
- inspector/Why;
- provenance;
- data/error states.

## Phase 12 — Digital Twin UI
Build:
- React Flow nodes/edges;
- time state;
- trace;
- flow direction;
- map deep links;
- scenario preview.

No CAD editor.

## Phase 13 — Intervention Lab + Agent UX
Build:
- scenario branches;
- manual editor;
- comparison;
- hard-rejection UX;
- agent input/events;
- best feasible;
- before/after;
- apply to digital twin.

## Phase 14 — Resilience
Build:
- real historical event sets;
- bounded batch;
- partial failure;
- recurrence;
- sample-size transparency;
- map/table.

## Phase 15 — Hardening
Review/fix:
- security;
- retries;
- idempotency;
- queue restart;
- provider failures;
- performance/artifacts;
- accessibility;
- logging/health;
- dependency audit.

## Phase 16 — Deployment and handoff
- re-check current provider docs;
- zero-cost hackathon deploy;
- production topology note;
- real historical event cache;
- both chemistry profiles;
- agent;
- full E2E;
- smoke;
- env matrix;
- fresh-clone setup;
- final engineering explanation.
