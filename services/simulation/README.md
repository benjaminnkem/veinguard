# Simulation service

Internal FastAPI service. WNTR 1.5 / EPANET 2.2. Requires Python 3.11–3.13 (CI uses 3.12).

```bash
# from repo root
pnpm setup:simulation
pnpm dev:simulation
```

Authenticated with `Authorization: Bearer $SERVICE_TOKEN`. Health is public.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health/live` | process up |
| GET | `/health/ready` | WNTR importable and Net3 present |
| POST | `/v1/networks/validate` | parse + asset check |
| POST | `/v1/networks/topology` | normalized nodes/links |
| POST | `/v1/simulations/hydraulics` | EPANET hydraulics + water age |

Body is exactly one of:

```json
{ "networkId": "epa-net3" }
```

or

```json
{ "inpText": "[TITLE]\n..." }
```

The bundled network is EPA EPANET Example Network 3, labeled `EPA_BENCHMARK`.
