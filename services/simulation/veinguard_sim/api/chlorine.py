from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from veinguard_sim.chemistry.calibration import DEFAULT_PROFILE_ID, load_free_chlorine_calibration
from veinguard_sim.chemistry.network import step_free_chlorine_network
from veinguard_sim.epanet.errors import NetworkInvalidError
from veinguard_sim.http import ok
from veinguard_sim.thermal.network import ThermalLinkSpec, ThermalNetworkSpec, ThermalTankSpec

router = APIRouter(prefix="/v1/simulations")


class ChlorineNodeIn(BaseModel):
    id: str
    kind: str
    residual_mg_l: float = Field(alias="residualMgL")
    temperature_c: float = Field(alias="temperatureC")
    model_config = {"populate_by_name": True}


class ChlorineLinkIn(BaseModel):
    id: str
    from_node_id: str = Field(alias="fromNodeId")
    to_node_id: str = Field(alias="toNodeId")
    length_m: float = Field(alias="lengthM")
    diameter_m: float = Field(alias="diameterM")
    flow_m3s: float = Field(alias="flowM3s")
    closed: bool = False
    model_config = {"populate_by_name": True}


class ChlorineTankIn(BaseModel):
    node_id: str = Field(alias="nodeId")
    volume_m3: float = Field(alias="volumeM3")
    diameter_m: float = Field(default=10.0, alias="diameterM")
    level_m: float = Field(default=1.0, alias="levelM")
    model_config = {"populate_by_name": True}


class FreeChlorineRequest(BaseModel):
    timestep_seconds: float = Field(default=3600, alias="timestepSeconds")
    source_residual_mg_l: float | None = Field(default=None, alias="sourceResidualMgL")
    operational_target_mg_l: float | None = Field(default=None, alias="operationalTargetMgL")
    calibration_profile_id: str = Field(default=DEFAULT_PROFILE_ID, alias="calibrationProfileId")
    source_node_ids: list[str] = Field(default_factory=list, alias="sourceNodeIds")
    nodes: list[ChlorineNodeIn]
    links: list[ChlorineLinkIn]
    tanks: list[ChlorineTankIn] = Field(default_factory=list)
    model_config = {"populate_by_name": True}


@router.post("/free-chlorine")
def free_chlorine(body: FreeChlorineRequest, request: Request) -> dict[str, object]:
    try:
        calibration = load_free_chlorine_calibration(body.calibration_profile_id)
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
    state = step_free_chlorine_network(
        network=network,
        residuals_mg_l={node.id: node.residual_mg_l for node in body.nodes},
        temperatures_c={node.id: node.temperature_c for node in body.nodes},
        timestep_seconds=body.timestep_seconds,
        calibration=calibration,
        source_residual_mg_l=source_residual,
    )
    target = (
        body.operational_target_mg_l
        if body.operational_target_mg_l is not None
        else calibration.operational_target_mg_l
    )
    breach_ids = [
        node_id
        for node_id, node in state.nodes.items()
        if node.residual_mg_l < target
    ]
    return ok(
        {
            "modelVersion": state.model_version,
            "calibrationProfileId": state.calibration_profile_id,
            "calibrationSource": calibration.source,
            "operationalTargetMgL": target,
            "sourceResidualMgL": source_residual,
            "targetBreachAssetCount": len(breach_ids),
            "targetBreachAssetIds": breach_ids,
            "minimumResidualMgL": min(node.residual_mg_l for node in state.nodes.values()),
            "nodes": {
                node_id: {
                    "residualMgL": node.residual_mg_l,
                    "temperatureC": node.temperature_c,
                    "projectedTargetBreach": node.residual_mg_l < target,
                    "flags": node.flags,
                }
                for node_id, node in state.nodes.items()
            },
            "references": list(calibration.references),
        },
        request,
    )
