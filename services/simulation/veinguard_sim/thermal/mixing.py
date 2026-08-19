from __future__ import annotations

FLAG_MIXED = "MIXED"
FLAG_NO_INFLOW = "NO_INFLOW"


def mix_inflows(
    inflows: list[tuple[float, float]],
    previous_temperature_c: float,
    stagnant_flow_m3s: float,
) -> tuple[float, str]:
    weighted = 0.0
    total = 0.0
    for flow, temperature in inflows:
        if flow > stagnant_flow_m3s:
            weighted += flow * temperature
            total += flow
    if total <= 0:
        return previous_temperature_c, FLAG_NO_INFLOW
    return weighted / total, FLAG_MIXED
