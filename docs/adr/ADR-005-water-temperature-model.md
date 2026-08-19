# ADR-005 Water-temperature model

**Status:** Accepted for V1  
**Date:** 2026-08-19  
**Model version:** `water-temp-v1`

## Decision

VeinGuard V1 models drinking-water temperature with a first-order pipe/soil exchange, a lagged buried-pipe soil boundary, flow-weighted junction mixing, and a well-mixed tank energy balance. FortyGuard air temperature is an environmental boundary, never the water temperature.

## Pipe water

For approximately constant boundary temperature and heat-transfer coefficient over a segment:

```text
T_out = T_boundary + (T_in - T_boundary) * exp(-k * τ)
```

This is the integrated form of `dT/dτ = k (T_boundary - T)` stated in the scientific spec. Díaz et al. (2023), following Blokker and Pieterse-Quirijns (2013), write the equivalent length form

```text
T(x) = T_ground + (T_in - T_ground) * exp(-x / (Q * ρ * c_p * R))
```

Identifying `τ = A x / |Q|` and `k = 1 / (ρ c_p A R)` recovers the spec form. For a circular pipe the lumped overall heat-transfer coefficient `U` [W/m²/K] gives

```text
k = 4 U / (ρ c_p D)
```

`U` is taken from a versioned calibration profile. It is not a universal constant.

## Contact time

```text
τ = (π D² / 4) * L / |Q|
```

Signed EPANET flow chooses the upstream node. `|Q|` is used in `τ` so reversal does not produce negative time. If `|Q|` is below `stagnantFlowM3s`, the link is treated as stagnant and the water already in the pipe relaxes over the hydraulic timestep:

```text
T(t+Δt) = T_boundary + (T - T_boundary) * exp(-k * Δt)
```

Division by near-zero flow is never performed. Closed links do not transport.

## Soil boundary

Blokker and Pieterse-Quirijns (2013) report that soil temperature at about 1 m depth varies by no more than about 1 °C per day; daily air swings are damped. V1 uses a first-order lag, allowed by the scientific spec:

```text
T_soil(t+Δt) = T_soil + (T_air - T_soil) * (1 - exp(-Δt / τ_soil))
τ_soil = z² / α_ground
```

`z` is burial depth and `α_ground` is a literature soil thermal diffusivity. This is **not** an instantaneous copy of air temperature and **not** the full Kusuda–Achenbach annual field. Kusuda and Achenbach (1965) remain the cited analytic annual solution if a later profile needs climate-scale initialization.

## Junctions

Incoming links are those with flow into the node above the stagnant threshold. Mixed temperature is flow-weighted. A node with no inflow is isolated: it keeps its previous temperature and is flagged `NO_INFLOW`.

## Tanks

Well-mixed energy balance with constant coefficients over one hydraulic step:

```text
dT/dt = (Q_in / V) (T_in - T) + k_tank (T_amb - T) + q_solar
k_tank = U A / (ρ c_p V)
T_eq = ( (Q_in/V) T_in + k_tank T_amb + q_solar ) / (Q_in/V + k_tank)
T(t+Δt) = T_eq + (T - T_eq) * exp( -(Q_in/V + k_tank) Δt )
```

`T_amb` is air temperature (exposed tank). If solar irradiance is absent, `q_solar = 0` and the result is flagged `SOLAR_ABSENT`. Solar is never invented.

## Calibration

Demo defaults live in `data/calibration/literature-water-temp-v1.json`, source `LITERATURE_REFERENCE`. They are not utility-calibrated.

## Out of scope

- FortyGuard HTTP calls (Phase 06)
- Coupled finite ground heat capacity (Díaz et al.)
- Chemistry (Phase 04+)
