# ADR-006 Free Chlorine coupling

**Status:** Accepted for V1  
**Date:** 2026-08-19  
**Model version:** `free-chlorine-v1`

## Decision

V1 Free Chlorine is **not** computed by EPANET’s CHEMICAL solver under time-varying temperature. VeinGuard applies first-order bulk decay on EPANET hydraulic residence times, using the local modeled water temperature from `water-temp-v1`.

```text
dC/dt = -k(T) C
C_out = C_in * exp(-k(T) * τ)
k(T) = k_ref * θ^(T - T_ref)
```

`τ` is the same `|V / Q|` used by the thermal model. Junctions mix flow-weighted residual. Tanks are well-mixed CSTRs with the same `k(T)`. Residual is floored at 0.

## Why not native EPANET CHEMICAL for V1 T-coupling

Current WNTR/EPANET 2.2 CHEMICAL uses a **constant** first-order bulk coefficient for a quality run (`wn.options.reaction.bulk_coeff`, SI **per second**, negative for decay). Per-pipe `pipe.bulk_coeff` can override the global value, still constant for that run.

That does **not** ingest a spatial/time-varying water-temperature field from VeinGuard.

Options considered:

| Option | Finding |
|---|---|
| Per-link `bulk_coeff` | Works for a **representative** T per pipe, not T(t) inside one run. |
| Stepped EPANET windows | Possible via `initial_quality` + re-run, but each window still uses constant kb; stitching must be proven. Deferred. |
| EPANET-MSX | Can express T-dependent rates, but T would still need to be injected as our model state. Not required for V1 bulk chlorine. |
| VeinGuard ODE on EPANET hydraulics | Chosen. State-preserving, uses signed flow, same stagnant/reversal rules as thermal. |

## Constant-T science gate

At uniform T, `k` is constant, so the VeinGuard pipe/tank operators are the same ODE EPANET integrates. A one-pipe WNTR CHEMICAL run at that T is the reference. VeinGuard must match node residual within a documented tolerance. This is **not** a claim that EPANET computed the temperature-aware case.

## Temperature dependence

MethodsX (García-Ávila et al., 2020, DOI 10.1016/j.mex.2020.101002) treats bulk chlorine as first-order and shows `kb` increases with temperature. V1 uses the common van ’t Hoff form `θ^(T-T_ref)` with literature `θ = 1.05` and `T_ref = 20 °C` (Powell-type default). Coefficients in `literature-free-chlorine-v1` are **not** a utility hold-study fit.

Wall reaction is **off** in the literature profile (hold-study bulk analogue).

## Target breach

A node is in projected operational-target breach when modeled residual `< operationalTargetMgL`. Language is “projected below configured operational target,” never “unsafe.”

## Out of scope

- Monochloramine (Phase 05)
- Time-varying EPANET/MSX coefficient injection
- Site-specific hold-study `kb`
