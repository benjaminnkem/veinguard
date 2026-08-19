# VeinGuard — API & Data Contracts

Exact framework syntax may evolve. These semantics are required.

# 1. Core enums

```ts
type DataFreshness = "LIVE" | "FORECAST" | "HISTORICAL" | "CACHED_REAL";

type ChemistryProfileType =
  | "FREE_CHLORINE"
  | "MONOCHLORAMINE"
  | "CHLORINE_DIOXIDE"
  | "ADVANCED_MULTI_SPECIES";

type ChemistryProfileStatus = "ACTIVE" | "COMING_SOON";

type NetworkSourceType = "EPA_BENCHMARK" | "USER_UPLOAD";

type GeoReferenceType =
  | "REAL_GEOGRAPHIC"
  | "SYNTHETIC_GEOREFERENCING"
  | "NONE";

type RunStatus =
  | "PENDING"
  | "QUEUED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "PARTIAL";
```

# 2. API style

Base:
```text
/v1
```

Long work:
- validate/create durable resource;
- enqueue;
- return `202 Accepted`;
- subscribe through SSE/poll canonical resource.

Success:
```json
{"data":{},"meta":{"correlationId":"..."}}
```

Error:
```json
{
  "error":{
    "code":"...",
    "message":"...",
    "correlationId":"..."
  }
}
```

# 3. Thermal acquisition

## POST `/v1/thermal/acquisitions`

Product-level contract:

```json
{
  "mode":"HISTORICAL",
  "aoi":{"type":"FeatureCollection","features":[]},
  "time":{
    "start":"2026-07-20T12:00:00-07:00",
    "end":"2026-07-20T22:00:00-07:00"
  },
  "granularityMeters":100,
  "analytics":["TCM"]
}
```

Backend planner converts this to current valid FortyGuard request(s).

Response:
```json
{
  "data":{
    "acquisitionId":"...",
    "status":"QUEUED"
  },
  "meta":{"correlationId":"..."}
}
```

# 4. Thermal snapshot

```ts
interface ThermalSnapshot {
  id: string;
  acquisitionId: string;
  provider: "FORTYGUARD";
  endpoint: string;
  providerActivityId: string;
  requestHash: string;
  freshness: DataFreshness;
  observationOrForecastTime: string;
  fetchedAt: string;
  rawResponseArtifactId: string;
  mapGeoJsonArtifactId: string;
  stats: {
    min?: number;
    max?: number;
    mean?: number;
    standardDeviation?: number;
    units: string;
  };
}
```

# 5. Network summary

```json
{
  "id":"epa-net3",
  "name":"EPA Net3 Benchmark",
  "sourceType":"EPA_BENCHMARK",
  "activeVersionId":"...",
  "geoReferenceType":"SYNTHETIC_GEOREFERENCING"
}
```

# 6. Network topology

`GET /v1/networks/:id/topology`

```json
{
  "networkVersionId":"...",
  "geoReference":{
    "type":"SYNTHETIC_GEOREFERENCING",
    "version":"..."
  },
  "nodes":[
    {
      "id":"J-10",
      "sourceId":"10",
      "type":"JUNCTION",
      "x":0,
      "y":0,
      "longitude":null,
      "latitude":null
    }
  ],
  "links":[
    {
      "id":"P-101",
      "sourceId":"101",
      "type":"PIPE",
      "fromNodeId":"J-10",
      "toNodeId":"J-11"
    }
  ]
}
```

# 7. Simulation setup

```ts
interface SimulationSetup {
  networkVersionId: string;
  thermalAcquisitionId: string;
  horizon: {
    start: string;
    end: string;
    outputStepSeconds: number;
  };
  chemistry: FreeChlorineConfig | MonochloramineConfig;
  constraintsProfileId: string;
  objectiveProfileId: string;
}
```

# 8. Chemistry configs

```ts
interface FreeChlorineConfig {
  type: "FREE_CHLORINE";
  calibrationProfileId: string;
  sourceResidualMgL: number;
  operationalTargetMgL: number;
}
```

```ts
interface MonochloramineConfig {
  type: "MONOCHLORAMINE";
  calibrationProfileId: string;
  sourceResidualMgL: number;
  operationalTargetMgL: number;
  freeAmmoniaMgL: number;
  pH: number;
  alkalinityMgLAsCaCO3?: number;
  chlorineToNitrogenRatio?: number;
}
```

Model kinetic internals normally belong to immutable calibration profile, not arbitrary public request fields.

# 9. Baseline run

`POST /v1/simulation-runs`

```json
{
  "setup":{
    "networkVersionId":"...",
    "thermalAcquisitionId":"...",
    "horizon":{
      "start":"...",
      "end":"...",
      "outputStepSeconds":3600
    },
    "chemistry":{
      "type":"FREE_CHLORINE",
      "calibrationProfileId":"fc-lit-v1",
      "sourceResidualMgL":1.0,
      "operationalTargetMgL":0.2
    },
    "constraintsProfileId":"demo-constraints-v1",
    "objectiveProfileId":"demo-objective-v1"
  }
}
```

