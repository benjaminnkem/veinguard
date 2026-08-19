from __future__ import annotations

from dataclasses import dataclass, field
from math import exp, log

from veinguard_sim.chemistry.breach import target_breach
from veinguard_sim.chemistry.calibration import MonochloramineCalibration
from veinguard_sim.chemistry.kinetics import decay_residual
from veinguard_sim.thermal.mixing import mix_inflows
from veinguard_sim.thermal.network import (
    KIND_RESERVOIR,
    ThermalLinkSpec,
    ThermalNetworkSpec,
)
from veinguard_sim.thermal.pipes import (
    FLAG_CLOSED,
    FLAG_FLOWING,
    FLAG_REVERSED,
    FLAG_STAGNANT,
    residence_time_seconds,
)

SECONDS_PER_HOUR = 3600.0
STAGNANT_FLOW_M3S = 1.0e-8


def bulk_rate_per_second(temperature_c: float, calibration: MonochloramineCalibration) -> float:
    """Positive first-order NH2Cl decay (1/s) from the two published half-lives."""
    low, high = calibration.half_lives
    k0 = log(2.0) / (low.hours * SECONDS_PER_HOUR)
    k1 = log(2.0) / (high.hours * SECONDS_PER_HOUR)
    span = high.temperature_c - low.temperature_c
    if span == 0:
        return k0
    ln_k = log(k0) + (log(k1) - log(k0)) * (temperature_c - low.temperature_c) / span
    return exp(ln_k)


def validity_flags(
    *,
    temperature_c: float,
    ph: float,
    residual_mg_l: float,
    free_ammonia_mg_n_l: float,
    chlorine_to_nitrogen_ratio: float | None,
    calibration: MonochloramineCalibration,
) -> list[str]:
    flags: list[str] = []
    t_lo, t_hi = calibration.validity_temperature_c
    if temperature_c < t_lo or temperature_c > t_hi:
        flags.append("TEMPERATURE_OUTSIDE_REFERENCE")
    ph_lo, ph_hi = calibration.validity_ph
    if ph < ph_lo or ph > ph_hi:
        flags.append("PH_OUTSIDE_REFERENCE")
    r_lo, r_hi = calibration.validity_residual_mg_l
    if residual_mg_l < r_lo or residual_mg_l > r_hi:
        flags.append("RESIDUAL_OUTSIDE_REFERENCE")
    a_lo, a_hi = calibration.validity_free_ammonia_mg_n_l
    if free_ammonia_mg_n_l < a_lo or free_ammonia_mg_n_l > a_hi:
        flags.append("FREE_AMMONIA_OUTSIDE_REFERENCE")
    if chlorine_to_nitrogen_ratio is not None:
        c_lo, c_hi = calibration.validity_cl_n_ratio
        if chlorine_to_nitrogen_ratio < c_lo or chlorine_to_nitrogen_ratio > c_hi:
            flags.append("CL_N_OUTSIDE_REFERENCE")
    return flags


def validate_monochloramine_inputs(
    *,
    ph: float,
    residual_mg_l: float,
    free_ammonia_mg_n_l: float,
    water_age_hours: float,
) -> None:
    if not 0.0 < ph <= 14.0:
        raise ValueError("pH must be in (0, 14].")
    if residual_mg_l < 0.0:
        raise ValueError("Monochloramine residual cannot be negative.")
    if free_ammonia_mg_n_l < 0.0:
        raise ValueError("Free ammonia cannot be negative.")
    if water_age_hours < 0.0:
        raise ValueError("Water age cannot be negative.")


def pipe_outlet_residual(
    *,
    inlet_mg_l: float,
    temperature_c: float,
    length_m: float,
    diameter_m: float,
    flow_m3s: float,
    timestep_seconds: float,
    closed: bool,
    calibration: MonochloramineCalibration,
    previous_outlet_mg_l: float | None = None,
) -> tuple[float, str]:
    rate = bulk_rate_per_second(temperature_c, calibration)
    stored = previous_outlet_mg_l if previous_outlet_mg_l is not None else inlet_mg_l
    if closed:
        return decay_residual(stored, rate, timestep_seconds), FLAG_CLOSED
    abs_flow = abs(flow_m3s)
    if abs_flow <= STAGNANT_FLOW_M3S:
        return decay_residual(stored, rate, timestep_seconds), FLAG_STAGNANT
    tau = residence_time_seconds(length_m, diameter_m, abs_flow)
    outlet = decay_residual(inlet_mg_l, rate, tau)
    return outlet, FLAG_REVERSED if flow_m3s < 0 else FLAG_FLOWING


