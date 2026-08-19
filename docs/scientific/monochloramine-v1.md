# monochloramine-v1

Binding decision: `docs/adr/ADR-007-monochloramine-nitrification.md`.

| Item | Value |
|---|---|
| Version | `monochloramine-v1` |
| Demo calibration | `literature-monochloramine-v1` |
| Kinetics | first-order bulk `C exp(-k τ)` |
| `k(T)` | log-linear in T between Vikesland/Health Canada t½ at pH 7.5: 300 h at 4 °C (bound), 75 h at 35 °C |
| Wall | off |
| Free ammonia | conservative transport, mg-N/L |
| pH / alkalinity / Cl:N | validated inputs; no invented rate terms |
| Transport | EPANET hydraulics; VeinGuard quality ODE |
| Target | configured `operationalTargetMgL` (demo 1.5 mg/L) |

Do not describe output as unsafe water. Do not describe this as the full Vikesland multi-species mechanism.
