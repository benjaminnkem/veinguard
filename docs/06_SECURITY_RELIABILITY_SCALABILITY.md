# VeinGuard — Security, Reliability & Scalability Specification

# 1. Trust boundaries

```text
Untrusted browser
   -> Next.js
   -> NestJS public API
        -> MongoDB
        -> Redis/BullMQ
        -> external providers
        -> internal simulation service
```

Simulation service is internal, not a public product API.

# 2. Secrets

Server-only:
- FortyGuard API key;
- Groq API key;
- Mongo URI;
- Redis credentials;
- JWT secrets;
- simulation-service token.

Browser only:
- public API base;
- map provider style/public token if provider explicitly supports browser exposure.

No secret uses `NEXT_PUBLIC_`.

# 3. Authentication

- Argon2id;
- normalized email;
- login rate limiting;
- short-lived access token;
- rotating refresh token;
- refresh token stored as hash;
- revoke/logout;
- roles ADMIN/OPERATOR/VIEWER.

Future production may add SSO/MFA.

# 4. Authorization

Every domain query scopes by organization.

Do not fetch by raw ID and assume ownership.

# 5. Input security

- global DTO/schema validation;
- reject unknown fields;
- body-size limits;
- AOI geometry complexity limits;
- `.inp` upload size/content validation;
- no user-controlled filesystem path;
- no shell interpolation;
- no arbitrary URL fetch;
- cleanup temp files.

# 6. Internal service auth

Worker/API -> simulation:
```text
Authorization: Bearer <SIMULATION_SERVICE_TOKEN>
```

Simulation independently validates input.

Future production:
- private network;
- service identity/mTLS.

# 7. Provider resilience

## FortyGuard
- connect/read timeout;
- async activity timeout;
- bounded backoff;
- translate provider errors;
- persist activity ID before polling;
- no blind duplicate retry if POST result is ambiguous and could create duplicate paid work.

If POST times out after possible provider acceptance:
- mark ambiguous;
- reconcile if provider supports it;
- otherwise surface controlled retry decision.

## Groq
- timeout;
- 429 handling;
- bounded retry;
- no repeated side effects;
- idempotent tool operations.

## Simulation
- wall timeout;
- CPU/memory benchmark;
- convergence errors;
- explicit failure.

# 8. Idempotency

Required around expensive/create operations:
- thermal acquisition;
- simulation create;
- scenario run;
- agent start where key supplied.

Canonical semantic request hash prevents accidental duplicate work.

# 9. Queues

```text
fortyguard
simulation
agent
resilience

BullMQ 5+ forbids `:` in the queue name. Redis keys are namespaced with prefix `veinguard`.
```

Bound concurrency.

No unbounded fan-out.

Interactive simulation/agent work should have higher priority than batch resilience where implementation permits.

# 10. Backpressure

- per-user/org rate limits;
- queue depth metrics;
- bounded resilience event count;
- agent scenario budget;
- provider-aware concurrency;
- simulation CPU concurrency.

# 11. Cancellation

- durable cancellation requested;
- worker checks between phases;
- external provider may not be cancellable;
- valid completed provider response can still be cached;
- cancelled parent not marked successful.

# 12. Scalability path

Hackathon:
- small API;
- API/worker potentially co-located;
- one simulation service;
- Mongo Free;
- Redis Free;
- low concurrency.

Production:
- horizontal API;
- queue-autoscaled workers;
- simulation pool;
- managed Redis;
- dedicated Mongo;
- object storage for artifacts;
- private networking;
- observability;
- tenant quotas;
- data residency.

# 13. Simulation isolation

Per run:
- immutable inputs;
- isolated WNTR model;
- controlled temp dir;
- cleanup;
- no global mutated network.

Verify EPANET/WNTR thread/process safety before selecting parallel execution model.

# 14. Time

- store UTC;
- preserve original/local timezone metadata for event/AOI display;
- request planner explicitly handles provider time semantics;
- never rely on server local timezone.

# 15. Geometry

Validate:
- GeoJSON type;
- closed ring;
- coordinate ranges;
- finite numbers;
- area/current plan;
- polygon complexity.

V1 may restrict to simple polygon AOIs.

# 16. Data retention

Hackathon:
- keep run summaries/provenance;
- keep real provider responses required for reproducibility;
- keep benchmark artifacts;
- large time-series retention configurable.

Production:
- organization policies;
- export/delete;
- backup/legal requirements.

# 17. Audit

Audit:
- auth events;
- network import;
- calibration changes;
- thermal acquisition;
- simulation;
- scenario;
- agent run;
- digital-twin apply;
- admin changes.

Append-oriented. Do not overwrite historical provenance.

# 18. Failure matrix

| Failure | Behavior |
|---|---|
| Mongo down | readiness false; no durable work accepted |
| Redis down | reads may work; new jobs unavailable |
| FortyGuard down | exact cached-real if policy permits; otherwise unavailable |
| Groq down | manual scenario mode works |
| Simulation down | reads work; new simulations unavailable |
| EPANET nonconvergence | failed run; no fake values |
| SSE drop | reconnect/refetch canonical state |
| Worker restart | durable jobs resume/reconcile |
| Browser refresh | durable run remains |

# 19. Rate limits

At minimum:
- login;
- thermal acquisitions;
- simulation creates;
- agent creates;
- file uploads.

# 20. Cost controls

- FortyGuard cache;
- request dedupe;
- only needed env params;
- reasonable polling;
- compact Groq context;
- max agent steps/simulations;
- bounded resilience;
- Redis command monitoring.

# 21. Performance tests

Benchmark:
- topology response;
- layer response;
- simulation duration;
- artifact size;
- normal API concurrent reads;
- queue burst;
- cache hits;
- SSE reconnect;
- max allowed upload if uploads supported.

# 22. Dependency/supply chain

- lockfiles;
- dependency audit;
- no unpinned git packages;
- verified licenses;
- pinned/sensible Docker images;
- review native EPANET/MSX packaging.

# 23. Critical-infrastructure sensitivity

Do not ingest a real utility network unless:
- user is authorized;
- data handling is agreed;
- deployment security is appropriate.

Hackathon uses benchmark data.
