from __future__ import annotations

from math import exp

from veinguard_sim.chemistry.calibration import FreeChlorineCalibration

SECONDS_PER_DAY = 86400.0


def bulk_rate_per_second(temperature_c: float, calibration: FreeChlorineCalibration) -> float:
    """Positive first-order decay rate (1/s). Decay uses C' = -k C."""
    k_ref = calibration.bulk_decay_per_day / SECONDS_PER_DAY
    factor = float(calibration.theta ** (temperature_c - calibration.reference_temperature_c))
    return k_ref * factor


def decay_residual(
    concentration_mg_l: float,
    rate_per_second: float,
    duration_seconds: float,
) -> float:
    if concentration_mg_l <= 0:
        return 0.0
    if rate_per_second == 0 or duration_seconds == 0:
        return concentration_mg_l
    remaining = concentration_mg_l * exp(-rate_per_second * duration_seconds)
    return 0.0 if remaining < 1e-12 else remaining
