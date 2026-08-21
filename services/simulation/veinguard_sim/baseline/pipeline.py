from __future__ import annotations

import json
from math import pi
from pathlib import Path
from typing import Any

from veinguard_sim.catalog import EPA_NET3_ID
from veinguard_sim.chemistry.calibration import load_free_chlorine_calibration
from veinguard_sim.chemistry.network import step_free_chlorine_network
from veinguard_sim.epanet.engine import engine_versions, load_network, run_hydraulics_and_age
from veinguard_sim.georeference.associate import FLAG_NO_THERMAL_COVERAGE, associate_assets
from veinguard_sim.inputs import resolve_inp
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
from veinguard_sim.topology import normalize_topology


def fixture_dir() -> Path:
    configured = Path(get_settings().fixture_data_dir)
    if not configured.is_absolute():
        from_cwd = (Path.cwd() / configured).resolve()
        if from_cwd.exists():
            return from_cwd
        return (Path(__file__).resolve().parents[4] / "data" / "fixtures").resolve()
    return configured


def load_fortyguard_snapshot(
    fixture_id: str | None,
    inline: dict[str, Any] | None,
) -> dict[str, Any]:
    if (fixture_id is None) == (inline is None):
        raise ValueError("Provide exactly one of fortyGuard.fixtureId or fortyGuard.snapshot.")
    if fixture_id:
        path = fixture_dir() / "fortyguard" / f"{fixture_id}.json"
        if not path.is_file():
            raise FileNotFoundError(f"Unknown FortyGuard fixture '{fixture_id}'.")
        loaded_json: object = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(loaded_json, dict):
            raise ValueError("FortyGuard fixture must be a JSON object.")
        payload = loaded_json
    else:
        payload = inline or {}
    provenance = payload.get("provenance")
    raw = payload.get("rawResponse")
    if not isinstance(provenance, dict) or not isinstance(raw, dict):
        raise ValueError("FortyGuard snapshot must include provenance and rawResponse.")
    if provenance.get("provider") != "FORTYGUARD":
        raise ValueError("Snapshot provider must be FORTYGUARD.")
    if not provenance.get("activityId"):
        raise ValueError("Snapshot is missing provider activityId.")
    data = raw.get("data")
    if not isinstance(data, dict) or data.get("status") != "Completed":
        raise ValueError("Only a Completed FortyGuard response can drive a baseline.")
    result = data.get("result")
    if not isinstance(result, dict):
        raise ValueError("Completed FortyGuard response has no result.")
    map_data = result.get("map_data")
    if not isinstance(map_data, dict) or map_data.get("type") != "FeatureCollection":
        raise ValueError("Completed FortyGuard map_data must be a GeoJSON FeatureCollection.")
    return payload


def _prefixed(kind: str, source_id: str) -> str:
    from veinguard_sim.topology import prefixed_id

    return prefixed_id(kind, source_id)


def _tank_geometry(wn: Any, source_id: str) -> ThermalTankSpec:
    tank = wn.get_node(source_id)
    diameter = float(getattr(tank, "diameter", 10.0) or 10.0)
    level = float(getattr(tank, "init_level", None) or getattr(tank, "level", 1.0) or 1.0)
    volume = pi * (diameter**2) / 4.0 * max(level, 0.0)
    return ThermalTankSpec(
        node_id=_prefixed("TANK", source_id),
        volume_m3=volume,
        diameter_m=diameter,
        level_m=level,
    )


