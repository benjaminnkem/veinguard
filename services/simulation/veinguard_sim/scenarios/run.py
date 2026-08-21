from __future__ import annotations

import copy
from datetime import datetime
from typing import Any
from uuid import uuid4

from veinguard_sim.chemistry.calibration import load_free_chlorine_calibration
from veinguard_sim.chemistry.network import step_free_chlorine_network
from veinguard_sim.constraints.evaluate import evaluate_constraints, load_constraints
from veinguard_sim.epanet.engine import engine_versions, load_network, run_hydraulics_and_age
from veinguard_sim.inputs import resolve_inp
from veinguard_sim.interventions.apply import apply_interventions
from veinguard_sim.interventions.types import (
    ChangeBoosterProfile,
    parse_interventions,
)
from veinguard_sim.objective.score import load_objective, score_objective
from veinguard_sim.settings import get_settings
from veinguard_sim.thermal.calibration import load_thermal_calibration
from veinguard_sim.thermal.network import (
    KIND_RESERVOIR,
    KIND_TANK,
    NodeThermal,
    ThermalLinkSpec,
    ThermalNetworkSpec,
    ThermalState,
    ThermalTankSpec,
    step_thermal_network,
)
from veinguard_sim.topology import prefixed_id


def run_scenario(
    *,
    network_id: str,
    interventions_raw: list[dict[str, Any]],
    horizon_start: str,
    constraints_profile_id: str = "demo-constraints-v1",
    objective_profile_id: str = "demo-objective-v1",
    sample_time_seconds: float | None = 3600.0,
    timestep_seconds: float = 3600.0,
    source_temperature_c: float = 15.0,
    air_temperature_c: float = 20.0,
    source_residual_mg_l: float | None = None,
    operational_target_mg_l: float | None = None,
    scenario_run_id: str | None = None,
) -> dict[str, Any]:
    origin = datetime.fromisoformat(horizon_start.replace("Z", "+00:00"))
    interventions = parse_interventions(interventions_raw, origin)

    loaded = resolve_inp(network_id, None)
    base = load_network(loaded.inp_bytes)
    base_pump_status = {pid: str(base.get_link(pid).initial_status) for pid in base.pump_name_list}

    isolated = copy.deepcopy(base)
    metrics = apply_interventions(isolated, interventions)
    if base_pump_status != {
        pid: str(base.get_link(pid).initial_status) for pid in base.pump_name_list
    }:
        raise RuntimeError("Base network was mutated; scenario isolation failed.")

    tmp_bytes = _wn_to_bytes(isolated)
    hydraulics = run_hydraulics_and_age(
        tmp_bytes,
        timeout_seconds=get_settings().simulation_timeout_seconds,
        sample_time_seconds=sample_time_seconds,
    )

    constraints_profile = load_constraints(constraints_profile_id)
    constraint_results = evaluate_constraints(
        profile=constraints_profile,
        hydraulics=hydraulics,
        wn=isolated,
    )
    feasible = all(row["passed"] for row in constraint_results)

    chemistry_cal = load_free_chlorine_calibration()
    source_residual = (
        source_residual_mg_l
        if source_residual_mg_l is not None
        else chemistry_cal.source_residual_mg_l
    )
    target = (
        operational_target_mg_l
        if operational_target_mg_l is not None
        else chemistry_cal.operational_target_mg_l
    )
    thermal_cal = load_thermal_calibration()
    network = _thermal_network(isolated, hydraulics)
    thermal = step_thermal_network(
        network=network,
        state=ThermalState(
            node_temperature_c={
                node_id: NodeThermal(temperature_c=source_temperature_c)
                for node_id in network.node_kinds
            },
            soil_temperature_c=air_temperature_c,
            calibration_profile_id=thermal_cal.profile_id,
            model_version=thermal_cal.model_version,
            solar_present=False,
        ),
        air_temperature_c=air_temperature_c,
        timestep_seconds=timestep_seconds,
        calibration=thermal_cal,
        source_temperature_c=source_temperature_c,
    )
    booster_sources = {
        _prefixed_node(isolated, item.source_node_id): item.value
        for item in interventions
        if isinstance(item, ChangeBoosterProfile)
    }
    extra_sources = tuple(booster_sources)
    chemistry_network = ThermalNetworkSpec(
        node_kinds=network.node_kinds,
        links=network.links,
        tanks=network.tanks,
        source_node_ids=network.source_node_ids + extra_sources,
    )
    residuals = {node_id: source_residual for node_id in network.node_kinds}
    residuals.update(booster_sources)
    chemistry = step_free_chlorine_network(
        network=chemistry_network,
        residuals_mg_l=residuals,
        temperatures_c={
            node_id: node.temperature_c for node_id, node in thermal.node_temperature_c.items()
        },
        timestep_seconds=timestep_seconds,
        calibration=chemistry_cal,
        source_residual_mg_l=source_residual,
    )
    breach_count = sum(1 for node in chemistry.nodes.values() if node.residual_mg_l < target)
    deficit = sum(max(0.0, target - node.residual_mg_l) for node in chemistry.nodes.values())

    objective_profile = load_objective(objective_profile_id)
    objective = None
    if feasible:
        objective = score_objective(
            objective_profile,
            residual_deficit=deficit,
            target_breach_count=breach_count,
            flush_water_liters=float(metrics["flushWaterLiters"]),
            chemical_increment_mg=float(metrics["chemicalIncrementMg"]),
            energy_kwh=0.0,
            switching_complexity=float(metrics["switchingComplexity"]),
        )

    engines = engine_versions()
    run_id = scenario_run_id or str(uuid4())
    return {
        "scenarioRunId": run_id,
        "networkId": loaded.network_id,
        "sourceType": loaded.source_type,
        "sha256": loaded.sha256,
        "feasible": feasible,
        "objective": objective,
        "constraints": constraint_results,
        "metrics": {
            "flushWaterLiters": metrics["flushWaterLiters"],
            "chemicalIncrementMg": metrics["chemicalIncrementMg"],
            "energyDeltaKwh": None,
            "switchingComplexity": metrics["switchingComplexity"],
            "targetBreachCount": breach_count,
            "residualDeficitIntegral": deficit,
        },
        "hydraulics": {
            "converged": hydraulics.converged,
            "summary": {
                "minPressureM": hydraulics.summary.min_pressure_m,
                "maxPressureM": hydraulics.summary.max_pressure_m,
                "minWaterAgeHours": hydraulics.summary.min_water_age_hours,
                "maxWaterAgeHours": hydraulics.summary.max_water_age_hours,
            },
        },
        "baseNetworkImmutable": True,
        "networkState": _network_state(isolated, hydraulics, chemistry, target),
        "provenance": {
            "constraintsProfileId": constraints_profile.profile_id,
            "objectiveProfileId": objective_profile.profile_id,
            "objectiveProfileVersion": objective_profile.model_version,
            "engines": {
                "wntrVersion": engines.wntr_version,
                "epanetVersion": engines.epanet_version,
                "simulationServiceVersion": engines.simulation_service_version,
            },
        },
    }


