from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from veinguard_sim.baseline.pipeline import run_baseline
from veinguard_sim.catalog import EPA_NET3_ID
from veinguard_sim.epanet.errors import NetworkInvalidError
from veinguard_sim.http import ok
from veinguard_sim.operations.snapshot import build_operations_snapshot

router = APIRouter(prefix="/v1/simulations")


class FortyGuardIn(BaseModel):
    fixture_id: str | None = Field(default=None, alias="fixtureId")
    snapshot: dict[str, Any] | None = None
    model_config = {"populate_by_name": True}


class BaselineRequest(BaseModel):
    network_id: str = Field(default=EPA_NET3_ID, alias="networkId")
    georeference_profile_id: str = Field(
        default="synthetic-georef-v1", alias="georeferenceProfileId"
    )
    forty_guard: FortyGuardIn = Field(alias="fortyGuard")
    sample_time_seconds: float | None = Field(default=3600, alias="sampleTimeSeconds")
    timestep_seconds: float = Field(default=3600, alias="timestepSeconds")
    source_temperature_c: float = Field(default=15.0, alias="sourceTemperatureC")
    source_residual_mg_l: float | None = Field(default=None, alias="sourceResidualMgL")
    operational_target_mg_l: float | None = Field(default=None, alias="operationalTargetMgL")
    chemistry_profile_id: str = Field(
        default="literature-free-chlorine-v1", alias="chemistryProfileId"
    )
    thermal_profile_id: str = Field(
        default="literature-water-temp-v1", alias="thermalProfileId"
    )
    model_config = {"populate_by_name": True}


@router.post("/baseline")
def baseline(body: BaselineRequest, request: Request) -> dict[str, object]:
    try:
        result = run_baseline(
            network_id=body.network_id,
            georeference_profile_id=body.georeference_profile_id,
            fixture_id=body.forty_guard.fixture_id,
            snapshot=body.forty_guard.snapshot,
            sample_time_seconds=body.sample_time_seconds,
            timestep_seconds=body.timestep_seconds,
            source_temperature_c=body.source_temperature_c,
            source_residual_mg_l=body.source_residual_mg_l,
            operational_target_mg_l=body.operational_target_mg_l,
            chemistry_profile_id=body.chemistry_profile_id,
            thermal_profile_id=body.thermal_profile_id,
        )
    except (FileNotFoundError, ValueError) as exc:
        raise NetworkInvalidError(str(exc)) from exc
    return ok(result, request)


class OperationsSnapshotRequest(BaseModel):
    network_id: str = Field(default=EPA_NET3_ID, alias="networkId")
    fixture_id: str = Field(
        default="heatmap-2024-07-15T14-demo-aoi-v1", alias="fixtureId"
    )
    sample_time_seconds: float | None = Field(default=3600, alias="sampleTimeSeconds")
    include_monochloramine: bool = Field(default=True, alias="includeMonochloramine")
    model_config = {"populate_by_name": True}


@router.post("/operations-snapshot")
def operations_snapshot(body: OperationsSnapshotRequest, request: Request) -> dict[str, object]:
    try:
        result = build_operations_snapshot(
            network_id=body.network_id,
            fixture_id=body.fixture_id,
            sample_time_seconds=body.sample_time_seconds or 3600.0,
            include_monochloramine=body.include_monochloramine,
        )
    except (FileNotFoundError, ValueError) as exc:
        raise NetworkInvalidError(str(exc)) from exc
    return ok(result, request)
