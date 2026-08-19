from __future__ import annotations

from fastapi import APIRouter, Request

from veinguard_sim.api.schemas import NetworkRequest
from veinguard_sim.epanet.engine import run_hydraulics_and_age
from veinguard_sim.http import ok
from veinguard_sim.inputs import resolve_inp
from veinguard_sim.settings import get_settings

router = APIRouter(prefix="/v1/simulations")


@router.post("/hydraulics")
def hydraulics(body: NetworkRequest, request: Request) -> dict[str, object]:
    loaded = resolve_inp(body.network_id, body.inp_text)
    settings = get_settings()
    run = run_hydraulics_and_age(
        loaded.inp_bytes,
        timeout_seconds=settings.simulation_timeout_seconds,
        sample_time_seconds=body.sample_time_seconds,
    )
    return ok(
        {
            "networkId": loaded.network_id,
            "name": loaded.name,
            "sourceType": loaded.source_type,
            "sha256": loaded.sha256,
            "converged": run.converged,
            "durationSeconds": run.duration_seconds,
            "hydraulicTimestepSeconds": run.hydraulic_timestep_seconds,
            "reportTimestepSeconds": run.report_timestep_seconds,
            "sampleTimeSeconds": run.sample_time_seconds,
            "summary": {
                "minPressureM": run.summary.min_pressure_m,
                "maxPressureM": run.summary.max_pressure_m,
                "minFlowM3s": run.summary.min_flow_m3s,
                "maxFlowM3s": run.summary.max_flow_m3s,
                "minWaterAgeHours": run.summary.min_water_age_hours,
                "maxWaterAgeHours": run.summary.max_water_age_hours,
            },
            "units": run.units,
            "nodes": run.nodes,
            "links": run.links,
            "engines": {
                "wntrVersion": run.engines.wntr_version,
                "epanetVersion": run.engines.epanet_version,
                "simulationServiceVersion": run.engines.simulation_service_version,
            },
        },
        request,
    )
