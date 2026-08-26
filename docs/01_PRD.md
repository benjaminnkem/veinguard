# VeinGuard — Product Requirements Document

**Version:** 1.0  
**Status:** Build-ready  
**Product category:** Temperature AI / Water Utility Digital Twin / Agentic Decision Support  
**Primary event:** FortyGuard Global AI Hackathon 2026

# 1. Executive summary

VeinGuard is a heat-aware digital twin and operational decision-support product for drinking-water distribution systems.

Water inside a distribution network changes as it travels through reservoirs, tanks, pumps, valves and pipes. Residence time, tank turnover, hydraulic routing, environmental temperature, pipe/tank heat transfer and disinfectant chemistry all influence the modeled water-quality state.

VeinGuard uses FortyGuard hyperlocal temperature intelligence as an **environmental boundary condition**, not as a direct measurement of water temperature. It combines that field with:
- an EPANET-compatible distribution network;
- EPA/WNTR hydraulic and water-age simulation;
- a deterministic water-temperature model;
- Free Chlorine or Monochloramine chemistry;
- deterministic operational constraints and scenario scoring;
- a bounded Gemini AI agent.

The core output is not:

> Zone C is hot.

It is:

> The model projects that Zone C may cross its configured disinfectant-residual operational target during this thermal event. Here are the modeled drivers, the actual simulations run, the candidates rejected by constraints, and the best feasible simulated intervention.

# 2. Problem

## 2.1 Operational problem

Utilities can know that a region is experiencing heat while still lacking a direct workflow that connects hyperlocal environmental heat to:
- modeled water temperature;
- water age;
- disinfectant residual;
- tank turnover;
- hydraulic state;
- future target crossings;
- operational intervention options.

A normal weather service does not validate pump/tank/valve decisions against a water-network digital twin.

A normal EPANET workflow does not automatically orchestrate hyperlocal thermal intelligence, scenario search and operator explanation.

A generic LLM cannot be trusted to calculate the underlying physics or chemistry.

## 2.2 Product hypothesis

Hyperlocal heat becomes actionable when it is transformed into:

```text
thermal environment
    ->
modeled water-system thermal state
    ->
hydraulics + water age + chemistry
    ->
projected operational target breach
    ->
simulated interventions
    ->
deterministic feasibility/ranking
    ->
operator decision support
```

# 3. FortyGuard dependency

VeinGuard must demonstrate why FortyGuard matters.

Current FortyGuard Heatmap capabilities relevant to the product include:
- spatial GeoJSON thermal output;
- historical data from 2019 onward;
- current data;
- up to 12 hours future according to current docs;
- TCM;
- time of measure;
- exceedance;
- persistence;
- map statistics.

Environmental Parameters may add variables such as solar irradiance for exposed-tank thermal modeling.

VeinGuard must not hardcode old provider constraints. The integration always re-checks current official docs.

# 4. Goals

## 4.1 V1 goals

1. Load and validate a legitimate EPANET benchmark network.
2. Run actual EPANET 2.2 hydraulics.
3. Run actual water-age simulation.
4. Fetch real FortyGuard thermal data.
5. Cache completed real provider results with provenance.
6. Synthetically georeference the benchmark network into a selected eligible AOI with disclosure.
7. Model pipe/tank water temperature from environmental conditions.
8. Support active `FREE_CHLORINE`.
9. Support active `MONOCHLORAMINE`.
10. Expose a transparent V1 nitrification-conditions indicator.
11. Detect crossings of a configured operational residual target.
12. Simulate supported interventions.
13. Reject hard-constraint violations.
14. Deterministically rank feasible scenarios.
15. Use Gemini to investigate/propose/explain through typed local tool calls.
16. Render a geographic Operations map.
17. Render an interactive network Digital Twin.
18. Provide an Intervention Lab.
19. Support historical Resilience studies.
20. Preserve full provenance.
21. Provide honest degraded/error states rather than fake fallback data.

## 4.2 Non-goals

