from __future__ import annotations

from typing import Any

from veinguard_sim.baseline.pipeline import run_baseline
from veinguard_sim.catalog import EPA_NET3_ID
from veinguard_sim.chemistry.calibration import (
    load_monochloramine_calibration,
    load_nitrification_thresholds,
)
from veinguard_sim.chemistry.monochloramine import step_monochloramine_network
from veinguard_sim.chemistry.nitrification import evaluate_nitrification_conditions
from veinguard_sim.epanet.engine import load_network
from veinguard_sim.inputs import resolve_inp
from veinguard_sim.thermal.network import (
    KIND_RESERVOIR,
    KIND_TANK,
    ThermalLinkSpec,
    ThermalNetworkSpec,
    ThermalTankSpec,
)

LAYER_TCM = "tcm"
LAYER_NETWORK = "network"
LAYER_ASSETS = "assets"
LAYER_PRESSURE = "pressure"
LAYER_FLOW = "flow"
LAYER_WATER_AGE = "water-age"
LAYER_WATER_TEMPERATURE = "water-temperature"
LAYER_RESIDUAL = "residual"
LAYER_TARGET = "target"
LAYER_NITRIFICATION = "nitrification"

NODE_LAYERS = {
    LAYER_PRESSURE,
    LAYER_WATER_AGE,
    LAYER_WATER_TEMPERATURE,
    LAYER_RESIDUAL,
    LAYER_TARGET,
    LAYER_NITRIFICATION,
    LAYER_ASSETS,
}
LINK_LAYERS = {LAYER_NETWORK, LAYER_FLOW}

DEMO_FIXTURE_ID = "heatmap-2024-07-15T14-demo-aoi-v1"
DEMO_OBSERVATION_TIME = "2024-07-15T14:00:00Z"


def build_operations_snapshot(
    *,
    network_id: str = EPA_NET3_ID,
    fixture_id: str = DEMO_FIXTURE_ID,
    sample_time_seconds: float = 3600.0,
    include_monochloramine: bool = True,
) -> dict[str, Any]:
    baseline = run_baseline(
        network_id=network_id,
        fixture_id=fixture_id,
        sample_time_seconds=sample_time_seconds,
    )
    nodes = baseline["nodes"]
    if include_monochloramine:
        _attach_monochloramine(baseline, nodes)

    compact_nodes = []
    for node_id, node in nodes.items():
        compact_nodes.append(
            {
                "id": node_id,
                "sourceId": node["sourceId"],
                "type": node["type"],
                "longitude": node.get("longitude"),
                "latitude": node.get("latitude"),
                "cellId": node.get("cellId"),
                "associatedAirTemperatureC": node.get("associatedAirTemperatureC"),
                "modeledWaterTemperatureC": node.get("modeledWaterTemperatureC"),
                "residualMgL": node.get("residualMgL"),
                "projectedTargetBreach": node.get("projectedTargetBreach"),
                "pressureM": node.get("pressureM"),
                "waterAgeHours": node.get("waterAgeHours"),
                "flags": node.get("flags") or [],
                "monochloramineResidualMgL": node.get("monochloramineResidualMgL"),
                "monochloramineTargetBreach": node.get("monochloramineTargetBreach"),
                "freeAmmoniaMgNL": node.get("freeAmmoniaMgNL"),
                "nitrificationLevel": node.get("nitrificationLevel"),
                "nitrificationDrivers": node.get("nitrificationDrivers") or [],
                "nitrificationLabel": node.get("nitrificationLabel"),
            }
        )
    compact_links = []
    for link in baseline.get("links") or []:
        compact_links.append(
            {
                "id": link["id"],
                "sourceId": link["sourceId"],
                "type": link["type"],
                "fromNodeId": link["fromNodeId"],
                "toNodeId": link["toNodeId"],
                "flowM3s": link.get("flowM3s"),
                "velocityMs": link.get("velocityMs"),
                "coordinates": link.get("coordinates"),
            }
        )
    return {
        "snapshotId": "demo-operations-v1",
        "networkId": baseline["networkId"],
        "name": baseline["name"],
        "sourceType": baseline["sourceType"],
        "sha256": baseline["sha256"],
        "geoReferenceType": baseline["geoReferenceType"],
        "geoReference": baseline["geoReference"],
        "sampleTimeSeconds": baseline["sampleTimeSeconds"],
        "observationTime": DEMO_OBSERVATION_TIME,
        "fixtureId": fixture_id,
        "freshness": "HISTORICAL",
        "summary": baseline["summary"],
        "hydraulics": baseline["hydraulics"],
        "operationalTargetMgL": baseline["operationalTargetMgL"],
        "monochloramineOperationalTargetMgL": baseline.get("monochloramineOperationalTargetMgL"),
        "meanAssociatedAirTemperatureC": baseline["meanAssociatedAirTemperatureC"],
        "provenance": baseline["provenance"],
        "availableTimes": [
            {
                "seconds": baseline["sampleTimeSeconds"],
                "observationTime": DEMO_OBSERVATION_TIME,
                "label": "15 Jul 2024 14:00 UTC",
            }
        ],
        "nodes": compact_nodes,
        "links": compact_links,
    }


