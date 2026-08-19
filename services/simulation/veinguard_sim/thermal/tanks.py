from __future__ import annotations

from math import exp, pi

from veinguard_sim.thermal.calibration import ThermalCalibration

FLAG_TANK = "TANK"
FLAG_SOLAR_ABSENT = "SOLAR_ABSENT"
FLAG_EMPTY_TANK = "EMPTY_TANK"


def step_tank_temperature(
    *,
    temperature_c: float,
    inflow_temperature_c: float,
    inflow_m3s: float,
    volume_m3: float,
    diameter_m: float,
    level_m: float,
    air_temperature_c: float,
    timestep_seconds: float,
    calibration: ThermalCalibration,
    solar_irradiance_w_m2: float | None,
) -> tuple[float, list[str]]:
    flags = [FLAG_TANK]
    if volume_m3 <= 0 or timestep_seconds <= 0:
        return temperature_c, [FLAG_EMPTY_TANK]

    wall_area = pi * diameter_m * max(level_m, 0.0)
    roof_area = pi * diameter_m**2 / 4.0
    exchange_area = wall_area + roof_area
    k_tank = 0.0
    if exchange_area > 0:
        k_tank = (calibration.tank_overall_heat_transfer_w_m2_k * exchange_area) / (
            calibration.water_density_kg_m3 * calibration.water_specific_heat_j_kg_k * volume_m3
        )

    q_solar = 0.0
    if solar_irradiance_w_m2 is None:
        flags.append(FLAG_SOLAR_ABSENT)
    elif roof_area > 0:
        q_solar = (
            calibration.tank_solar_absorptance * roof_area * solar_irradiance_w_m2
        ) / (calibration.water_density_kg_m3 * calibration.water_specific_heat_j_kg_k * volume_m3)

    q_over_v = max(inflow_m3s, 0.0) / volume_m3
    decay = q_over_v + k_tank
    if decay == 0:
        return temperature_c + q_solar * timestep_seconds, flags

    t_eq = (q_over_v * inflow_temperature_c + k_tank * air_temperature_c + q_solar) / decay
    updated = t_eq + (temperature_c - t_eq) * exp(-decay * timestep_seconds)
    return updated, flags