V1 is not:
- SCADA;
- autonomous utility control;
- pathogen detection;
- a compliance certification engine;
- a laboratory sensor replacement;
- a declaration that modeled water is safe/unsafe;
- a real-city infrastructure database;
- a full water-network CAD editor;
- a generic climate dashboard;
- a generic chatbot.

# 5. Users

## Distribution operator
Needs:
- network state;
- target breaches;
- affected path;
- feasible interventions;
- before/after comparison.

## Water-quality engineer
Needs:
- chemistry profile;
- calibration provenance;
- water age;
- modeled water temperature;
- residual;
- validity/limitations.

## Operations manager
Needs:
- high-level impact;
- scenario resource tradeoffs;
- clear recommendation rationale.

## Resilience/planning engineer
Needs:
- repeated thermal stress;
- recurring vulnerable assets/zones;
- evidence for monitoring or engineering study.

## Judge/reviewer
Needs:
- visible real data;
- sponsor relevance;
- actual simulation;
- agentic value;
- no hidden fake outputs.

# 6. Product terminology

| Term | Meaning |
|---|---|
| Thermal Acquisition | One high-level request that may generate one or more FortyGuard provider activities |
| Thermal Snapshot | One completed provider response/time representation with provenance |
| Thermal Series | Time-indexed set used by a simulation |
| Network | EPANET-compatible distribution model |
| Network Version | Immutable network bytes/checksum/version |
| Synthetic Georeferencing | Placement of benchmark coordinates into demo geography |
| Baseline | Simulation without intervention |
| Scenario | Baseline plus one or more typed interventions |
| Simulation Run | Actual model execution |
| Chemistry Profile | Free Chlorine or Monochloramine |
| Operational Target | Configured decision-support threshold |
| Target Breach | Model crosses that target |
| Nitrification Conditions | V1 indicator of favorable conditions, not measured nitrification |
| Feasible | Passes every hard constraint |
| Agent Run | Bounded Gemini tool-use workflow |
| Provenance | Trace of data, engine, model, calibration and run versions |

# 7. Chemistry profiles

## 7.1 Free Chlorine — Active
The product must model:
- source residual;
- water age;
- temperature-dependent chemistry behavior;
- configured target;
- modeled residual over the network;
- target breaches.

## 7.2 Monochloramine — Active
The product must use a genuinely different model and relevant inputs such as:
- source monochloramine;
- free ammonia;
- pH;
- alkalinity and/or Cl/N ratio if required by selected model;
- temperature;
- target;
- residual.

The implementation must pass the scientific gate in the model specification.

## 7.3 Nitrification
V1:
- show favorable conditions;
- show drivers;
- version thresholds/rules;
- no fake microbial concentration or probability.

## 7.4 Coming soon
Visible disabled cards:
- Chlorine Dioxide;
- Advanced Multi-Species Chemistry.

# 8. Functional requirements

## FR-001 Network catalog/import
Must ship with at least one legitimate benchmark network (Net3 preferred).

For every network:
- source type;
- source attribution;
- immutable SHA-256;
- version;
- validation status;
- asset summary.

Future/user `.inp` uploads must be validated and size-limited.

## FR-002 Topology
Normalize:
- reservoirs;
- tanks;
- junctions;
- pumps;
- valves;
- pipes.

Keep original EPANET IDs.

## FR-003 Synthetic georeferencing
For a benchmark network:
- affine/deterministic transformation;
- preserve topology;
- persist transformation;
- disclose in UI and provenance.

## FR-004 Thermal modes
User can choose:
- Live/current where valid;
- Forecast;
- Historical Replay.

## FR-005 FortyGuard acquisition
Backend must:
- authenticate server-side;
- create current valid provider request(s);
- store `activity_id`;
- poll status asynchronously;
- validate completion;
- persist raw provider response;
- persist normalized map/stats;
- never generate fake fallback.

## FR-006 FortyGuard request planning
Handle:
- AOI limits;
- provider plan/entitlement;
- granularity;
- forecast horizon;
- same-day hour filters;
- crossing midnight;
- historical ranges;
- threshold/direction analytics;
- request chunking/deduplication.

