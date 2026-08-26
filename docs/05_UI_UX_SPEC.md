# VeinGuard — UI/UX Specification

**Direction:** Modern infrastructure operations center. Map-first. Dark-capable. Restrained chrome. Data/status colors carry meaning.

# 1. Navigation

Primary:
1. Operations
2. Digital Twin
3. Intervention Lab
4. Resilience

Secondary:
- Networks
- Settings
- Data & Provenance
- Account

# 2. Global status

Always make the current context discoverable:

```text
Network: EPA Net3 Benchmark
Geography: Synthetic georeferencing
Thermal: LIVE / FORECAST / HISTORICAL / CACHED REAL / UNAVAILABLE
Chemistry: Free Chlorine / Monochloramine
Simulation: READY / QUEUED / RUNNING / FAILED
```

# 3. Operations screen

Layout:

```text
┌──────────────────────────────────────────────────────────────┐
│ VeinGuard     Network ▼     Chemistry ▼      Data status    │
├─────────────┬────────────────────────────────┬───────────────┤
│ Layers      │                                │ Inspector     │
│             │             MAP                │               │
│             │                                │               │
├─────────────┴────────────────────────────────┴───────────────┤
│ Timeline / selected time / event markers                    │
└──────────────────────────────────────────────────────────────┘
```

Map gets the majority of the screen.

Keep top metrics to about four:
- target-breach zones/assets;
- earliest target breach;
- minimum modeled residual;
- max water age or relevant chemistry metric.

# 4. Map layers

Environmental:
- TCM;
- persistence;
- exceedance;
- peak/time-of-measure when useful.

Network:
- pipes;
- tanks;
- pumps;
- valves;
- reservoirs;
- zones.

Hydraulic:
- pressure;
- flow;
- water age.

Thermal/water quality:
- modeled water temperature;
- selected disinfectant residual;
- target-breach status;
- nitrification conditions for Monochloramine.

Only one primary quantitative water-quality layer should visually dominate at once.

# 5. Visual semantics

- Unknown/no data is not green.
- No thermal coverage has distinct neutral/hatch state.
- Red/green never carries meaning alone; pair label/icon/legend.
- A target breach is relative to the **configured operational target**, not a universal unsafe line.
- `CACHED_REAL` is a provenance state, not a risk color.

# 6. Asset inspector

For a selected pipe:

```text
PIPE P-1047
PROJECTED TARGET BREACH
EPA benchmark network

Hydraulics
- flow
- velocity
- water age

Thermal
- FortyGuard boundary/cell
- modeled water temperature

Chemistry
- selected profile
- modeled residual now
- modeled minimum
- configured target
- projected breach time

WHY?
- long residence time
- elevated modeled water temperature
- low incoming residual

[Open in Digital Twin]
[Create Scenario]
[View Provenance]
```

Never display a metric that the run did not calculate.

# 7. Timeline

Modes:
- Current/Forecast
- Historical Replay

Moving it updates:
- FortyGuard layer;
- network layer;
- inspector;
- summary cards;
- event markers.

Markers:
- thermal peak;
- earliest target breach;
- intervention start/end in scenario preview.

Keyboard accessible.

# 8. Thermal X-Ray

A branded view toggle combining:
- thermal field;
- underground modeled network;
- selected water-quality state.

It is a visualization mode, not a new scientific data source.

# 9. Coarse vs hyperlocal comparison

Optional demo feature:
```text
Environmental assumption:
[Uniform/coarse] [FortyGuard hyperlocal]
```

The coarse baseline must come from a real documented aggregation/input.

Only claim a changed result/ranking if actual simulation changes.

# 10. Digital Twin

Use `@xyflow/react`.

Nodes:
- Reservoir
- Tank
- Pump
- Junction
- Valve
- optional derived Zone node

Edges:
- Pipe

Interactions:
- pan/zoom/fit;
- select;
- upstream trace;
- downstream trace;
- flow direction;
- selected-time state;
- open inspector;
- scenario preview.

Do not build full topology authoring.

# 11. Flow trace