def pipe_outlet_ammonia(
    *,
    inlet_mg_n_l: float,
    flow_m3s: float,
    closed: bool,
    previous_outlet_mg_n_l: float | None = None,
) -> float:
    stored = previous_outlet_mg_n_l if previous_outlet_mg_n_l is not None else inlet_mg_n_l
    if closed or abs(flow_m3s) <= STAGNANT_FLOW_M3S:
        return max(0.0, stored)
    return max(0.0, inlet_mg_n_l)


def step_tank_residual(
    *,
    residual_mg_l: float,
    inflow_mg_l: float,
    inflow_m3s: float,
    volume_m3: float,
    temperature_c: float,
    timestep_seconds: float,
    calibration: MonochloramineCalibration,
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


def step_tank_ammonia(
    *,
    ammonia_mg_n_l: float,
    inflow_mg_n_l: float,
    inflow_m3s: float,
    volume_m3: float,
    timestep_seconds: float,
) -> float:
    if volume_m3 <= 0 or timestep_seconds <= 0:
        return max(0.0, ammonia_mg_n_l)
    q_over_v = max(inflow_m3s, 0.0) / volume_m3
    if q_over_v == 0:
        return max(0.0, ammonia_mg_n_l)
    updated = inflow_mg_n_l + (ammonia_mg_n_l - inflow_mg_n_l) * exp(
        -q_over_v * timestep_seconds
    )
    return max(0.0, updated)


@dataclass
class NodeMonochloramine:
    residual_mg_l: float
    free_ammonia_mg_n_l: float
    temperature_c: float
    water_age_hours: float
    target_breach: bool
    flags: list[str] = field(default_factory=list)


@dataclass
class MonochloramineState:
    nodes: dict[str, NodeMonochloramine]
    calibration_profile_id: str
    model_version: str
    operational_target_mg_l: float
    ph: float


def _upstream(link: ThermalLinkSpec) -> tuple[str, str]:
    if link.flow_m3s >= 0:
        return link.from_node_id, link.to_node_id
    return link.to_node_id, link.from_node_id


def step_monochloramine_network(
    *,
    network: ThermalNetworkSpec,
    residuals_mg_l: dict[str, float],
    temperatures_c: dict[str, float],
    water_age_hours: dict[str, float],
    free_ammonia_mg_n_l: dict[str, float],
    timestep_seconds: float,
    calibration: MonochloramineCalibration,
    source_residual_mg_l: float,
    source_free_ammonia_mg_n_l: float,
    ph: float,
    chlorine_to_nitrogen_ratio: float | None = None,
    mix_iterations: int = 8,
) -> MonochloramineState:
    conc = dict(residuals_mg_l)
    ammonia = dict(free_ammonia_mg_n_l)
    flags: dict[str, list[str]] = {node_id: [] for node_id in network.node_kinds}

    for node_id, kind in network.node_kinds.items():
        validate_monochloramine_inputs(
            ph=ph,
            residual_mg_l=conc.get(node_id, source_residual_mg_l),
            free_ammonia_mg_n_l=ammonia.get(node_id, source_free_ammonia_mg_n_l),
            water_age_hours=water_age_hours.get(node_id, 0.0),
        )
        if kind == KIND_RESERVOIR or node_id in network.source_node_ids:
            conc[node_id] = source_residual_mg_l
            ammonia[node_id] = source_free_ammonia_mg_n_l
            flags[node_id] = ["SOURCE"]

    outlets: dict[str, float] = {}
    ammonia_outlets: dict[str, float] = {}
    for _ in range(mix_iterations):
        incoming: dict[str, list[tuple[float, float]]] = {
            node_id: [] for node_id in network.node_kinds
        }
        incoming_nh3: dict[str, list[tuple[float, float]]] = {
            node_id: [] for node_id in network.node_kinds
        }
        for link in network.links:
            upstream, downstream = _upstream(link)
            inlet = conc.get(upstream, source_residual_mg_l)
            nh3_in = ammonia.get(upstream, source_free_ammonia_mg_n_l)
            temp = temperatures_c.get(upstream, calibration.half_lives[0].temperature_c)
            outlet, link_flag = pipe_outlet_residual(
                inlet_mg_l=inlet,
                temperature_c=temp,
                length_m=link.length_m,
                diameter_m=link.diameter_m,
                flow_m3s=link.flow_m3s,
                timestep_seconds=timestep_seconds,
                closed=link.closed,
                calibration=calibration,
                previous_outlet_mg_l=conc.get(downstream),
            )
            nh3_out = pipe_outlet_ammonia(
                inlet_mg_n_l=nh3_in,
                flow_m3s=link.flow_m3s,
                closed=link.closed,
                previous_outlet_mg_n_l=ammonia.get(downstream),
            )
            outlets[link.link_id] = outlet
            ammonia_outlets[link.link_id] = nh3_out
            if not link.closed:
                incoming[downstream].append((abs(link.flow_m3s), outlet))
                incoming_nh3[downstream].append((abs(link.flow_m3s), nh3_out))
            flags.setdefault(link.link_id, []).append(link_flag)

        for node_id, kind in network.node_kinds.items():
            if kind == KIND_RESERVOIR or node_id in network.source_node_ids:
                continue
            mixed, mix_flag = mix_inflows(
                incoming[node_id],
                conc.get(node_id, source_residual_mg_l),
                STAGNANT_FLOW_M3S,
            )
            mixed_nh3, _ = mix_inflows(
                incoming_nh3[node_id],
                ammonia.get(node_id, source_free_ammonia_mg_n_l),
                STAGNANT_FLOW_M3S,
            )
            conc[node_id] = mixed
            ammonia[node_id] = mixed_nh3
            if mix_flag not in flags[node_id]:
                flags[node_id].append(mix_flag)

    for tank in network.tanks:
        inflow = 0.0
        residual_mass = 0.0
        ammonia_mass = 0.0
        for link in network.links:
            _up, down = _upstream(link)
            if down == tank.node_id and not link.closed:
                q = abs(link.flow_m3s)
                if q > STAGNANT_FLOW_M3S:
                    inflow += q
                    fallback = conc.get(tank.node_id, source_residual_mg_l)
                    residual_mass += q * outlets.get(link.link_id, fallback)
                    nh3_fallback = ammonia.get(tank.node_id, source_free_ammonia_mg_n_l)
                    ammonia_mass += q * ammonia_outlets.get(link.link_id, nh3_fallback)
        cin = conc.get(tank.node_id, source_residual_mg_l)
        nh3_in = ammonia.get(tank.node_id, source_free_ammonia_mg_n_l)
        if inflow > STAGNANT_FLOW_M3S:
            cin = residual_mass / inflow
            nh3_in = ammonia_mass / inflow
        temp = temperatures_c.get(tank.node_id, calibration.half_lives[0].temperature_c)
        conc[tank.node_id] = step_tank_residual(
            residual_mg_l=conc.get(tank.node_id, source_residual_mg_l),
            inflow_mg_l=cin,
            inflow_m3s=inflow,
            volume_m3=tank.volume_m3,
            temperature_c=temp,
            timestep_seconds=timestep_seconds,
            calibration=calibration,
        )
        ammonia[tank.node_id] = step_tank_ammonia(
            ammonia_mg_n_l=ammonia.get(tank.node_id, source_free_ammonia_mg_n_l),
            inflow_mg_n_l=nh3_in,
            inflow_m3s=inflow,
            volume_m3=tank.volume_m3,
            timestep_seconds=timestep_seconds,
        )
        flags[tank.node_id] = ["TANK"]

    nodes: dict[str, NodeMonochloramine] = {}
    for node_id in network.node_kinds:
        residual = max(0.0, conc[node_id])
        nh3 = max(0.0, ammonia[node_id])
        temp = temperatures_c.get(node_id, calibration.half_lives[0].temperature_c)
        node_flags = flags.get(node_id, [])
        node_flags.extend(
            validity_flags(
                temperature_c=temp,
                ph=ph,
                residual_mg_l=residual,
                free_ammonia_mg_n_l=nh3,
                chlorine_to_nitrogen_ratio=chlorine_to_nitrogen_ratio,
                calibration=calibration,
            )
        )
        nodes[node_id] = NodeMonochloramine(
            residual_mg_l=residual,
            free_ammonia_mg_n_l=nh3,
            temperature_c=temp,
            water_age_hours=water_age_hours.get(node_id, 0.0),
            target_breach=target_breach(residual, calibration.operational_target_mg_l),
            flags=node_flags,
        )
    return MonochloramineState(
        nodes=nodes,
        calibration_profile_id=calibration.profile_id,
        model_version=calibration.model_version,
        operational_target_mg_l=calibration.operational_target_mg_l,
        ph=ph,
    )