## FR-007 Real-response cache
Canonical request hash.
Exact completed responses can be reused and labeled `CACHED_REAL`.

## FR-008 Hydraulic simulation
Actual EPANET via WNTR:
- flow;
- pressure/head;
- velocity where applicable;
- tank level/state;
- convergence.

## FR-009 Water age
Actual EPANET AGE simulation.

UI:
- layer;
- inspector;
- max/summary;
- path explanation.

## FR-010 Water-temperature model
Calculate rather than assume.

Distinguish:
- buried pipes;
- storage/exposed tanks.

Version model/calibration.

## FR-011 Free Chlorine
Active end-to-end profile with real calculation, target breach and provenance.

## FR-012 Monochloramine
Active end-to-end profile with real distinct calculation, target breach and provenance.

## FR-013 Nitrification conditions
For Monochloramine:
- categorical state;
- transparent drivers;
- no unsupported probability.

## FR-014 Baseline
Immutable inputs:
- network version;
- thermal series;
- chemistry profile;
- calibration;
- target;
- constraints;
- objective;
- model versions.

## FR-015 Manual interventions
Typed supported operations:
- change pump schedule;
- change pump setting;
- change tank control/turnover;
- change valve setting;
- flushing event;
- booster profile.

## FR-016 Isolation
Scenarios must never mutate persisted base network.

## FR-017 Constraints
Examples:
- hydraulic convergence;
- minimum/maximum pressure;
- tank min/max;
- pump bounds;
- valve bounds;
- service constraints;
- user-declared intervention constraints.

Hard failure => cannot be recommended.

## FR-018 Objective
Deterministic score may include:
- target-breach deficit/severity;
- water flushed;
- extra chemical;
- energy delta;
- switching/complexity.

Weights/version visible in configuration/provenance.

## FR-019 Agent
User can state:
> Protect Zone C through midnight without flushing.

Agent may:
- inspect relevant state;
- request baseline;
- propose typed candidates;
- request simulations;
- request deterministic comparison;
- explain result.

It cannot bypass simulation or constraints.

## FR-020 Agent budgets
Bound:
- steps;
- scenarios;
- simulations;
- wall time;
- context size.

## FR-021 Agent events
Show:
- tool/action;
- status;
- scenario ID;
- concise result.

No chain-of-thought.

## FR-022 Operations map
MapLibre layers:
- FortyGuard TCM;
- optional persistence/exceedance;
- network assets;
- pressure;
- flow;
- water age;
- modeled water temperature;
- chemistry residual;
- target-breach state;
- nitrification conditions when applicable.

## FR-023 Time slider
Updates:
- heat;
- network visual state;
- inspector;
- summary metrics.

## FR-024 Digital Twin
React Flow:
- pan/zoom;
- asset select;
- upstream/downstream trace;
- flow direction;
- state coloring;
- selected time;
- scenario preview.

No full CAD authoring.

## FR-025 Intervention Lab
- baseline branch;
- scenario branches;
- comparison;
- rejected scenario reasons;
- manual scenario editor;
- agent scenario outputs;
- before/after;
- apply to digital twin only.

## FR-026 Resilience
Historical study:
- real FortyGuard events;
- bounded batch;
- partial failure;
- recurrence;
- sample size;
- failed/missing events;
- no causal overclaim from correlation.

## FR-027 Provenance
Every important number traceable to:
- network/version/SHA;
- georeference;
- FortyGuard activity;
- freshness;
- model versions;
- calibration;
- simulation run;
- agent run where applicable.

## FR-028 Authentication
Roles:
- ADMIN;
- OPERATOR;
- VIEWER.

## FR-029 Errors
First-class:
- provider unavailable;
- provider failed;
- quota/rate limited;
- cached real;
- no thermal coverage;
- queued;
- simulation failure;
- convergence failure;
- chemistry validation failure;
- Gemini unavailable;
- no feasible scenario;
- agent limit.

# 9. UX requirements

## First run
1. Select network.
2. Select thermal mode/AOI/event.
3. Select disinfection profile.
4. Configure profile + target.
5. Validate.
6. Run baseline.
7. Open Operations.