Response:
```json
{"data":{"simulationRunId":"...","status":"QUEUED"}}
```

# 10. Simulation summary

```ts
interface SimulationSummary {
  simulationRunId: string;
  status: "SUCCEEDED";
  feasible: boolean;
  chemistryProfile: "FREE_CHLORINE" | "MONOCHLORAMINE";
  earliestTargetBreachAt: string | null;
  targetBreachAssetCount: number;
  minimumResidualMgL: number | null;
  maximumWaterAgeHours: number | null;
  minPressure: number | null;
  maxPressure: number | null;
  waterFlushedLiters: number;
  chemicalIncrement: number;
  energyDeltaKwh: number | null;
  hardConstraintViolations: ConstraintResult[];
  modelVersions: Record<string,string>;
}
```

# 11. Layer API

Do not return every variable/time by default.

Examples:
```text
GET /v1/simulation-runs/:id/layers/residual?time=...
GET /v1/simulation-runs/:id/layers/water-age?time=...
GET /v1/simulation-runs/:id/layers/water-temperature?time=...
GET /v1/simulation-runs/:id/layers/pressure?time=...
GET /v1/simulation-runs/:id/layers/flow?time=...
```

Response:
```json
{
  "time":"...",
  "units":"mg/L",
  "nodes":{"J-10":0.43},
  "links":{"P-101":0.46}
}
```

# 12. Interventions

## Pump schedule

```ts
interface ChangePumpSchedule {
  type: "CHANGE_PUMP_SCHEDULE";
  pumpId: string;
  intervals: Array<{
    start: string;
    end: string;
    enabled: boolean;
  }>;
}
```

## Pump setting

```ts
interface ChangePumpSetting {
  type: "CHANGE_PUMP_SETTING";
  pumpId: string;
  start: string;
  end: string;
  setting: number;
}
```

## Tank control

Codex must define exact discriminated operations after validating actual WNTR/EPANET control capabilities. Do **not** leave an arbitrary `Record<string,unknown>` in production.

Target concept:
```ts
type ChangeTankControl =
  | TankLevelTriggerControl
  | TankRelatedPumpControl
  | OtherExplicitSupportedControl;
```

## Valve

```ts
interface ChangeValveSetting {
  type: "CHANGE_VALVE_SETTING";
  valveId: string;
  start: string;
  end: string;
  setting: number;
}
```

## Flush

```ts
interface FlushEvent {
  type: "FLUSH_EVENT";
  junctionId: string;
  start: string;
  durationSeconds: number;
  dischargeLps: number;
}
```

## Booster

```ts
interface ChangeBoosterProfile {
  type: "CHANGE_BOOSTER_PROFILE";
  sourceNodeId: string;
  start: string;
  end: string;
  mode: "CONCENTRATION" | "MASS";
  value: number;
  units: string;
}
```

Booster semantics must match selected chemistry model.

# 13. Scenario create/run

`POST /v1/scenarios`

```json
{
  "baselineRunId":"...",
  "name":"Pump P3 earlier",
  "interventions":[]
}
```

`POST /v1/scenarios/:id/run`

Returns a queued scenario run.

# 14. Constraint result

```ts
interface ConstraintResult {
  id: string;
  type: string;
  severity: "HARD" | "SOFT";
  passed: boolean;
  assetIds: string[];
  timeIndices: string[];
  observed?: number;
  limit?: number;
  units?: string;
  message: string;
}
```

# 15. Deterministic comparison

`POST /v1/scenarios/compare`

```json
{"scenarioRunIds":["...","...","..."]}
```

Response:
```json
{
  "feasible":[
    {
      "scenarioRunId":"...",
      "objective":124.4,
      "rank":1
    }
  ],
  "rejected":[
    {
      "scenarioRunId":"...",
      "hardConstraintViolationIds":["pressure.min"]
    }
  ],
  "objectiveProfileVersion":"v1"
}
```

# 16. Agent run

`POST /v1/agent-runs`

```json
{
  "baselineRunId":"...",
  "goal":"Protect Zone C through midnight without flushing.",
  "structuredConstraints":{
    "forbidInterventionTypes":["FLUSH_EVENT"],
    "targetZoneIds":["zone-c"],
    "horizonEnd":"..."
  }
}
```

Response:
```json
{"data":{"agentRunId":"...","status":"QUEUED"}}
```

# 17. Agent tool contracts

## `get_zone_state`
Input:
```json
{"baselineRunId":"...","zoneId":"..."}
```

Output must be compact decision-relevant numbers and flags.

