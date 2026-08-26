# VeinGuard — Testing & Validation Runbook

# 1. Test classes

## Unit
Use deterministic test doubles as needed for:
- DTO/schema validation;
- request canonicalization;
- objective;
- constraints;
- formulas;
- tool argument validation;
- risk-driver classification.

## Integration
Use real local dependencies:
- MongoDB;
- Redis/BullMQ;
- WNTR/EPANET;
- simulation FastAPI;
- Nest modules.

## Live provider
Explicit opt-in:
- real FortyGuard;
- real Gemini.

## E2E
Browser/API + real local science stack. A captured **real** FortyGuard response can be used for deterministic historical replay tests if its provenance is preserved.

# 2. EPANET golden tests

Required:
1. run Net3 directly with WNTR;
2. run through VeinGuard simulation API/wrapper;
3. compare selected flow/pressure outputs within defined tolerance;
4. direct vs wrapper water age;
5. invalid `.inp`;
6. convergence/error path;
7. engine/version recorded.

Golden values must be reviewed when engine version changes.

# 3. Thermal tests

- constant boundary limiting behavior;
- `k=0` preserves inlet temperature;
- long contact approaches boundary;
- flow reversal;
- zero/near-zero flow finite;
- junction flow-weighted mixing;
- tank energy balance;
- invalid/missing calibration;
- unit conversion;
- deterministic repeat.

# 4. Free Chlorine tests

Mandatory:
- constant-temperature reference;
- hot/cool model comparison;
- source residual;
- bulk/wall behavior selected by ADR;
- target crossing;
- no physically meaningful negative concentration;
- state/coupling continuity required by chosen method;
- direct EPANET/MSX reference where applicable;
- same input/model -> same output.

A test that only checks non-null output is inadequate.

# 5. Monochloramine tests

- reproduce reference decay behavior;
- model validity-range checks;
- temperature sensitivity;
- pH sensitivity if selected model supports it;
- ammonia/ClN/alkalinity sensitivity as applicable;
- network transport;
- tank semantics;
- target crossing;
- species/concentration sanity;
- provenance.

# 6. Nitrification-conditions tests

Test individual drivers:
- high water age;
- elevated modeled water temp;
- low residual;
- free ammonia;
- deposit/sediment only if data exists.

Test combinations.

No probability assertion.

# 7. FortyGuard contract tests

Using a captured real completed response:
- raw response stored;
- activity ID;
- GeoJSON `map_data`;
- stats/units;
- malformed response rejected;
- normalization.

Request planner tests reflecting **current docs**:
- single hour;
- same-day range;
- cross-midnight split;
- forecast horizon bound;
- historical;
- invalid AOI;
- invalid granularity;
- persistence/exceedance threshold/direction.

# 8. FortyGuard live smoke

Only with:
```env
RUN_LIVE_FORTYGUARD_TESTS=true
```

Flow:
1. submit small eligible real request;
2. persist activity ID;
3. poll;
4. validate Completed or report provider Failed;
5. normalize;
6. call same app-level request;
7. verify `CACHED_REAL` reuse where cache policy says so.

Do not run repeatedly in standard CI.

# 9. Scenario tests

For each intervention:
- valid;
- incompatible asset;
- invalid time;
- out-of-range value;
- base immutability;
- deterministic repeat.

Constraints:
- pressure failure;
- tank failure;
- convergence failure;
- user `no flush`;
- chemistry/config constraint.

Objective:
- stable ranking;
- hard-failed scenario never feasible.

# 10. Agent tests

Tool contract:
- malformed args;
- unknown asset;
- forbidden intervention blocked before simulation.

Behavior:
1. normal protect-zone goal;
2. no-flush goal;
3. no feasible plan;
4. one simulation fails;
5. Gemini timeout;
6. 429;
7. max steps;
8. max simulations;
9. prompt asks to skip constraints;
10. prompt asks for real actuation.

Live Gemini test:
```env
RUN_LIVE_GEMINI_TESTS=true
```
Must return a real validated local tool call.

# 11. Queue tests

- idempotent duplicate;
- worker crash/restart;
- transient retry;
- permanent validation no retry;
- timeout;
- cancellation;
- durable Mongo state;
- queue priority if implemented.

# 12. Auth/API tests

- login;
- invalid password;
- refresh rotation;
- revoked refresh;
- role authorization;
- organization isolation;
- unknown fields rejected;
- OpenAPI;
- correlation ID.

# 13. SSE tests

- event order;
- terminal event;
- reconnect;
- canonical refetch;
- no secret payload.

# 14. Frontend tests

Components:
- chemistry active/coming soon;
- provenance;
- freshness;
- unavailable;
- inspector;
- scenario comparison.

Browser E2E:
1. login;
2. network;
3. historical real event;
4. Free Chlorine baseline;
5. map;
6. inspect;
7. scenario;
8. agent;
9. compare;
10. provenance;
11. Monochloramine run;
12. nitrification language.

# 15. No-mock runtime audit

Search:
```text
mock
fake
faker
synthetic
random
fallback
demoData
sampleData
```

Review every hit.

Allowed:
- tests;
- benchmark labels;
- synthetic georeferencing;
- controlled scientific fixtures.

Forbidden:
- runtime provider fallback;
- random risk data;
- canned agent answer;
- fake successful simulation.

# 16. Full demo rehearsal

Fresh DB:
1. start;
2. seed user;
3. load Net3;
4. acquire real historical FortyGuard event;
5. run Free Chlorine;
6. verify map;
7. select actual modeled zone;
8. manual scenario;
9. Gemini agent;
10. deterministic rejection/ranking;
11. apply best to digital twin;
12. compare;
13. provenance;
14. Monochloramine;
15. nitrification-conditions wording;
16. small resilience study;
17. refresh/restart worker and verify durable state.

Record run IDs and provider activity IDs.

# 17. Submission gate

Record results for:
- format;
- lint;
- TypeScript typecheck;
- JS tests;
- Python lint/type/test;
- web/api/worker builds;
- simulation Docker build;
- core E2E;
- accessibility critical checks;
- dependency audit review;
- live FortyGuard smoke;
- live Gemini smoke;
- deployment health.

Known warnings are documented, not silently ignored.