def run_baseline(
    *,
    network_id: str = EPA_NET3_ID,
    georeference_profile_id: str = "synthetic-georef-v1",
    fixture_id: str | None = None,
    snapshot: dict[str, Any] | None = None,
    sample_time_seconds: float | None = 3600.0,
    timestep_seconds: float = 3600.0,
    source_temperature_c: float = 15.0,
    source_residual_mg_l: float | None = None,
    operational_target_mg_l: float | None = None,
    chemistry_profile_id: str = "literature-free-chlorine-v1",
    thermal_profile_id: str = "literature-water-temp-v1",
) -> dict[str, Any]:
    snapshot_payload = load_fortyguard_snapshot(fixture_id, snapshot)
    provenance = snapshot_payload["provenance"]
    map_data = snapshot_payload["rawResponse"]["data"]["result"]["map_data"]

    loaded = resolve_inp(network_id, None)
    wn = load_network(loaded.inp_bytes)
    topology = normalize_topology(wn, georeference_profile_id)
    hydraulics = run_hydraulics_and_age(
        loaded.inp_bytes,
        timeout_seconds=get_settings().simulation_timeout_seconds,
        sample_time_seconds=sample_time_seconds,
    )

    associations = associate_assets(
        nodes=topology["nodes"],
        links=topology["links"],
        map_data=map_data,
    )
    node_air: dict[str, float] = {}
    for node in topology["nodes"]:
        node_id = str(node["id"])
        temp = associations[node_id].temperature_c
        if temp is not None:
            node_air[node_id] = temp
    covered_temps = list(node_air.values())
    if not covered_temps:
        raise ValueError("No georeferenced assets intersect FortyGuard cells.")
    mean_air = sum(covered_temps) / len(covered_temps)

    source_ids = [
        node["id"] for node in topology["nodes"] if node["type"] in {KIND_RESERVOIR, KIND_TANK}
    ]
    links = []
    for link in topology["links"]:
        if link["type"] != "PIPE":
            continue
        src = str(link["sourceId"])
        wn_link = wn.get_link(src)
        flow = hydraulics.links.get(src, {}).get("flowM3s") or 0.0
        links.append(
            ThermalLinkSpec(
                link_id=str(link["id"]),
                from_node_id=str(link["fromNodeId"]),
                to_node_id=str(link["toNodeId"]),
                length_m=float(wn_link.length),
                diameter_m=float(wn_link.diameter),
                flow_m3s=float(flow),
            )
        )
    tanks = [
        _tank_geometry(wn, str(node["sourceId"]))
        for node in topology["nodes"]
        if node["type"] == KIND_TANK
    ]
    network = ThermalNetworkSpec(
        node_kinds={str(node["id"]): str(node["type"]) for node in topology["nodes"]},
        links=links,
        tanks=tanks,
        source_node_ids=tuple(source_ids),
    )
    thermal_cal = load_thermal_calibration(thermal_profile_id)
    initial = ThermalState(
        node_temperature_c={
            str(node["id"]): NodeThermal(temperature_c=source_temperature_c)
            for node in topology["nodes"]
        },
        soil_temperature_c=mean_air,
        calibration_profile_id=thermal_cal.profile_id,
        model_version=thermal_cal.model_version,
        solar_present=False,
    )
    thermal = step_thermal_network(
        network=network,
        state=initial,
        air_temperature_c=mean_air,
        timestep_seconds=timestep_seconds,
        calibration=thermal_cal,
        source_temperature_c=source_temperature_c,
        node_air_temperature_c=node_air,
    )

    chemistry_cal = load_free_chlorine_calibration(chemistry_profile_id)
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
    chemistry = step_free_chlorine_network(
        network=network,
        residuals_mg_l={str(node["id"]): source_residual for node in topology["nodes"]},
        temperatures_c={
            node_id: node.temperature_c for node_id, node in thermal.node_temperature_c.items()
        },
        timestep_seconds=timestep_seconds,
        calibration=chemistry_cal,
        source_residual_mg_l=source_residual,
    )
    if operational_target_mg_l is not None:
        for node in chemistry.nodes.values():
            node.target_breach = node.residual_mg_l < target

    engines = engine_versions()
    breach_ids = [
        node_id
        for node_id, node in chemistry.nodes.items()
        if node.target_breach
        and FLAG_NO_THERMAL_COVERAGE not in thermal.node_temperature_c[node_id].flags
    ]
    nodes_out = {}
    for node in topology["nodes"]:
        node_id = str(node["id"])
        source_id = str(node["sourceId"])
        assoc = associations[node_id]
        hyd = hydraulics.nodes.get(source_id, {})
        thermal_node = thermal.node_temperature_c[node_id]
        chem_node = chemistry.nodes[node_id]
        uncovered_node = FLAG_NO_THERMAL_COVERAGE in assoc.flags
        nodes_out[node_id] = {
            "sourceId": source_id,
            "type": node["type"],
            "x": node["x"],
            "y": node["y"],
            "longitude": node["longitude"],
            "latitude": node["latitude"],
            "cellId": assoc.cell_id,
            "associatedAirTemperatureC": assoc.temperature_c,
            "modeledWaterTemperatureC": None if uncovered_node else thermal_node.temperature_c,
            "residualMgL": None if uncovered_node else chem_node.residual_mg_l,
            "projectedTargetBreach": False if uncovered_node else chem_node.target_breach,
            "pressureM": hyd.get("pressureM"),
            "waterAgeHours": hyd.get("waterAgeHours"),
            "flags": sorted(set(assoc.flags + thermal_node.flags)),
        }

    return {
        "networkId": loaded.network_id,
        "name": loaded.name,
        "sourceType": loaded.source_type,
        "sha256": loaded.sha256,
        "geoReferenceType": topology["geoReference"]["type"],
        "geoReference": topology["geoReference"],
        "sampleTimeSeconds": hydraulics.sample_time_seconds,
        "timestepSeconds": timestep_seconds,
        "sourceTemperatureC": source_temperature_c,
        "meanAssociatedAirTemperatureC": mean_air,
        "operationalTargetMgL": target,
        "sourceResidualMgL": source_residual,
        "hydraulics": {
            "converged": hydraulics.converged,
            "summary": {
                "minPressureM": hydraulics.summary.min_pressure_m,
                "maxPressureM": hydraulics.summary.max_pressure_m,
                "minFlowM3s": hydraulics.summary.min_flow_m3s,
                "maxFlowM3s": hydraulics.summary.max_flow_m3s,
                "minWaterAgeHours": hydraulics.summary.min_water_age_hours,
                "maxWaterAgeHours": hydraulics.summary.max_water_age_hours,
            },
        },
        "summary": {
            "assetCount": len(topology["nodes"]),
            "coveredAssetCount": len(topology["nodes"])
            - sum(
                1
                for node in topology["nodes"]
                if FLAG_NO_THERMAL_COVERAGE in associations[node["id"]].flags
            ),
            "noCoverageAssetCount": sum(
                1
                for node in topology["nodes"]
                if FLAG_NO_THERMAL_COVERAGE in associations[node["id"]].flags
            ),
            "targetBreachAssetCount": len(breach_ids),
            "targetBreachAssetIds": breach_ids,
            "minimumResidualMgL": min(
                (
                    node["residualMgL"]
                    for node in nodes_out.values()
                    if node["residualMgL"] is not None
                ),
                default=None,
            ),
            "noCoverageAssetIds": [
                node["id"]
                for node in topology["nodes"]
                if FLAG_NO_THERMAL_COVERAGE in associations[node["id"]].flags
            ],
        },
        "nodes": nodes_out,
        "links": _links_out(topology["links"], nodes_out, hydraulics),
        "uncoveredLinkIds": [
            str(link["id"])
            for link in topology["links"]
            if str(link["id"]) in associations
            and FLAG_NO_THERMAL_COVERAGE in associations[str(link["id"])].flags
        ],
        "provenance": {
            "network": {
                "networkId": loaded.network_id,
                "sourceType": loaded.source_type,
                "sha256": loaded.sha256,
                "geoReferenceType": topology["geoReference"]["type"],
                "geoReferenceVersion": topology["geoReference"].get("version"),
            },
            "thermal": [
                {
                    "provider": provenance.get("provider"),
                    "endpoint": provenance.get("endpoint"),
                    "providerActivityId": provenance.get("activityId"),
                    "requestHash": provenance.get("requestHash"),
                    "freshness": provenance.get("freshness"),
                    "fetchedAt": provenance.get("fetchedAt"),
                    "fixtureId": fixture_id,
                }
            ],
            "engines": {
                "wntrVersion": engines.wntr_version,
                "epanetVersion": engines.epanet_version,
                "simulationServiceVersion": engines.simulation_service_version,
            },
            "models": {
                "thermalModelVersion": thermal.model_version,
                "chemistryModelVersion": chemistry.model_version,
                "calibrationProfileId": chemistry_cal.profile_id,
                "georeferenceVersion": topology["geoReference"].get("version"),
            },
        },
        "uncoveredLinkCount": len(
            [
                str(link["id"])
                for link in topology["links"]
                if str(link["id"]) in associations
                and FLAG_NO_THERMAL_COVERAGE in associations[str(link["id"])].flags
            ]
        ),
    }


def _links_out(
    topology_links: list[dict[str, Any]],
    nodes_out: dict[str, dict[str, Any]],
    hydraulics: Any,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for link in topology_links:
        start = nodes_out.get(str(link["fromNodeId"]))
        end = nodes_out.get(str(link["toNodeId"]))
        hyd = hydraulics.links.get(str(link["sourceId"]), {})
        coords = None
        if (
            start
            and end
            and start.get("longitude") is not None
            and start.get("latitude") is not None
            and end.get("longitude") is not None
            and end.get("latitude") is not None
        ):
            coords = [
                [float(start["longitude"]), float(start["latitude"])],
                [float(end["longitude"]), float(end["latitude"])],
            ]
        rows.append(
            {
                "id": str(link["id"]),
                "sourceId": str(link["sourceId"]),
                "type": str(link["type"]),
                "fromNodeId": str(link["fromNodeId"]),
                "toNodeId": str(link["toNodeId"]),
                "flowM3s": hyd.get("flowM3s"),
                "velocityMs": hyd.get("velocityMs"),
                "coordinates": coords,
            }
        )
    return rows
