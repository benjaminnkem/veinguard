# ADR-007 Monochloramine + nitrification scope

**Status:** Accepted for V1  
**Date:** 2026-08-19  
**Model versions:** `monochloramine-v1`, `nitrification-conditions-v1`

## Decision

V1 Monochloramine is a **distinct chemistry** from Free Chlorine. Residual uses first-order bulk decay on the same EPANET hydraulic residence times as `free-chlorine-v1`, with a **temperature-dependent rate fitted to published Vikesland (2001) half-lives at pH 7.5**, not the free-chlorine `k_ref` / hold-study coefficients.

```text
dC/dt = -k(T) C
C_out = C_in * exp(-k(T) * τ)
ln k(T) is linear in T between the two published half-life points
k(T) = ln(2) / t½(T)
t½(4 °C, pH 7.5) = 300 h   (implemented bound; source says "over 300 h")
t½(35 °C, pH 7.5) = 75 h
```

`τ` is the same `|V / Q|` used by the thermal and free-chlorine models. Junctions mix flow-weighted residual. Tanks are well-mixed CSTRs with the same `k(T)`. Residual is floored at 0.

This is **not** the full Vikesland / Jafvert–Valentine multi-species autodecomposition mechanism. It is a reduced residual operator that is required to reproduce the published half-life behavior and the expected hotter-faster monotonic response.

## Science gate (what was inspected)

### WNTR `batch_chloramine_decay`

Inspected at WNTR 1.5.0 `wntr/library/msx/batch_chloramine_decay.json` and current WNTR MSX docs (`libraries.html`, `waterquality_msx.html`).

| Finding | Detail |
|---|---|
| Scope | Named "Batch chloramine decay example" |
| Species | HOCL, NH3, NH2CL, NHCL2, intermediate I, carbonate system, formula `chloramine = 1000 * NH2CL` |
| Rates | Unified-model style `k1`…`k10` in **1/h**, concentrations in **mol** |
| Temperature | None. Coefficients are constants. |
| Tanks | `tank_reactions` is **empty** |
| Coupling | `NONE` |
| Quality | Equilibrium expression uses `HC03` (typo) |

Not a drop-in whole-distribution / tank solution. V1 does **not** run this MSX model.

### Roy, Sathasivan, Kastl (2020)

DOI `10.1016/j.scitotenv.2020.140410` is a listed primary source. Implementable rate equations and coefficients were **not** retrieved from a freely available full text. They are **not** invented.

### Vikesland, Ozekin, Valentine (2001)

DOI `10.1016/S0043-1354(00)00406-1`. Health Canada (2018) Chloramines GTD reports the experimental half-lives at pH 7.5: **over 300 h at 4 °C**, **75 h at 35 °C**. Those two numbers, plus the first-order half-life definition, are the V1 residual calibration.

Using 300 h for the 4 °C point is slightly **faster** than “over 300 h”. That overstates decay at cold temperature and is labeled `GREATER_THAN` in the calibration file.

## Why first-order, not full MSX

| Option | Finding |
|---|---|
| Drop in WNTR `batch_chloramine_decay` | Batch/pipe example; no tanks; no T; not a WDS residual model. |
| Re-implement Vikesland/Jafvert–Valentine MSX with T(x,t) | Authoritative for autodecomposition, but V1 cannot inject VeinGuard water temperature into MSX as a verified coupling, and the library rates are isothermal. |
| Roy 2020 simplified chemical model | Preferred WDS-oriented paper; equations not confirmed. Stopped rather than guess. |
| First-order residual from published t½(T) | Chosen. Reproduces known decay times, uses the same transport operators already gated for chlorine, remains distinct (`k` is ~4× smaller than literature free-chlorine `k_ref` at 20 °C). |

## Inputs that are real vs unused as kinetics

Required and used in residual:

- source monochloramine residual
- modeled water temperature
- hydraulic residence time

Required, validated, **not** used as an invented rate modifier:

- pH — V1 half-lives are at pH 7.5. Outside 6.5–9.0 is flagged `PH_OUTSIDE_REFERENCE`. Residual does not change with pH in V1.
- alkalinity and Cl/N — accepted as configuration; Cl/N outside 4.0–5.5 is flagged. No Roy/Vikesland coefficient is applied.

Required and transported:

- free ammonia (mg-N/L) — **conservative** solute (mix / advect / tank CSTR, no decay and no yield from NH2Cl loss). Used by the nitrification-conditions indicator. V1 does not invent an ammonia–residual coupling.

## Target breach

A node is in projected operational-target breach when modeled residual `< operationalTargetMgL`. Demo default is **1.5 mg/L**, the Health Canada / EPA-cited nitrification-prevention practice residual, stored as a configured target. Language is “projected below configured operational target,” never “unsafe.”

## Nitrification V1

`nitrification-conditions-v1` is a **conditions indicator**, not a microbial population, nitrite/nitrate, or probability model.

Drivers (all versioned, sourced, configurable):

| Driver | Demo threshold | Source class |
|---|---|---|
| `HIGH_WATER_AGE` | ≥ 48 h | OPERATIONAL_GUIDANCE (TCEQ: high age / tanks / dead-ends; hour cutoff is ours and labeled) |
| `ELEVATED_WATER_TEMPERATURE` | ≥ 15 °C | LITERATURE_REFERENCE (favorable nitrifier growth ~15–30 °C) |
| `LOW_MONOCHLORAMINE_RESIDUAL` | < 1.5 mg/L | OPERATIONAL_GUIDANCE (Health Canada / EPA 1999 practice) |
| `FREE_AMMONIA_PRESENT` | ≥ 0.05 mg-N/L | OPERATIONAL_GUIDANCE (TCEQ preferably < 0.05 mg/L leaving the plant) |

`DEPOSIT_OR_SEDIMENT_FACTOR` is in the contract vocabulary and is **not** emitted: V1 has no sediment state.

Level: `LOW` = 0 drivers, `ELEVATED` = 1–2, `HIGH` = 3–4. No `83% risk` field.

## Out of scope

- Roy 2020 coefficients
- EPANET-MSX runtime
- Microbial nitrification kinetics
- Nitrite / nitrate concentrations
- Wall reaction
- Site-specific hold-study `k`
- Calling modeled water unsafe
