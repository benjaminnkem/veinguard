from __future__ import annotations

from dataclasses import dataclass, field

from veinguard_sim.thermal.calibration import ThermalCalibration
from veinguard_sim.thermal.mixing import mix_inflows
from veinguard_sim.thermal.pipes import pipe_outlet_temperature
from veinguard_sim.thermal.soil import step_soil_temperature
from veinguard_sim.thermal.tanks import step_tank_temperature

KIND_JUNCTION = "JUNCTION"
KIND_RESERVOIR = "RESERVOIR"
KIND_TANK = "TANK"


@dataclass
class ThermalLinkSpec:
    link_id: str
    from_node_id: str
    to_node_id: str
    length_m: float
    diameter_m: float
    flow_m3s: float
    closed: bool = False


@dataclass
class ThermalTankSpec:
    node_id: str
    volume_m3: float
    diameter_m: float
    level_m: float


@dataclass
class ThermalNetworkSpec:
    node_kinds: dict[str, str]
    links: list[ThermalLinkSpec]
    tanks: list[ThermalTankSpec]
    source_node_ids: tuple[str, ...] = ()


@dataclass
class NodeThermal:
    temperature_c: float
    flags: list[str] = field(default_factory=list)
    boundary_temperature_c: float | None = None


@dataclass
class ThermalState:
    node_temperature_c: dict[str, NodeThermal]
    soil_temperature_c: float
    calibration_profile_id: str
    model_version: str
    solar_present: bool


def _upstream(link: ThermalLinkSpec) -> tuple[str, str]:
    if link.flow_m3s >= 0:
        return link.from_node_id, link.to_node_id
    return link.to_node_id, link.from_node_id


def step_thermal_network(
    *,
    network: ThermalNetworkSpec,
    state: ThermalState,
    air_temperature_c: float,
    timestep_seconds: float,
    calibration: ThermalCalibration,
    source_temperature_c: float,
    solar_irradiance_w_m2: float | None = None,
    mix_iterations: int = 8,
) -> ThermalState:
    soil = step_soil_temperature(
        state.soil_temperature_c,
        air_temperature_c,
        timestep_seconds,
        calibration,
    )
    temps = {node_id: node.temperature_c for node_id, node in state.node_temperature_c.items()}
    prev_outlet = {
        node_id: node.temperature_c for node_id, node in state.node_temperature_c.items()
    }
    flags: dict[str, list[str]] = {node_id: [] for node_id in network.node_kinds}

    for node_id, kind in network.node_kinds.items():
        if kind == KIND_RESERVOIR or node_id in network.source_node_ids:
            temps[node_id] = source_temperature_c
            flags[node_id] = ["SOURCE"]

    outlets: dict[str, float] = {}
    for _ in range(mix_iterations):
        incoming: dict[str, list[tuple[float, float]]] = {
            node_id: [] for node_id in network.node_kinds
        }
        for link in network.links:
            upstream, downstream = _upstream(link)
            inlet = temps.get(upstream, source_temperature_c)
            outlet, link_flag = pipe_outlet_temperature(
                inlet_temperature_c=inlet,
                boundary_temperature_c=soil,
                length_m=link.length_m,
                diameter_m=link.diameter_m,
                flow_m3s=link.flow_m3s,
                timestep_seconds=timestep_seconds,
                closed=link.closed,
                calibration=calibration,
                previous_outlet_c=prev_outlet.get(downstream),
            )
            outlets[link.link_id] = outlet
            if not link.closed:
                incoming[downstream].append((abs(link.flow_m3s), outlet))
            flags.setdefault(link.link_id, [])
            if link_flag not in flags[link.link_id]:
                flags[link.link_id].append(link_flag)

        for node_id, kind in network.node_kinds.items():
            if kind == KIND_RESERVOIR or node_id in network.source_node_ids:
                continue
            mixed, mix_flag = mix_inflows(
                incoming[node_id],
                temps.get(node_id, source_temperature_c),
                calibration.stagnant_flow_m3s,
            )
            temps[node_id] = mixed
            node_flags = flags[node_id]
            if mix_flag not in node_flags:
                node_flags.append(mix_flag)

    tank_inflow_temp = dict(temps)
    for tank in network.tanks:
        inflow = 0.0
        inflow_heat = 0.0
        for link in network.links:
            _up, down = _upstream(link)
            if down == tank.node_id and not link.closed:
                q = abs(link.flow_m3s)
                if q > calibration.stagnant_flow_m3s:
                    inflow += q
                    fallback = temps.get(tank.node_id, source_temperature_c)
                    inflow_heat += q * outlets.get(link.link_id, fallback)
        t_in = tank_inflow_temp.get(tank.node_id, source_temperature_c)
        if inflow > calibration.stagnant_flow_m3s:
            t_in = inflow_heat / inflow
        updated, tank_flags = step_tank_temperature(
            temperature_c=temps.get(tank.node_id, source_temperature_c),
            inflow_temperature_c=t_in,
            inflow_m3s=inflow,
            volume_m3=tank.volume_m3,
            diameter_m=tank.diameter_m,
            level_m=tank.level_m,
            air_temperature_c=air_temperature_c,
            timestep_seconds=timestep_seconds,
            calibration=calibration,
            solar_irradiance_w_m2=solar_irradiance_w_m2,
        )
        temps[tank.node_id] = updated
        flags[tank.node_id] = tank_flags

    next_nodes = {
        node_id: NodeThermal(
            temperature_c=temps[node_id],
            flags=flags.get(node_id, []),
            boundary_temperature_c=(
                soil if network.node_kinds.get(node_id) != KIND_RESERVOIR else None
            ),
        )
        for node_id in network.node_kinds
    }
    return ThermalState(
        node_temperature_c=next_nodes,
        soil_temperature_c=soil,
        calibration_profile_id=calibration.profile_id,
        model_version=calibration.model_version,
        solar_present=solar_irradiance_w_m2 is not None,
    )