def project_layer(
    snapshot: dict[str, Any],
    layer: str,
    *,
    chemistry: str = "FREE_CHLORINE",
) -> dict[str, Any]:
    if layer == LAYER_TCM:
        raise ValueError("TCM is served from the FortyGuard snapshot, not the network layer API.")
    if layer in LINK_LAYERS:
        return _link_collection(snapshot, layer)
    if layer in NODE_LAYERS:
        return _node_collection(snapshot, layer, chemistry)
    raise ValueError(f"Unknown layer '{layer}'.")


def _node_collection(snapshot: dict[str, Any], layer: str, chemistry: str) -> dict[str, Any]:
    features = []
    for node in snapshot["nodes"]:
        lon = node.get("longitude")
        lat = node.get("latitude")
        if lon is None or lat is None:
            continue
        props: dict[str, Any] = {
            "id": node["id"],
            "sourceId": node["sourceId"],
            "type": node["type"],
            "flags": node.get("flags") or [],
        }
        metric_key, value = _node_metric(node, layer, chemistry)
        if metric_key:
            props[metric_key] = value
            props["metric"] = metric_key
        if layer == LAYER_ASSETS:
            props["label"] = f"{node['type']} {node['sourceId']}"
        features.append(
            {
                "type": "Feature",
                "id": node["id"],
                "properties": props,
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
            }
        )
    return {
        "type": "FeatureCollection",
        "features": features,
        "meta": {"layer": layer, "chemistry": chemistry, "geometry": "Point"},
    }


def _link_collection(snapshot: dict[str, Any], layer: str) -> dict[str, Any]:
    features = []
    for link in snapshot["links"]:
        coords = link.get("coordinates")
        if not coords:
            continue
        props: dict[str, Any] = {
            "id": link["id"],
            "sourceId": link["sourceId"],
            "type": link["type"],
            "fromNodeId": link["fromNodeId"],
            "toNodeId": link["toNodeId"],
        }
        if layer == LAYER_FLOW:
            props["flowM3s"] = link.get("flowM3s")
            props["velocityMs"] = link.get("velocityMs")
            props["metric"] = "flowM3s"
        features.append(
            {
                "type": "Feature",
                "id": link["id"],
                "properties": props,
                "geometry": {"type": "LineString", "coordinates": coords},
            }
        )
    return {
        "type": "FeatureCollection",
        "features": features,
        "meta": {"layer": layer, "geometry": "LineString"},
    }


def _node_metric(node: dict[str, Any], layer: str, chemistry: str) -> tuple[str | None, Any]:
    if layer == LAYER_PRESSURE:
        return "pressureM", node.get("pressureM")
    if layer == LAYER_WATER_AGE:
        return "waterAgeHours", node.get("waterAgeHours")
    if layer == LAYER_WATER_TEMPERATURE:
        return "modeledWaterTemperatureC", node.get("modeledWaterTemperatureC")
    if layer == LAYER_RESIDUAL:
        if chemistry == "MONOCHLORAMINE":
            return "residualMgL", node.get("monochloramineResidualMgL")
        return "residualMgL", node.get("residualMgL")
    if layer == LAYER_TARGET:
        if chemistry == "MONOCHLORAMINE":
            return "projectedTargetBreach", node.get("monochloramineTargetBreach")
        return "projectedTargetBreach", node.get("projectedTargetBreach")
    if layer == LAYER_NITRIFICATION:
        return "nitrificationLevel", node.get("nitrificationLevel")
    return None, None


