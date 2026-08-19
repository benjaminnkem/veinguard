from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from veinguard_sim.epanet.errors import NetworkInvalidError
from veinguard_sim.http import ok
from veinguard_sim.thermal.calibration import DEFAULT_PROFILE_ID, load_thermal_calibration
from veinguard_sim.thermal.network import (
    NodeThermal,
    ThermalLinkSpec,
    ThermalNetworkSpec,
    ThermalState,
    ThermalTankSpec,
    step_thermal_network,
)

router = APIRouter(prefix="/v1/simulations")


class ThermalNodeIn(BaseModel):
    id: str
    kind: str
    temperature_c: float = Field(alias="temperatureC")
    model_config = {"populate_by_name": True}


class ThermalLinkIn(BaseModel):
    id: str
    from_node_id: str = Field(alias="fromNodeId")
    to_node_id: str = Field(alias="toNodeId")
    length_m: float = Field(alias="lengthM")
    diameter_m: float = Field(alias="diameterM")
    flow_m3s: float = Field(alias="flowM3s")
    closed: bool = False
    model_config = {"populate_by_name": True}


class ThermalTankIn(BaseModel):
    node_id: str = Field(alias="nodeId")
    volume_m3: float = Field(alias="volumeM3")
    diameter_m: float = Field(alias="diameterM")
    level_m: float = Field(alias="levelM")
    model_config = {"populate_by_name": True}


class WaterTemperatureRequest(BaseModel):
    air_temperature_c: float = Field(alias="airTemperatureC")
    source_temperature_c: float = Field(alias="sourceTemperatureC")
    timestep_seconds: float = Field(default=3600, alias="timestepSeconds")
    soil_temperature_c: float | None = Field(default=None, alias="soilTemperatureC")
    solar_irradiance_w_m2: float | None = Field(default=None, alias="solarIrradianceWm2")
    calibration_profile_id: str = Field(default=DEFAULT_PROFILE_ID, alias="calibrationProfileId")
    source_node_ids: list[str] = Field(default_factory=list, alias="sourceNodeIds")
    nodes: list[ThermalNodeIn]
    links: list[ThermalLinkIn]
    tanks: list[ThermalTankIn] = Field(default_factory=list)
    model_config = {"populate_by_name": True}


@router.post("/water-temperature")
def water_temperature(body: WaterTemperatureRequest, request: Request) -> dict[str, object]:
    try:
        calibration = load_thermal_calibration(body.calibration_profile_id)
    except (FileNotFoundError, ValueError) as exc:
        raise NetworkInvalidError(str(exc)) from exc
    soil = (
        body.soil_temperature_c
        if body.soil_temperature_c is not None
        else body.air_temperature_c
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
    state = ThermalState(
        node_temperature_c={
            node.id: NodeThermal(temperature_c=node.temperature_c) for node in body.nodes
        },
        soil_temperature_c=soil,
        calibration_profile_id=calibration.profile_id,
        model_version=calibration.model_version,
        solar_present=body.solar_irradiance_w_m2 is not None,
    )
    nxt = step_thermal_network(
        network=network,
        state=state,
        air_temperature_c=body.air_temperature_c,
        timestep_seconds=body.timestep_seconds,
        calibration=calibration,
        source_temperature_c=body.source_temperature_c,
        solar_irradiance_w_m2=body.solar_irradiance_w_m2,
    )
    return ok(
        {
            "modelVersion": nxt.model_version,
            "calibrationProfileId": nxt.calibration_profile_id,
            "calibrationSource": calibration.source,
            "soilTemperatureC": nxt.soil_temperature_c,
            "solarPresent": nxt.solar_present,
            "nodes": {
                node_id: {
                    "temperatureC": node.temperature_c,
                    "flags": node.flags,
                    "boundaryTemperatureC": node.boundary_temperature_c,
                }
                for node_id, node in nxt.node_temperature_c.items()
            },
            "references": list(calibration.references),
        },
        request,
    )
