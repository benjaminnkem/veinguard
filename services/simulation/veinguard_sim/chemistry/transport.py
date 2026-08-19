from __future__ import annotations

from math import exp

from veinguard_sim.chemistry.calibration import FreeChlorineCalibration
from veinguard_sim.chemistry.kinetics import bulk_rate_per_second, decay_residual
from veinguard_sim.thermal.pipes import (
    FLAG_CLOSED,
    FLAG_FLOWING,
    FLAG_REVERSED,
    FLAG_STAGNANT,
    residence_time_seconds,
)


def pipe_outlet_residual(
    *,
    inlet_mg_l: float,
    temperature_c: float,
    length_m: float,
    diameter_m: float,
    flow_m3s: float,
    timestep_seconds: float,
    closed: bool,
    calibration: FreeChlorineCalibration,
    previous_outlet_mg_l: float | None = None,
) -> tuple[float, str]:
    rate = bulk_rate_per_second(temperature_c, calibration)
    stored = previous_outlet_mg_l if previous_outlet_mg_l is not None else inlet_mg_l
    if closed:
        return decay_residual(stored, rate, timestep_seconds), FLAG_CLOSED
    abs_flow = abs(flow_m3s)
    if abs_flow <= 1.0e-8:
        return decay_residual(stored, rate, timestep_seconds), FLAG_STAGNANT
    tau = residence_time_seconds(length_m, diameter_m, abs_flow)
    outlet = decay_residual(inlet_mg_l, rate, tau)
    return outlet, FLAG_REVERSED if flow_m3s < 0 else FLAG_FLOWING


def step_tank_residual(
    *,
    residual_mg_l: float,
    inflow_mg_l: float,
    inflow_m3s: float,
    volume_m3: float,
    temperature_c: float,
    timestep_seconds: float,
    calibration: FreeChlorineCalibration,
) -> float:
    if volume_m3 <= 0 or timestep_seconds <= 0:
        return max(0.0, residual_mg_l)
    rate = bulk_rate_per_second(temperature_c, calibration)
    q_over_v = max(inflow_m3s, 0.0) / volume_m3
    decay = q_over_v + rate
    if decay == 0:
        return max(0.0, residual_mg_l)
    c_eq = (q_over_v * inflow_mg_l) / decay
    updated = c_eq + (residual_mg_l - c_eq) * exp(-decay * timestep_seconds)
    return max(0.0, updated)
