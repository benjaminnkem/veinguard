from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from veinguard_sim.chemistry.calibration import (
    DEFAULT_MONOCHLORAMINE_PROFILE_ID,
    DEFAULT_NITRIFICATION_PROFILE_ID,
    load_monochloramine_calibration,
    load_nitrification_thresholds,
)
from veinguard_sim.chemistry.monochloramine import step_monochloramine_network
from veinguard_sim.chemistry.nitrification import (
    evaluate_nitrification_conditions,
    worst_nitrification,
)
from veinguard_sim.epanet.errors import NetworkInvalidError
from veinguard_sim.http import ok
from veinguard_sim.thermal.network import ThermalLinkSpec, ThermalNetworkSpec, ThermalTankSpec

router = APIRouter(prefix="/v1/simulations")


class MonochloramineNodeIn(BaseModel):
    id: str
    kind: str
    residual_mg_l: float = Field(alias="residualMgL")
    temperature_c: float = Field(alias="temperatureC")
    water_age_hours: float = Field(default=0.0, alias="waterAgeHours")
    free_ammonia_mg_l: float | None = Field(default=None, alias="freeAmmoniaMgL")
    model_config = {"populate_by_name": True}


class MonochloramineLinkIn(BaseModel):
    id: str
    from_node_id: str = Field(alias="fromNodeId")
    to_node_id: str = Field(alias="toNodeId")
    length_m: float = Field(alias="lengthM")
    diameter_m: float = Field(alias="diameterM")
    flow_m3s: float = Field(alias="flowM3s")
    closed: bool = False
    model_config = {"populate_by_name": True}


class MonochloramineTankIn(BaseModel):
    node_id: str = Field(alias="nodeId")
    volume_m3: float = Field(alias="volumeM3")
    diameter_m: float = Field(default=10.0, alias="diameterM")
    level_m: float = Field(default=1.0, alias="levelM")
    model_config = {"populate_by_name": True}


class MonochloramineRequest(BaseModel):
    timestep_seconds: float = Field(default=3600, alias="timestepSeconds")
    source_residual_mg_l: float | None = Field(default=None, alias="sourceResidualMgL")
    operational_target_mg_l: float | None = Field(
        default=None, alias="operationalTargetMgL"
    )
    free_ammonia_mg_l: float = Field(alias="freeAmmoniaMgL")
    ph: float = Field(alias="pH")
    alkalinity_mg_l_as_caco3: float | None = Field(
        default=None, alias="alkalinityMgLAsCaCO3"
    )
    chlorine_to_nitrogen_ratio: float | None = Field(
        default=None, alias="chlorineToNitrogenRatio"
    )
    calibration_profile_id: str = Field(
        default=DEFAULT_MONOCHLORAMINE_PROFILE_ID, alias="calibrationProfileId"
    )
    nitrification_threshold_profile_id: str = Field(
        default=DEFAULT_NITRIFICATION_PROFILE_ID,
        alias="nitrificationThresholdProfileId",
    )
    source_node_ids: list[str] = Field(default_factory=list, alias="sourceNodeIds")
    nodes: list[MonochloramineNodeIn]
    links: list[MonochloramineLinkIn]
    tanks: list[MonochloramineTankIn] = Field(default_factory=list)
    model_config = {"populate_by_name": True}


