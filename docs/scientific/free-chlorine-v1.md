# free-chlorine-v1

Binding decision: `docs/adr/ADR-006-free-chlorine-coupling.md`.

| Item | Value |
|---|---|
| Version | `free-chlorine-v1` |
| Demo calibration | `literature-free-chlorine-v1` |
| Kinetics | first-order bulk `C exp(-k τ)` |
| `k(T)` | `k_ref * θ^(T-20)`, `θ=1.05`, `k_ref=0.5 /day` |
| Wall | off |
| Transport | EPANET hydraulics; VeinGuard quality ODE |
| Target | configured `operationalTargetMgL` |

Do not describe output as unsafe water.