def _network_state(wn: Any, hydraulics: Any, chemistry: Any, target: float) -> dict[str, Any]:
    nodes: list[dict[str, Any]] = []
    for kind, names in (
        ("JUNCTION", wn.junction_name_list),
        ("RESERVOIR", wn.reservoir_name_list),
        ("TANK", wn.tank_name_list),
    ):
        for source_id in names:
            node_id = prefixed_id(kind, source_id)
            hyd = hydraulics.nodes.get(source_id, {})
            chem = chemistry.nodes.get(node_id)
            residual = chem.residual_mg_l if chem is not None else None
            nodes.append(
                {
                    "id": node_id,
                    "sourceId": source_id,
                    "type": kind,
                    "pressureM": hyd.get("pressureM"),
                    "waterAgeHours": hyd.get("waterAgeHours"),
                    "residualMgL": residual,
                    "projectedTargetBreach": bool(chem.target_breach) if chem is not None else False,
                }
            )
    links: list[dict[str, Any]] = []
    for kind, names in (
        ("PIPE", wn.pipe_name_list),
        ("PUMP", wn.pump_name_list),
        ("VALVE", wn.valve_name_list),
    ):
        for source_id in names:
            hyd = hydraulics.links.get(source_id, {})
            links.append(
                {
                    "id": prefixed_id(kind, source_id),
                    "sourceId": source_id,
                    "type": kind,
                    "flowM3s": hyd.get("flowM3s"),
                    "velocityMs": hyd.get("velocityMs"),
                }
            )
    return {"nodes": nodes, "links": links, "operationalTargetMgL": target}


def _wn_to_bytes(wn: Any) -> bytes:
    import tempfile
    from pathlib import Path

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "scenario.inp"
        import wntr.network.io as wntr_io

        wntr_io.write_inpfile(wn, str(path))
        return path.read_bytes()


def _prefixed_node(wn: Any, source_id: str) -> str:
    if source_id in wn.junction_name_list:
        return prefixed_id("JUNCTION", source_id)
    if source_id in wn.reservoir_name_list:
        return prefixed_id("RESERVOIR", source_id)
    if source_id in wn.tank_name_list:
        return prefixed_id("TANK", source_id)
    return source_id


def _thermal_network(wn: Any, hydraulics: Any) -> ThermalNetworkSpec:
    from math import pi

    node_kinds: dict[str, str] = {}
    source_ids: list[str] = []
    for source_id in wn.junction_name_list:
        node_kinds[prefixed_id("JUNCTION", source_id)] = "JUNCTION"
    for source_id in wn.reservoir_name_list:
        pid = prefixed_id("RESERVOIR", source_id)
        node_kinds[pid] = KIND_RESERVOIR
        source_ids.append(pid)
    tanks: list[ThermalTankSpec] = []
    for source_id in wn.tank_name_list:
        pid = prefixed_id("TANK", source_id)
        node_kinds[pid] = KIND_TANK
        source_ids.append(pid)
        tank = wn.get_node(source_id)
        diameter = float(tank.diameter)
        level = float(tank.init_level)
        tanks.append(
            ThermalTankSpec(
                node_id=pid,
                volume_m3=pi * diameter**2 / 4.0 * max(level, 0.0),
                diameter_m=diameter,
                level_m=level,
            )
        )
    links: list[ThermalLinkSpec] = []
    for source_id in wn.pipe_name_list:
        link = wn.get_link(source_id)
        start = str(link.start_node_name)
        end = str(link.end_node_name)
        flow = hydraulics.links.get(source_id, {}).get("flowM3s") or 0.0
        links.append(
            ThermalLinkSpec(
                link_id=prefixed_id("PIPE", source_id),
                from_node_id=_prefixed_node(wn, start),
                to_node_id=_prefixed_node(wn, end),
                length_m=float(link.length),
                diameter_m=float(link.diameter),
                flow_m3s=float(flow),
            )
        )
    return ThermalNetworkSpec(
        node_kinds=node_kinds,
        links=links,
        tanks=tanks,
        source_node_ids=tuple(source_ids),
    )