Selecting a zone and tracing upstream:
- fade unrelated assets;
- highlight relevant path;
- show flow direction;
- identify upstream tank/reservoir;
- show calculated water-age/residual context.

Do not invent supply percentages.

# 12. Intervention Lab

Visual concept:

```text
Baseline
  ├── Scenario A [REJECTED]
  ├── Scenario B [FEASIBLE]
  └── Scenario C [BEST FEASIBLE]
```

Comparison:
- target breaches;
- min residual;
- min pressure;
- tank violations;
- flush volume;
- chemical increment;
- energy delta;
- operational changes;
- deterministic objective;
- feasibility.

"Best" only comes from deterministic evaluator.

# 13. Manual scenario editor

User:
1. picks supported intervention type;
2. selects compatible asset;
3. enters bounded values;
4. validates;
5. queues real simulation.

No arbitrary EPANET commands.

# 14. Agent UI

Input:

```text
What operational outcome do you want?
[ Protect Zone C through midnight without flushing. ]
```

Structured chips:
- Zone C
- Until midnight
- No flushing

Progress:
```text
Inspecting network
Baseline loaded
Candidate A simulated
Candidate A rejected — pressure minimum
Candidate B simulated
Candidate C simulated
Comparing feasible candidates
Plan ready
```

No hidden chain-of-thought.

# 15. Agent result

```text
Recommended DIGITAL-TWIN plan

Why selected
- modeled target breach avoided/reduced
- no hard pressure violation
- less water use than alternative
- ...

This is decision-support simulation.
No real infrastructure was actuated.
```

Buttons:
- View
- Compare
- Apply to Digital Twin
- Discard

Never "Execute on network."

# 16. Chemistry selector

```text
Free Chlorine           ACTIVE
Monochloramine          ACTIVE
Chlorine Dioxide        COMING SOON
Advanced Multi-Species  COMING SOON
```

Coming-soon cards are disabled.

# 17. Free Chlorine form

Normal fields:
- source residual;
- operational target;
- calibration profile.

Expandable model details:
- reference temperature;
- decay source;
- model version;
- validity notes.

# 18. Monochloramine form

Based on validated model:
- source monochloramine;
- operational target;
- free ammonia;
- pH;
- alkalinity if required;
- Cl/N ratio if required;
- calibration.

Visible note:
> Nitrification in V1 represents favorable modeled conditions, not a microbial measurement.

# 19. Resilience

Inputs:
- event/date set;
- profile;
- zone/filter.

Show:
- events processed;
- successes;
- failed/missing;
- recurrence count;
- recurring assets;
- modeled drivers;
- source/sample size.

Do not turn recurrence into an unexplained probability.

# 20. Provenance drawer

Sections:
- Network;
- Georeferencing;
- FortyGuard;
- EPANET/WNTR;
- Thermal model;
- Chemistry model;
- Calibration;
- Agent;
- Timestamps.

Copyable:
- run ID;
- provider activity IDs;
- network SHA;
- model versions.

# 21. First-class data states

Loading:
> FortyGuard activity submitted. Waiting for provider completion.

Cached:
> Using cached real FortyGuard response fetched at ...

Unavailable:
> No valid real thermal data is currently available. Baseline cannot start.

Simulation failure:
- convergence;
- timeout;
- input invalid;
- model domain.

Gemini failure:
> AI assistance unavailable. Manual scenario simulation remains available.

# 22. Accessibility

- no color-only state;
- visible focus;
- accessible labels;
- keyboard timeline;
- reduced-motion support;
- comparison table alternative;
- text legends;
- sufficient contrast.

# 23. Responsive

Desktop primary.

Tablet:
- inspector/layers become drawers.

Mobile:
- inspect/read/agent summary supported;
- complex twin manipulation may be reduced;
- do not squeeze desktop control room into tiny viewport.

# 24. Polish priority

1. Operations map
2. Timeline
3. Inspector + Why
4. Agent events
5. Before/After
6. Provenance
7. Digital Twin trace
8. Resilience

Numerical integrity before decorative animation.
