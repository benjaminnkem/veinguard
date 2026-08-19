from __future__ import annotations

from math import exp

from veinguard_sim.thermal.calibration import ThermalCalibration


def soil_lag_seconds(calibration: ThermalCalibration) -> float:
    if calibration.ground_thermal_diffusivity_m2s <= 0:
        raise ValueError("Ground thermal diffusivity must be positive.")
    if calibration.burial_depth_m < 0:
        raise ValueError("Burial depth must be non-negative.")
    return (calibration.burial_depth_m**2) / calibration.ground_thermal_diffusivity_m2s


def step_soil_temperature(
    soil_temperature_c: float,
    air_temperature_c: float,
    timestep_seconds: float,
    calibration: ThermalCalibration,
) -> float:
    if timestep_seconds < 0:
        raise ValueError("Timestep must be non-negative.")
    tau = soil_lag_seconds(calibration)
    if tau == 0 or timestep_seconds == 0:
        return soil_temperature_c
    return soil_temperature_c + (air_temperature_c - soil_temperature_c) * (
        1.0 - exp(-timestep_seconds / tau)
    )