## Operations page
Map-first.

Summary:
- target-breach asset/zone count;
- earliest breach;
- minimum residual;
- water-age or profile-specific key state;
- freshness.

Inspector:
- selected asset;
- hydraulic state;
- thermal state;
- chemistry state;
- target;
- Why/drivers;
- provenance.

## Chemistry selector

```text
Free Chlorine          ACTIVE
Monochloramine         ACTIVE
Chlorine Dioxide       COMING SOON
Advanced Multi-Species COMING SOON
```

## Agent interaction
Input goal + optional structured constraint chips.

Output:
- candidate runs;
- rejected candidates;
- best feasible result;
- explanation;
- "Apply to Digital Twin".

# 10. Hackathon demo

1. Open an authenticated VeinGuard demo.
2. Show source/provenance badge.
3. Use a **real historical FortyGuard event** if judging-day weather is weak.
4. Show heat field + benchmark network.
5. Scrub time.
6. Select an actual modeled zone approaching target.
7. Explain why.
8. Open Digital Twin and trace path.
9. Ask Gemini agent to protect zone, optionally forbidding flush.
10. Agent proposes candidates.
11. Real simulations run.
12. At least one candidate can be shown rejected if actual fixture supports it.
13. Deterministic comparison selects best feasible plan.
14. Before/after.
15. Heat field remains the same.
16. Open provenance.
17. Optionally switch chemistry profile and show that the model/configuration actually changes.

No numerical result is scripted before simulation.

# 11. Success metrics

## Integrity
- 100% core displayed simulation values come from completed model runs.
- 100% FortyGuard values come from real/cached-real responses.
- no infeasible scenario can be recommended;
- every recommendation has provenance.

## Usability
- problem understood within ~30 seconds;
- highlighted asset has clear Why;
- scenario comparison understandable without reading source code;
- current/forecast/historical/cached state obvious.

## Reliability
- refresh does not lose a durable run;
- provider failure does not generate fake values;
- Gemini failure leaves manual scenario mode usable.

# 12. Acceptance checklist

- [ ] Next web deployed/runnable.
- [ ] Nest API ready.
- [ ] Worker ready.
- [ ] Python simulation ready.
- [ ] Mongo + Redis work.
- [ ] benchmark network validates.
- [ ] actual EPANET hydraulics.
- [ ] actual water age.
- [ ] real FortyGuard acquisition.
- [ ] request cache/provenance.
- [ ] synthetic georeferencing disclosure.
- [ ] thermal-water model validated.
- [ ] Free Chlorine end to end.
- [ ] Monochloramine end to end.
- [ ] nitrification conditions correctly worded.
- [ ] manual scenarios.
- [ ] hard-constraint rejection test.
- [ ] deterministic ranking.
- [ ] real Gemini tool call.
- [ ] bounded agent.
- [ ] Operations map.
- [ ] Digital Twin.
- [ ] Intervention Lab.
- [ ] historical replay.
- [ ] Resilience smoke.
- [ ] provenance.
- [ ] core test/build pipeline.
- [ ] no required runtime mock fallback.

# 13. Risks

## Scientific overclaim
Mitigation:
- target language;
- calibration provenance;
- model versions;
- limitations;
- risk indicator semantics.

## No real utility GIS
Mitigation:
- official benchmark;
- visible disclosure.

## Provider quota/outage
Mitigation:
- canonical cache of completed real responses;
- historical replay;
- request planning.

## Agent limits
Mitigation:
- compact summaries;
- deterministic ranking;
- manual scenario mode.

## Chemistry coupling complexity
Mitigation:
- mandatory scientific spike;
- controlled network tests;
- ADR;
- ask user rather than fake.

# 14. Future expansion

Potential:
- authorized real GIS/SCADA/AMI;
- lab calibration ingestion;
- real sensor assimilation;
- chlorine dioxide;
- DBP models;
- richer EPANET-MSX;
- uncertainty ensembles;
- sensor placement;
- capital planning;
- SSO/MFA;
- controlled real-world integrations with human authorization.