## `get_network_context`
```json
{
  "baselineRunId":"...",
  "zoneId":"...",
  "direction":"UPSTREAM",
  "maxDepth":4
}
```

## `get_thermal_context`
```json
{"baselineRunId":"...","zoneId":"..."}
```

## `simulate_scenario`
```json
{
  "baselineRunId":"...",
  "name":"...",
  "interventions":[]
}
```

Backend validates:
- tool schema;
- authorization;
- user's structured constraints;
- agent simulation budget.

## `compare_feasible_scenarios`
```json
{"scenarioRunIds":["..."]}
```

Returns deterministic result.

# 18. Agent event

```ts
interface AgentEvent {
  agentRunId: string;
  sequence: number;
  type:
    | "STARTED"
    | "TOOL_STARTED"
    | "TOOL_COMPLETED"
    | "SCENARIO_CREATED"
    | "SCENARIO_REJECTED"
    | "COMPARISON_COMPLETED"
    | "COMPLETED"
    | "FAILED"
    | "LIMIT_REACHED";
  timestamp: string;
  displayMessage: string;
  toolName?: string;
  scenarioRunId?: string;
  resultSummary?: Record<string,unknown>;
}
```

No chain-of-thought field.

# 19. Nitrification conditions

```ts
interface NitrificationConditions {
  level: "LOW" | "ELEVATED" | "HIGH";
  label: "Conditions favorable for nitrification";
  drivers: Array<
    | "HIGH_WATER_AGE"
    | "ELEVATED_WATER_TEMPERATURE"
    | "LOW_MONOCHLORAMINE_RESIDUAL"
    | "FREE_AMMONIA_PRESENT"
    | "DEPOSIT_OR_SEDIMENT_FACTOR"
  >;
  modelVersion: string;
  thresholdProfileId: string;
}
```

No probability field V1.

# 20. Provenance

```ts
interface RunProvenance {
  runId: string;
  network: {
    networkVersionId: string;
    sourceType: NetworkSourceType;
    sha256: string;
    geoReferenceType: GeoReferenceType;
    geoReferenceVersion?: string;
  };
  thermal: Array<{
    thermalSnapshotId: string;
    provider: "FORTYGUARD";
    activityId: string;
    requestHash: string;
    freshness: DataFreshness;
    fetchedAt: string;
  }>;
  engines: {
    epanetVersion: string;
    wntrVersion: string;
    simulationServiceVersion: string;
  };
  models: {
    thermalModelVersion: string;
    chemistryModelVersion: string;
    nitrificationConditionsVersion?: string;
    calibrationProfileId: string;
  };
}
```

# 21. Mongo artifact chunks

Concept:

```ts
interface SimulationArtifactChunk {
  simulationRunId: ObjectId;
  variable:
    | "PRESSURE"
    | "FLOW"
    | "WATER_AGE"
    | "WATER_TEMPERATURE"
    | "RESIDUAL";
  timeStart: Date;
  timeEnd: Date;
  encoding: "JSON_GZIP" | "BSON";
  values: unknown;
}
```

Benchmark actual document size before choosing chunk dimensions.

# 22. Idempotency

Create/run endpoints support stable idempotency where expensive work can duplicate.

Header:
```text
Idempotency-Key
```

Duplicate semantically identical requests:
- return existing in-progress/completed resource;
- do not launch another provider/simulation job.

# 23. SSE

Example:
```text
id: 42
event: simulation.completed
data: {"runId":"...","status":"SUCCEEDED","correlationId":"..."}
```

Frontend re-fetches canonical run resource.

# 24. Simulation internal contract

Nest/worker -> Python request includes:
- network file/reference/version;
- thermal series normalized values;
- georeference/spatial associations;
- simulation horizon/options;
- chemistry config;
- calibration version/data;
- interventions;
- constraints required for numerical output.

Response:
- convergence;
- compact summary;
- artifact payload/reference;
- scientific provenance;
- structured warnings/errors.

Internal contract itself is versioned.

# 25. Error codes

Examples:
```text
AUTH_INVALID_CREDENTIALS
AUTH_FORBIDDEN
NETWORK_INVALID
NETWORK_VERSION_NOT_FOUND
THERMAL_PROVIDER_UNAVAILABLE
THERMAL_ACTIVITY_FAILED
THERMAL_NO_COVERAGE
THERMAL_REQUEST_INVALID
SIMULATION_CONVERGENCE_FAILED
SIMULATION_TIMEOUT
CHEMISTRY_CONFIG_INVALID
CHEMISTRY_MODEL_OUT_OF_RANGE
SCENARIO_INVALID_INTERVENTION
SCENARIO_HARD_CONSTRAINT_FAILED
AGENT_UNAVAILABLE
AGENT_LIMIT_REACHED
AGENT_NO_FEASIBLE_SCENARIO
INTERNAL_DEPENDENCY_UNAVAILABLE
```
