from __future__ import annotations

from dataclasses import dataclass, field

from veinguard_sim.chemistry.breach import target_breach
from veinguard_sim.chemistry.calibration import FreeChlorineCalibration
from veinguard_sim.chemistry.transport import pipe_outlet_residual, step_tank_residual
from veinguard_sim.thermal.mixing import mix_inflows
from veinguard_sim.thermal.network import (
    KIND_RESERVOIR,
    ThermalLinkSpec,
    ThermalNetworkSpec,
)


@dataclass
class NodeChlorine:
    residual_mg_l: float
    temperature_c: float
    target_breach: bool
    flags: list[str] = field(default_factory=list)


@dataclass
class ChlorineState:
    nodes: dict[str, NodeChlorine]
    calibration_profile_id: str
    model_version: str
    operational_target_mg_l: float


def _upstream(link: ThermalLinkSpec) -> tuple[str, str]:
    if link.flow_m3s >= 0:
        return link.from_node_id, link.to_node_id
    return link.to_node_id, link.from_node_id


def step_free_chlorine_network(
    *,
    network: ThermalNetworkSpec,
    residuals_mg_l: dict[str, float],
    temperatures_c: dict[str, float],
    timestep_seconds: float,
    calibration: FreeChlorineCalibration,
    source_residual_mg_l: float,
    mix_iterations: int = 8,
) -> ChlorineState:
    conc = dict(residuals_mg_l)
    flags: dict[str, list[str]] = {node_id: [] for node_id in network.node_kinds}

    for node_id, kind in network.node_kinds.items():
        if kind == KIND_RESERVOIR or node_id in network.source_node_ids:
            conc[node_id] = source_residual_mg_l
            flags[node_id] = ["SOURCE"]

    outlets: dict[str, float] = {}
    for _ in range(mix_iterations):
        incoming: dict[str, list[tuple[float, float]]] = {
            node_id: [] for node_id in network.node_kinds
        }
        for link in network.links:
            upstream, downstream = _upstream(link)
            inlet = conc.get(upstream, source_residual_mg_l)
            temp = temperatures_c.get(upstream, calibration.reference_temperature_c)
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
            outlets[link.link_id] = outlet
            if not link.closed:
                incoming[downstream].append((abs(link.flow_m3s), outlet))
            flags.setdefault(link.link_id, []).append(link_flag)

        for node_id, kind in network.node_kinds.items():
            if kind == KIND_RESERVOIR or node_id in network.source_node_ids:
                continue
            mixed, mix_flag = mix_inflows(
                incoming[node_id],
                conc.get(node_id, source_residual_mg_l),
                1.0e-8,
            )
            conc[node_id] = mixed
            if mix_flag not in flags[node_id]:
                flags[node_id].append(mix_flag)

    for tank in network.tanks:
        inflow = 0.0
        heat = 0.0
        for link in network.links:
            _up, down = _upstream(link)
            if down == tank.node_id and not link.closed:
                q = abs(link.flow_m3s)
                if q > 1.0e-8:
                    inflow += q
                    fallback = conc.get(tank.node_id, source_residual_mg_l)
                    heat += q * outlets.get(link.link_id, fallback)
        cin = conc.get(tank.node_id, source_residual_mg_l)
        if inflow > 1.0e-8:
            cin = heat / inflow
        temp = temperatures_c.get(tank.node_id, calibration.reference_temperature_c)
        conc[tank.node_id] = step_tank_residual(
            residual_mg_l=conc.get(tank.node_id, source_residual_mg_l),
            inflow_mg_l=cin,
            inflow_m3s=inflow,
            volume_m3=tank.volume_m3,
            temperature_c=temp,
            timestep_seconds=timestep_seconds,
            calibration=calibration,
        )
        flags[tank.node_id] = ["TANK"]

    nodes = {
        node_id: NodeChlorine(
            residual_mg_l=max(0.0, conc[node_id]),
            temperature_c=temperatures_c.get(node_id, calibration.reference_temperature_c),
            target_breach=target_breach(conc[node_id], calibration.operational_target_mg_l),
            flags=flags.get(node_id, []),
        )
        for node_id in network.node_kinds
    }
    return ChlorineState(
        nodes=nodes,
        calibration_profile_id=calibration.profile_id,
        model_version=calibration.model_version,
        operational_target_mg_l=calibration.operational_target_mg_l,
    )
