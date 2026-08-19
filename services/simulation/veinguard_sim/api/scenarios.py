from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from veinguard_sim.catalog import EPA_NET3_ID
from veinguard_sim.epanet.errors import NetworkInvalidError
from veinguard_sim.http import ok
from veinguard_sim.interventions.types import InterventionError
from veinguard_sim.objective.score import compare_candidates, load_objective
from veinguard_sim.scenarios.run import run_scenario

router = APIRouter(prefix="/v1/simulations")


class ScenarioRequest(BaseModel):
    network_id: str = Field(default=EPA_NET3_ID, alias="networkId")
    horizon_start: str = Field(alias="horizonStart")
    interventions: list[dict[str, Any]] = Field(default_factory=list)
    constraints_profile_id: str = Field(
        default="demo-constraints-v1", alias="constraintsProfileId"
    )
    objective_profile_id: str = Field(default="demo-objective-v1", alias="objectiveProfileId")
    sample_time_seconds: float | None = Field(default=3600, alias="sampleTimeSeconds")
    source_temperature_c: float = Field(default=15.0, alias="sourceTemperatureC")
    air_temperature_c: float = Field(default=20.0, alias="airTemperatureC")
    scenario_run_id: str | None = Field(default=None, alias="scenarioRunId")
    model_config = {"populate_by_name": True}


class CompareRequest(BaseModel):
    results: list[dict[str, Any]]
    objective_profile_id: str = Field(default="demo-objective-v1", alias="objectiveProfileId")
    model_config = {"populate_by_name": True}


@router.post("/scenario")
def scenario(body: ScenarioRequest, request: Request) -> dict[str, object]:
    try:
        result = run_scenario(
            network_id=body.network_id,
            interventions_raw=body.interventions,
            horizon_start=body.horizon_start,
            constraints_profile_id=body.constraints_profile_id,
            objective_profile_id=body.objective_profile_id,
            sample_time_seconds=body.sample_time_seconds,
            source_temperature_c=body.source_temperature_c,
            air_temperature_c=body.air_temperature_c,
            scenario_run_id=body.scenario_run_id,
        )
    except (InterventionError, FileNotFoundError, ValueError) as exc:
        raise NetworkInvalidError(str(exc)) from exc
    return ok(result, request)


@router.post("/scenarios/compare")
def compare(body: CompareRequest, request: Request) -> dict[str, object]:
    try:
        profile = load_objective(body.objective_profile_id)
    except (FileNotFoundError, ValueError) as exc:
        raise NetworkInvalidError(str(exc)) from exc
    return ok(compare_candidates(body.results, profile), request)
