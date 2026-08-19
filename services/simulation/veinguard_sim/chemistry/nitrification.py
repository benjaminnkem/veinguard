from __future__ import annotations

from dataclasses import dataclass

from veinguard_sim.chemistry.calibration import NitrificationThresholds

DRIVER_HIGH_WATER_AGE = "HIGH_WATER_AGE"
DRIVER_ELEVATED_TEMPERATURE = "ELEVATED_WATER_TEMPERATURE"
DRIVER_LOW_RESIDUAL = "LOW_MONOCHLORAMINE_RESIDUAL"
DRIVER_FREE_AMMONIA = "FREE_AMMONIA_PRESENT"

LEVEL_LOW = "LOW"
LEVEL_ELEVATED = "ELEVATED"
LEVEL_HIGH = "HIGH"


@dataclass(frozen=True)
class NitrificationConditions:
    level: str
    label: str
    drivers: tuple[str, ...]
    model_version: str
    threshold_profile_id: str


def evaluate_nitrification_conditions(
    *,
    water_age_hours: float,
    temperature_c: float,
    residual_mg_l: float,
    free_ammonia_mg_n_l: float,
    thresholds: NitrificationThresholds,
) -> NitrificationConditions:
    drivers: list[str] = []
    if water_age_hours >= thresholds.high_water_age_hours:
        drivers.append(DRIVER_HIGH_WATER_AGE)
    if temperature_c >= thresholds.elevated_temperature_c:
        drivers.append(DRIVER_ELEVATED_TEMPERATURE)
    if residual_mg_l < thresholds.low_residual_mg_l:
        drivers.append(DRIVER_LOW_RESIDUAL)
    if free_ammonia_mg_n_l >= thresholds.free_ammonia_mg_n_l:
        drivers.append(DRIVER_FREE_AMMONIA)

    count = len(drivers)
    if count >= thresholds.high_min_drivers:
        level = LEVEL_HIGH
    elif count >= thresholds.elevated_min_drivers:
        level = LEVEL_ELEVATED
    else:
        level = LEVEL_LOW

    label = (
        thresholds.label_when_not_indicated
        if level == LEVEL_LOW
        else thresholds.label_when_favorable
    )
    return NitrificationConditions(
        level=level,
        label=label,
        drivers=tuple(drivers),
        model_version=thresholds.model_version,
        threshold_profile_id=thresholds.profile_id,
    )


def worst_nitrification(
    per_node: dict[str, NitrificationConditions],
) -> NitrificationConditions:
    rank = {LEVEL_LOW: 0, LEVEL_ELEVATED: 1, LEVEL_HIGH: 2}
    worst: NitrificationConditions | None = None
    for item in per_node.values():
        if worst is None or rank[item.level] > rank[worst.level]:
            worst = item
        elif worst is not None and rank[item.level] == rank[worst.level]:
            merged = tuple(sorted(set(worst.drivers) | set(item.drivers)))
            worst = NitrificationConditions(
                level=worst.level,
                label=worst.label,
                drivers=merged,
                model_version=worst.model_version,
                threshold_profile_id=worst.threshold_profile_id,
            )
    if worst is None:
        raise ValueError("No nitrification results to summarize.")
    return worst
