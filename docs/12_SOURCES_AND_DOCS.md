# VeinGuard — Source & Documentation Index

**Rule:** Current official documentation overrides this handoff when APIs/packages change.

# 1. FortyGuard — mandatory current source

Root:
- https://docs-api.fortyguard.com/

Core:
- https://docs-api.fortyguard.com/docs/authentication
- https://docs-api.fortyguard.com/docs/quickstart
- https://docs-api.fortyguard.com/docs/create-heatmap
- https://docs-api.fortyguard.com/docs/environmental-parameters
- https://docs-api.fortyguard.com/docs/check-status
- https://docs-api.fortyguard.com/docs/release-notes

Before provider changes also inspect current:
- Known Limitations;
- Credits Usage;
- account/plan constraints;
- linked schemas.

Facts verified for this handoff, but still re-check:
- `api-key` header authentication;
- asynchronous POST -> `activity_id` -> status polling;
- Heatmap historical support from 2019-01-01;
- current docs advertise up to +12h future;
- GeoJSON `map_data` + statistics;
- TCM/time-of-measure/exceedance/persistence;
- current Basic Heatmap docs: up to 10 mi², Premium up to 50 mi²;
- Environmental Parameters current Basic docs: up to 3 selected parameters/request.

Pricing:
- https://www.fortyguard.com/api-pricing

# 2. EPA EPANET

- https://www.epa.gov/water-research/epanet
- https://github.com/USEPA/EPANET2.2

# 3. EPA WNTR

Root:
- https://usepa.github.io/WNTR/

Getting started / Net3:
- https://usepa.github.io/WNTR/getting_started.html

Hydraulics:
- https://usepa.github.io/WNTR/hydraulics.html

Water quality:
- https://usepa.github.io/WNTR/waterquality.html

Multi-species:
- https://usepa.github.io/WNTR/waterquality_msx.html

Libraries:
- https://usepa.github.io/WNTR/libraries.html

Repository:
- https://github.com/USEPA/WNTR

WNTR's reaction library currently includes a `batch_chloramine_decay` example. It must be inspected/validated rather than assumed to be a drop-in complete distribution model.

# 4. EPA chloramine/nitrification/distribution resources

- https://www.epa.gov/dwreginfo/drinking-water-distribution-system-tools-and-resources
- https://www.epa.gov/emergency-response-research/drinking-water-tools
- https://www.epa.gov/emergency-response-research/water-modeling-tools-decision-support
- https://www.epa.gov/dwreginfo/chloramines-drinking-water
- https://www.epa.gov/sdwa/free-chlorine-distribution-system-influent-hold-study-protocol

Use current EPA resources for nitrification factors/operational guidance. Do not treat one reference threshold as universally regulatory.

# 5. Water-temperature science

Primary:
- Blokker, Pan, van Laarhoven (2024)
- *Validation of an Enhanced Drinking Water Temperature Model during Distribution*
- Water 16(19), 2796
- https://doi.org/10.3390/w16192796

# 6. Free chlorine and temperature

Primary:
- *Relationship between chlorine decay and temperature in the drinking water*
- MethodsX (2020)
- https://doi.org/10.1016/j.mex.2020.101002

Use together with EPA hold-study methodology. Never transplant a site-specific fitted coefficient as universal.

# 7. Monochloramine

Primary:
- *Simplified chemical chloramine decay model for water distribution systems*
- Science of the Total Environment (2020)
- https://doi.org/10.1016/j.scitotenv.2020.140410

Primary:
- *Monochloramine Decay in Model and Distribution System Waters*
- Water Research (2001)
- https://doi.org/10.1016/S0043-1354(00)00406-1

Validate model domain and parameter meaning before implementation.

# 8. Gemini

- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/function-calling
- https://ai.google.dev/gemini-api/docs/models
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://ai.google.dev/gemini-api/docs/deprecations

Important verified handoff fact:
- `gemini-3.6-flash` is a stable model with no announced shutdown date at the
  time of this migration, not an eternal lock.

Gemini Structured Outputs/tool-use limitations should be re-read when implementing. Do not assume strict JSON Schema mode can be combined with every tool/streaming pattern.

# 9. Next.js

- https://nextjs.org/docs/app
- https://nextjs.org/docs/app/guides/environment-variables

# 10. NestJS

- https://docs.nestjs.com/
- https://docs.nestjs.com/techniques/validation
- https://docs.nestjs.com/techniques/configuration
- https://docs.nestjs.com/openapi/introduction
- https://docs.nestjs.com/techniques/server-sent-events

# 11. MongoDB

- https://www.mongodb.com/docs/drivers/node/current/
- https://www.mongodb.com/docs/atlas/driver-connection/
- https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/
- https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/

# 12. BullMQ / Redis

- https://docs.bullmq.io/
- https://upstash.com/docs/redis/integrations/bullmq
- https://upstash.com/pricing/redis

BullMQ polling can generate substantial Redis commands; monitor free-tier usage.

# 13. MapLibre

- https://maplibre.org/maplibre-gl-js/docs/
- https://maplibre.org/maplibre-gl-js/docs/API/classes/GeoJSONSource/

# 14. React Flow

- https://reactflow.dev/

Package:
```text
@xyflow/react
```

# 15. Render

- https://render.com/docs/free
- https://render.com/docs/web-services

# 16. Source rules for Codex

For volatile integrations:
- record access date;
- record exact page;
- current official docs win.

For science:
- cite the paper/reference in model docs/ADR;
- record parameter source and units;
- record validity range;
- never use opaque internet constants.

For FortyGuard:
- source every endpoint implementation from current official docs at build time.

For runtime:
- never substitute a third-party unofficial API wrapper when official contract is available.
