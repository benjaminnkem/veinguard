# water-temp-v1

Versioned model card. Binding equations and citations are in `docs/adr/ADR-005-water-temperature-model.md`.

| Item | Value |
|---|---|
| Version | `water-temp-v1` |
| Demo calibration | `literature-water-temp-v1` |
| Source class | `LITERATURE_REFERENCE` |
| Air → water | forbidden (air is boundary only) |
| Pipe | `T_out = T_b + (T_in - T_b) exp(-k τ)`, `k = 4U/(ρ c_p D)` |
| Soil | first-order lag, `τ = z²/α` |
| Tank | well-mixed energy balance; solar omitted unless provided |

Primary references: Blokker et al. 2024 (DOI 10.3390/w16192796); Blokker and Pieterse-Quirijns 2013; Díaz et al. 2023; Kusuda and Achenbach 1965.
