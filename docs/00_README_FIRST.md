# VeinGuard Engineering Handoff

**Project:** VeinGuard  
**Purpose:** Production-minded FortyGuard hackathon build and future live product  
**Prepared:** 2026-08-18

## Read this first

VeinGuard is a heat-aware digital twin and decision-support system for drinking-water distribution networks.

It combines:

1. **real FortyGuard thermal intelligence**;
2. a **real EPANET 2.2 hydraulic/water-quality simulation** through EPA/WNTR tooling;
3. deterministic **water-temperature and disinfectant chemistry models**;
4. deterministic **operational constraints and scenario scoring**; and
5. a **Gemini-powered AI operations agent** that investigates and proposes typed scenarios.

The core product question is:

> Given the thermal conditions affecting this modeled water network, where is a configured water-quality operational target projected to be breached, when might that happen, why, and which feasible simulated intervention best improves the modeled state?

### Runtime integrity

There must be **no fake runtime fallback data** in required flows.

- FortyGuard unavailable + no exact previously fetched real cache => show thermal data unavailable.
- EPANET failure => simulation fails visibly.
- Gemini unavailable => manual scenarios still work; no canned AI response.
- No random risk scores.
- Test doubles are allowed in unit tests only.

### Benchmark network is allowed; fake claims are not

The demo should use an official/legitimate EPA EPANET benchmark network such as Net3 unless an authorized real utility network is later supplied.

That network must be visibly labeled as a **benchmark/demo network**.

If its non-geographic coordinates are placed inside a FortyGuard AOI, that is **synthetic georeferencing**. Preserve topology and disclose the transformation. Never claim those pipes are the real infrastructure of Phoenix or another city.

## What is real vs calculated

| Item | Classification |
|---|---|
| FortyGuard heatmap/environmental response | Real external data or explicitly cached-real response |
| EPA Net3 topology | Real benchmark model |
| Net3 placement inside a demo AOI | Synthetic georeferencing |
| Pressure, flow, tank state, water age | Actual EPANET calculations |
| Water temperature | VeinGuard deterministic heat-transfer calculation |
| Free chlorine residual | Deterministic validated chemistry + transport calculation |
| Monochloramine residual | Deterministic validated chemistry + transport calculation |
| Nitrification V1 | Conditions/risk indicator, not a microbial concentration prediction |
| Gemini recommendation | AI decision support over typed tools |
| Real pump/valve actuation | Out of V1 scope |

## Product surfaces

### Operations
MapLibre geographic map with:
- FortyGuard thermal layer;
- benchmark water-network overlay;
- pressure/flow/water-age/residual layers;
- target-breach state;
- time slider;
- asset inspection and provenance.

### Digital Twin
React Flow network canvas:
- reservoirs, tanks, pumps, valves, junctions and pipes;
- pan/zoom;
- time state;
- upstream/downstream tracing;
- asset inspection;
- scenario preview.

This is **not** a full CAD/network editor.

### Intervention Lab
Users or the agent test:
- pump schedule/setting changes;
- tank-control/turnover changes;
- valve changes;
- flushing events;
- disinfectant booster changes.

Every candidate is actually simulated and checked against hard constraints.

### Resilience
Historical real FortyGuard events are replayed against the model to identify recurring modeled vulnerability and planning priorities.

## Disinfection profiles

### Active V1
- **Free Chlorine**
- **Monochloramine**

### Visible, disabled, coming soon
- Chlorine Dioxide
- Advanced Multi-Species Chemistry

Do not put UV or ozone in the distribution residual-disinfectant selector. They can later belong to a treatment-plant profile.

## Claim language

Use:
- "projected operational target breach";
- "modeled residual";
- "configured operational target";
- "conditions favorable for nitrification";
- "benchmark network";
- "historical replay using real FortyGuard data";
- "decision-support simulation".

Do not use without later evidence:
- "unsafe water";
- "contaminated water";
- "FortyGuard measures water temperature";
- "AI controls the utility";
- "this is the real Phoenix water network";
- "nitrification will occur at X time".

## Repository target

```text
veinguard/
├── apps/
│   ├── web/                 # Next.js
│   ├── api/                 # NestJS
│   └── worker/              # NestJS/BullMQ worker
├── services/
│   └── simulation/          # Python/FastAPI/WNTR/EPANET
├── packages/
│   ├── contracts/
│   ├── config/
│   ├── ui/
│   ├── eslint-config/
│   └── tsconfig/
├── data/
│   ├── networks/
│   └── calibration/
├── docs/
│   ├── adr/
│   ├── scientific/
│   └── runbooks/
├── scripts/
├── docker/
├── .github/workflows/
├── AGENTS.md
├── pnpm-workspace.yaml
├── turbo.json
└── docker-compose.yml
```

## Mandatory reading order for Codex

1. `00_README_FIRST.md`
2. `AGENTS.md`
3. `01_PRD.md`
4. `02_TECHNICAL_SPECIFICATION.md`
5. `03_SCIENTIFIC_MODEL_SPEC.md`
6. `04_API_AND_DATA_CONTRACTS.md`
7. `05_UI_UX_SPEC.md`
8. `06_SECURITY_RELIABILITY_SCALABILITY.md`
9. `07_CODEX_BUILD_PLAN.md`
10. `08_CODEX_PROMPTS.md`
11. `09_ENVIRONMENT_SETUP.md`
12. `10_TESTING_VALIDATION_RUNBOOK.md`
13. `11_DEPLOYMENT_AND_COST.md`
14. `12_SOURCES_AND_DOCS.md`
15. `13_DECISIONS_AND_OPEN_QUESTIONS.md`

## Core demo definition of done

The product is not demo-ready until this works end to end:

1. Validate/load benchmark `.inp`.
2. Run actual EPANET hydraulics and water age.
3. Fetch real FortyGuard thermal data.
4. Associate thermal cells with the synthetically georeferenced benchmark network.
5. Calculate water-temperature state.
6. Run selected Free Chlorine or Monochloramine profile.
7. Detect configured target breach if the real scenario produces one.
8. Operator asks e.g. **"Protect Zone C through midnight without flushing."**
9. Gemini returns typed tool calls/candidate plans.
10. Backend validates candidate constraints before simulation.
11. Actual EPANET/scientific simulations run.
12. Hard-constraint failures are rejected.
13. Deterministic objective chooses best feasible candidate.
14. Gemini explains the deterministic selection.
15. UI shows before/after and provenance.
16. Heat remains unchanged between before/after; the water-network state changes.

If a selected real heat event does not demonstrate target stress, test another eligible real historical event. Never modify outputs to force the story.

## First Codex action

Do not generate the whole application immediately.

Run **Prompt 00** in `08_CODEX_PROMPTS.md` first. It requires Codex to read this handoff, re-check current official docs, verify package/runtime compatibility, and surface only genuinely material questions before implementation.
