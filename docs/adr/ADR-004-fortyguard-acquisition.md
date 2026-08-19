# ADR-004 FortyGuard acquisition and cache

**Status:** Accepted for V1  
**Date:** 2026-08-19

## Decision

VeinGuard talks to FortyGuard only from the Nest API and worker. The browser never sees `api-key`. There is no synthetic thermal fallback.

## Contract consulted (2026-08-19)

Pages:

- https://docs-api.fortyguard.com/docs/authentication
- https://docs-api.fortyguard.com/docs/quickstart
- https://docs-api.fortyguard.com/docs/create-heatmap
- https://docs-api.fortyguard.com/docs/environmental-parameters
- https://docs-api.fortyguard.com/docs/check-status
- https://docs-api.fortyguard.com/docs/limitations
- https://docs-api.fortyguard.com/docs/release-notes

The public docs site is an Angular SPA; fields were taken from the current `main.*.js` bundle plus those routes.

Auth: `api-key` request header. No OAuth.

Submit: `POST https://api.fortyguard.com/v1/heatmap` → `{ data.activity_id }`.

Poll: `GET https://api.fortyguard.com/v1/status/{activity_id}` until `Processing` | `Completed` | `Failed`.

Completed heatmap: `data.result.map_data` (GeoJSON) and `data.result.stats_data`.

## Planner

Product `POST /v1/thermal/acquisitions` is translated to current-valid provider calls:

| Product window | Provider `filter_type` |
|---|---|
| Single whole hour | 1 |
| Range of hours, same calendar day | 2 |
| Full local day 00:00–24:00 | 3 |
| Cross-midnight / multi-day | split into 1–3; **never 4** |

Create Heatmap lists `filter_type` 4. Known Limitations allow only 1–3. V1 follows Limitations and splits.

Other constraints from current docs:

- dates from `2019-01-01` through now + 12 h (heatmap forecast)
- granularity 60 / 80 / 100
- US-only coordinates
- closed Polygon FeatureCollection
- Basic default AOI cap 10 mi² (`FORTYGUARD_MAX_AOI_SQ_MI`)

## Cache and freshness

Canonical SHA-256 over endpoint, hash version, and normalized request JSON.

Only **Completed** real provider payloads are cached in Mongo (`fortyguard_completed_cache`). A cache hit is `CACHED_REAL` and includes original `fetchedAt` / `originalFreshness`. It is never labeled `LIVE`.

## Jobs

The worker POSTs at most once per slice. `activity_id` is persisted before polling. POST timeout after possible accept is `AMBIGUOUS_POST` and is **not** retried. GET status may retry.

## Environmental Parameters

`POST /v1/env_params` is implemented on the client. V1 acquisitions do not call it unless `includeSolarIrradiance` is true (tank solar). Default is off. Basic/Startup are limited to 3 parameters; solar-only stays inside that cap.

## Out of scope

- Satellite / street-view / heat-intelligence (Premium)
- Invented temperatures when FortyGuard is down
