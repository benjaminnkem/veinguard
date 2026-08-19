# VeinGuard — Scientific Model Specification

**Purpose:** Make numerical and scientific integrity binding.

# 1. Claims boundary

VeinGuard models a distribution system. Unless real sensors are later integrated, it does not directly measure:
- pipe-water temperature;
- residual disinfectant;
- microbes;
- pathogens;
- contamination;
- nitrification.

User-facing language:
- "modeled";
- "projected";
- "configured operational target";
- "conditions favorable for nitrification".

Never turn the model into a regulatory/safety declaration.

# 2. Thermal source

FortyGuard provides environmental thermal intelligence.

Forbidden:
```text
water_temperature = fortyguard_temperature
```

Required:
```text
FortyGuard environment
   -> pipe/tank boundary model
   -> heat transfer
   -> modeled water temperature
```

# 3. Hydraulic base

Use actual EPANET 2.2 through WNTR.

Hydraulic inputs/outputs support:
- demand;
- flow;
- pressure/head;
- velocity;
- tank state;
- pump/valve behavior.

Water age uses EPANET water-quality AGE mode.

No custom hydraulic solver for V1.

# 4. Water-temperature model

## 4.1 Pipe relationship

A defensible first-order exchange model has the form:

```text
dT_water/dτ = k * (T_boundary - T_water)
```

For constant boundary/effective `k` over a segment:

```text
T_out =
  T_boundary
  + (T_in - T_boundary) * exp(-k * τ)
```

Where:
- `T_in` = modeled entering water temperature;
- `T_out` = leaving water temperature;
- `T_boundary` = modeled pipe-surrounding/soil temperature;
- `k` = effective heat-transfer coefficient;
- `τ` = effective residence/contact time.

`k` must come from a documented reference/calibration profile. It is not universal.

Primary basis:
- Blokker, Pan, van Laarhoven (2024), *Validation of an Enhanced Drinking Water Temperature Model during Distribution*, Water 16(19), 2796, DOI 10.3390/w16192796.

Codex must verify formulas/units from the primary source before implementing.

## 4.2 Residence/contact time

Use hydraulic state and link geometry.

Handle:
- signed flow direction;
- flow reversal;
- very low/zero flow;
- closed link;
- loops;
- short links;
- missing parameters.

Never divide by near-zero flow.

For stagnant/near-stagnant conditions use a documented thermal relaxation treatment.

## 4.3 Junction mixing

For multiple inflows:
- identify incoming links from current flow direction;
- compute flow-weighted temperature mixing;
- handle no-inflow/isolated state explicitly.

## 4.4 Buried pipe boundary

FortyGuard ambient is translated to a lagged subsurface boundary.

V1 acceptable:
- documented first-order lag or documented soil thermal model;
- burial depth;
- effective diffusivity/lag;
- antecedent initialization.

Never instantaneously set soil boundary equal to air throughout depth.

## 4.5 Tank model

Use a separate well-mixed tank energy balance including:
- incoming water energy;
- outgoing water;
- tank volume/level;
- ambient exchange;
- geometry/material;
- optional solar irradiance if real environmental data is available.

If solar data is absent, use a documented reference parameterization and quality flag; do not fabricate a provider response.

## 4.6 Output

Per asset/time:
- modeled water temp;
- environmental boundary;
- model version;
- calibration profile;
- quality/coverage flag.

# 5. Free Chlorine

## 5.1 Goal

Project free chlorine residual under temperature-aware transport/reaction behavior.

## 5.2 Simplified kinetics

Common first-order representation:
```text
dC/dt = -k * C
```

Temperature correction may use an Arrhenius relationship. Exact implementation/sign/units must be verified against selected primary reference.

Relevant sources:
- MethodsX 2020, DOI 10.1016/j.mex.2020.101002.
- EPA Free Chlorine Distribution System Influent Hold Study Protocol.

A coefficient from one water system is not universal.

## 5.3 Calibration profile

Conceptual fields:
```text
sourceResidualMgL
operationalTargetMgL
referenceTemperatureC
bulkDecayReference
wallReactionParameters
temperatureCorrectionParameters
source:
  UTILITY_CALIBRATED |
  EPA_HOLD_STUDY_DERIVED |
  LITERATURE_REFERENCE
validityRange
modelVersion
```

Reference profiles must be labeled `LITERATURE_REFERENCE`, not utility calibrated.

# 6. Critical coupling problem

EPANET provides real chemical transport, but VeinGuard wants spatially/time-varying temperature-aware kinetics.

Do not assume the toolkit supports arbitrary dynamic reaction coefficients in the needed way.

Before production chemistry, Codex must test:
1. per-link parameterization;
2. valid state-preserving stepped windows;
3. EPANET-MSX formulation;
4. another current officially supported method.

Required science fixtures:
- one-pipe network;
- branched network;
- constant-temperature reference;
- hotter-vs-cooler monotonic behavior;
- state/mass continuity;
- flow reversal if method is affected.

