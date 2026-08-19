# nitrification-conditions-v1

Binding decision: `docs/adr/ADR-007-monochloramine-nitrification.md`.

| Item | Value |
|---|---|
| Version | `nitrification-conditions-v1` |
| Demo thresholds | `nitrification-conditions-v1` |
| Kind | categorical conditions indicator |
| Not | microbial kinetics, nitrite/nitrate, or a probability |

| Driver | Demo threshold |
|---|---|
| `HIGH_WATER_AGE` | ≥ 48 h |
| `ELEVATED_WATER_TEMPERATURE` | ≥ 15 °C |
| `LOW_MONOCHLORAMINE_RESIDUAL` | < 1.5 mg/L |
| `FREE_AMMONIA_PRESENT` | ≥ 0.05 mg-N/L |

Label when any driver is present: `Conditions favorable for nitrification`.
