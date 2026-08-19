from __future__ import annotations

from math import exp, pi

from veinguard_sim.thermal.calibration import ThermalCalibration

FLAG_FLOWING = "FLOWING"
FLAG_STAGNANT = "STAGNANT"
FLAG_CLOSED = "CLOSED_LINK"
FLAG_REVERSED = "FLOW_REVERSED"


def pipe_rate_constant(diameter_m: float, calibration: ThermalCalibration) -> float:
    if diameter_m <= 0:
        raise ValueError("Pipe diameter must be positive.")
    return (4.0 * calibration.pipe_overall_heat_transfer_w_m2_k) / (
        calibration.water_density_kg_m3 * calibration.water_specific_heat_j_kg_k * diameter_m
    )


def residence_time_seconds(length_m: float, diameter_m: float, abs_flow_m3s: float) -> float:
    if length_m < 0 or diameter_m <= 0:
        raise ValueError("Pipe geometry is invalid.")
    area = pi * diameter_m**2 / 4.0
    return area * length_m / abs_flow_m3s


def relax(temperature_c: float, boundary_c: float, k: float, duration_seconds: float) -> float:
    if k == 0 or duration_seconds == 0:
        return temperature_c
    return boundary_c + (temperature_c - boundary_c) * exp(-k * duration_seconds)


def pipe_outlet_temperature(
    *,
    inlet_temperature_c: float,
    boundary_temperature_c: float,
    length_m: float,
    diameter_m: float,
    flow_m3s: float,
    timestep_seconds: float,
    closed: bool,
    calibration: ThermalCalibration,
    previous_outlet_c: float | None = None,
) -> tuple[float, str]:
    k = pipe_rate_constant(diameter_m, calibration)
    if closed:
        stored = previous_outlet_c if previous_outlet_c is not None else inlet_temperature_c
        return relax(stored, boundary_temperature_c, k, timestep_seconds), FLAG_CLOSED

    abs_flow = abs(flow_m3s)
    if abs_flow <= calibration.stagnant_flow_m3s:
        stored = previous_outlet_c if previous_outlet_c is not None else inlet_temperature_c
        return relax(stored, boundary_temperature_c, k, timestep_seconds), FLAG_STAGNANT

    tau = residence_time_seconds(length_m, diameter_m, abs_flow)
    outlet = relax(inlet_temperature_c, boundary_temperature_c, k, tau)
    flag = FLAG_REVERSED if flow_m3s < 0 else FLAG_FLOWING
    return outlet, flag