Write ADR-006 for the chosen Free Chlorine method.

If full time-varying coupling is not defensible, a clearly labeled and tested quasi-steady/representative-temperature V1 method may be used only after documenting exactly what it means. Do not stitch unrelated states and call them continuous.

# 7. Monochloramine

## 7.1 Must be distinct

Monochloramine may require:
- initial monochloramine;
- free ammonia;
- pH;
- alkalinity;
- chlorine-to-nitrogen ratio;
- temperature;
- model-specific kinetic parameters.

Validate selected model's input domain.

## 7.2 Primary evidence

- *Simplified chemical chloramine decay model for water distribution systems* (2020), DOI 10.1016/j.scitotenv.2020.140410.
- *Monochloramine Decay in Model and Distribution System Waters* (2001), DOI 10.1016/S0043-1354(00)00406-1.

WNTR provides EPANET-MSX integration and a reaction library containing `batch_chloramine_decay`.

Important: the library example is not automatically a drop-in whole-distribution-system/tank solution. Inspect species, reactions, tank treatment and intended scope before use.

## 7.3 Abstraction

```text
ChemistryModel
├── FreeChlorineModel
└── MonochloramineModel
```

Interface must include:
- configuration validation;
- validity range;
- simulation/coupling;
- residual output;
- quality flags;
- provenance/model version.

## 7.4 Validation gate

Before Monochloramine becomes active in product:
1. reproduce at least one known/reference decay behavior;
2. demonstrate expected temperature response;
3. demonstrate relevant pH/free-ammonia/etc response;
4. demonstrate network transport;
5. document tank semantics;
6. write ADR-007.

If authoritative implementable equations/coupling cannot be confirmed, stop and ask instead of substituting a made-up model.

# 8. Nitrification conditions

V1 is **not** a microbial population/kinetics solver.

Use a transparent conditions indicator based on authoritative factors such as:
- elevated water age;
- higher modeled water temperature;
- low monochloramine residual;
- free ammonia;
- deposits/sediment where data exists.

Output:

```json
{
  "level":"ELEVATED",
  "label":"Conditions favorable for nitrification",
  "drivers":[
    "HIGH_WATER_AGE",
    "ELEVATED_WATER_TEMPERATURE",
    "LOW_MONOCHLORAMINE_RESIDUAL",
    "FREE_AMMONIA_PRESENT"
  ],
  "modelVersion":"nitrification-conditions-v1"
}
```

Do not expose `83% nitrification risk` unless a validated probability model exists.

Thresholds:
- sourced;
- configurable;
- versioned;
- their provenance visible.

# 9. Operational target

Do not hardcode one residual threshold as universal safe/unsafe law.

Use:
```text
operationalTargetMgL
```

Store:
- target source;
- profile;
- jurisdiction/utility applicability if known;
- demo/operator/reference classification.

UI:
> Projected below configured operational target.

# 10. Intervention physics

An intervention changes network state, not weather.

- pump -> routing/pressure/residence;
- tank control -> storage/turnover;
- valve -> routing;
- flush -> withdrawal/flow;
- booster -> chemistry source.

After intervention the FortyGuard layer for the same thermal scenario remains unchanged.

# 11. Resource metrics

If displaying:
- flush-water liters;
- chemical increment;
- energy delta;

derive them.

A dollar value requires explicit configured unit cost/currency. No invented economics.

# 12. Uncertainty metadata

V1 should expose model quality rather than a fake confidence score.

Example:
```text
Network: EPA benchmark
Thermal source: FortyGuard historical
Thermal calibration: literature reference
Chemistry calibration: literature reference
Sensor calibration: none
```

Future:
- ensemble/sensitivity;
- Bayesian calibration;
- sensor assimilation.

# 13. Mandatory regression tests

- heat-exchange limiting behavior;
- finite zero-flow behavior;
- junction mix;
- flow reversal;
- tank balance;
- direct EPANET wrapper agreement;
- water-age agreement;
- chemistry reference behavior;
- target crossing;
- no meaningful negative concentration;
- same immutable inputs/model versions -> same deterministic result;
- hotter input changes kinetic rate in direction expected by selected validated model.

# 14. Scientific provenance

Every run stores:

```json
{
  "thermalModel":{
    "name":"veinguard-water-temperature",
    "version":"...",
    "calibrationProfileId":"...",
    "references":[]
  },
  "chemistryModel":{
    "profile":"FREE_CHLORINE",
    "name":"...",
    "version":"...",
    "calibrationProfileId":"...",
    "references":[]
  },
  "nitrificationModel":null
}
```

Monochloramine runs have a separately versioned nitrification-conditions model.

# 15. Deployment science gate

Before public demo:
- scientific tests pass;
- model validity ranges documented;
- no TODO equation;
- no unexplained constant;
- calibration source visible;
- limitations in app/docs;
- benchmark disclosure visible.