def _attach_monochloramine(baseline: dict[str, Any], nodes: dict[str, dict[str, Any]]) -> None:
    loaded = resolve_inp(baseline["networkId"], None)
    wn = load_network(loaded.inp_bytes)
    calibration = load_monochloramine_calibration()
    thresholds = load_nitrification_thresholds()
    node_kinds = {node_id: node["type"] for node_id, node in nodes.items()}
    source_ids = [node_id for node_id, node in nodes.items() if node["type"] in {KIND_RESERVOIR, KIND_TANK}]
    links = []
    for link in baseline.get("links") or []:
        if link["type"] != "PIPE":
            continue
        try:
            wn_link = wn.get_link(link["sourceId"])
        except Exception:
            continue
        links.append(
            ThermalLinkSpec(
                link_id=link["id"],
                from_node_id=link["fromNodeId"],
                to_node_id=link["toNodeId"],
                length_m=float(wn_link.length),
                diameter_m=float(wn_link.diameter),
                flow_m3s=float(link.get("flowM3s") or 0.0),
            )
        )
    tanks = []
    for node_id, node in nodes.items():
        if node["type"] != KIND_TANK:
            continue
        tank = wn.get_node(node["sourceId"])
        diameter = float(getattr(tank, "diameter", 10.0) or 10.0)
        level = float(getattr(tank, "init_level", None) or getattr(tank, "level", 1.0) or 1.0)
        from math import pi

        tanks.append(
            ThermalTankSpec(
                node_id=node_id,
                volume_m3=pi * (diameter**2) / 4.0 * max(level, 0.0),
                diameter_m=diameter,
                level_m=level,
            )
        )
    network = ThermalNetworkSpec(
        node_kinds=node_kinds,
        links=links,
        tanks=tanks,
        source_node_ids=tuple(source_ids),
    )
    source_residual = calibration.source_residual_mg_l
    free_ammonia = 0.05
    ph = 7.5
    chemistry = step_monochloramine_network(
        network=network,
        residuals_mg_l={node_id: source_residual for node_id in nodes},
        temperatures_c={
            node_id: float(node["modeledWaterTemperatureC"] or 15.0) for node_id, node in nodes.items()
        },
        water_age_hours={node_id: float(node.get("waterAgeHours") or 0.0) for node_id, node in nodes.items()},
        free_ammonia_mg_n_l={node_id: free_ammonia for node_id in nodes},
        timestep_seconds=float(baseline.get("timestepSeconds") or 3600.0),
        calibration=calibration,
        source_residual_mg_l=source_residual,
        source_free_ammonia_mg_n_l=free_ammonia,
        ph=ph,
    )
    target = calibration.operational_target_mg_l
    baseline["monochloramineOperationalTargetMgL"] = target
    provenance_models = baseline["provenance"].setdefault("models", {})
    provenance_models["monochloramineModelVersion"] = chemistry.model_version
    provenance_models["nitrificationConditionsVersion"] = thresholds.model_version
    for node_id, node in nodes.items():
        chem = chemistry.nodes[node_id]
        uncovered = "NO_THERMAL_COVERAGE" in (node.get("flags") or [])
        if uncovered:
            node["monochloramineResidualMgL"] = None
            node["monochloramineTargetBreach"] = False
            node["freeAmmoniaMgNL"] = None
            node["nitrificationLevel"] = None
            node["nitrificationDrivers"] = []
            node["nitrificationLabel"] = None
            continue
        node["monochloramineResidualMgL"] = chem.residual_mg_l
        node["monochloramineTargetBreach"] = chem.residual_mg_l < target
        node["freeAmmoniaMgNL"] = chem.free_ammonia_mg_n_l
        conditions = evaluate_nitrification_conditions(
            water_age_hours=float(node.get("waterAgeHours") or 0.0),
            temperature_c=float(node["modeledWaterTemperatureC"]),
            residual_mg_l=chem.residual_mg_l,
            free_ammonia_mg_n_l=chem.free_ammonia_mg_n_l,
            thresholds=thresholds,
        )
        node["nitrificationLevel"] = conditions.level
        node["nitrificationDrivers"] = list(conditions.drivers)
        node["nitrificationLabel"] = conditions.label