@router.post("/monochloramine")
def monochloramine(body: MonochloramineRequest, request: Request) -> dict[str, object]:
    try:
        calibration = load_monochloramine_calibration(body.calibration_profile_id)
        thresholds = load_nitrification_thresholds(body.nitrification_threshold_profile_id)
    except (FileNotFoundError, ValueError) as exc:
        raise NetworkInvalidError(str(exc)) from exc

    source_residual = (
        body.source_residual_mg_l
        if body.source_residual_mg_l is not None
        else calibration.source_residual_mg_l
    )
    network = ThermalNetworkSpec(
        node_kinds={node.id: node.kind for node in body.nodes},
        links=[
            ThermalLinkSpec(
                link_id=link.id,
                from_node_id=link.from_node_id,
                to_node_id=link.to_node_id,
                length_m=link.length_m,
                diameter_m=link.diameter_m,
                flow_m3s=link.flow_m3s,
                closed=link.closed,
            )
            for link in body.links
        ],
        tanks=[
            ThermalTankSpec(
                node_id=tank.node_id,
                volume_m3=tank.volume_m3,
                diameter_m=tank.diameter_m,
                level_m=tank.level_m,
            )
            for tank in body.tanks
        ],
        source_node_ids=tuple(body.source_node_ids),
    )
    try:
        state = step_monochloramine_network(
            network=network,
            residuals_mg_l={node.id: node.residual_mg_l for node in body.nodes},
            temperatures_c={node.id: node.temperature_c for node in body.nodes},
            water_age_hours={node.id: node.water_age_hours for node in body.nodes},
            free_ammonia_mg_n_l={
                node.id: (
                    node.free_ammonia_mg_l
                    if node.free_ammonia_mg_l is not None
                    else body.free_ammonia_mg_l
                )
                for node in body.nodes
            },
            timestep_seconds=body.timestep_seconds,
            calibration=calibration,
            source_residual_mg_l=source_residual,
            source_free_ammonia_mg_n_l=body.free_ammonia_mg_l,
            ph=body.ph,
            chlorine_to_nitrogen_ratio=body.chlorine_to_nitrogen_ratio,
        )
    except ValueError as exc:
        raise NetworkInvalidError(str(exc)) from exc

    target = (
        body.operational_target_mg_l
        if body.operational_target_mg_l is not None
        else calibration.operational_target_mg_l
    )
    per_node_nitrification = {
        node_id: evaluate_nitrification_conditions(
            water_age_hours=node.water_age_hours,
            temperature_c=node.temperature_c,
            residual_mg_l=node.residual_mg_l,
            free_ammonia_mg_n_l=node.free_ammonia_mg_n_l,
            thresholds=thresholds,
        )
        for node_id, node in state.nodes.items()
    }
    network_nitrification = worst_nitrification(per_node_nitrification)
    breach_ids = [
        node_id for node_id, node in state.nodes.items() if node.residual_mg_l < target
    ]
    return ok(
        {
            "modelVersion": state.model_version,
            "calibrationProfileId": state.calibration_profile_id,
            "calibrationSource": calibration.source,
            "chemistryProfile": "MONOCHLORAMINE",
            "operationalTargetMgL": target,
            "sourceResidualMgL": source_residual,
            "pH": body.ph,
            "phReference": calibration.ph_reference,
            "freeAmmoniaMgL": body.free_ammonia_mg_l,
            "freeAmmoniaUnits": "mg-N/L",
            "alkalinityMgLAsCaCO3": body.alkalinity_mg_l_as_caco3,
            "chlorineToNitrogenRatio": body.chlorine_to_nitrogen_ratio,
            "targetBreachAssetCount": len(breach_ids),
            "targetBreachAssetIds": breach_ids,
            "minimumResidualMgL": min(node.residual_mg_l for node in state.nodes.values()),
            "nodes": {
                node_id: {
                    "residualMgL": node.residual_mg_l,
                    "freeAmmoniaMgL": node.free_ammonia_mg_n_l,
                    "temperatureC": node.temperature_c,
                    "waterAgeHours": node.water_age_hours,
                    "projectedTargetBreach": node.residual_mg_l < target,
                    "flags": node.flags,
                    "nitrificationConditions": {
                        "level": per_node_nitrification[node_id].level,
                        "label": per_node_nitrification[node_id].label,
                        "drivers": list(per_node_nitrification[node_id].drivers),
                        "modelVersion": per_node_nitrification[node_id].model_version,
                        "thresholdProfileId": (
                            per_node_nitrification[node_id].threshold_profile_id
                        ),
                    },
                }
                for node_id, node in state.nodes.items()
            },
            "nitrificationConditions": {
                "level": network_nitrification.level,
                "label": network_nitrification.label,
                "drivers": list(network_nitrification.drivers),
                "modelVersion": network_nitrification.model_version,
                "thresholdProfileId": network_nitrification.threshold_profile_id,
            },
            "references": list(calibration.references),
            "nitrificationReferences": list(thresholds.references),
        },
        request,
    )
