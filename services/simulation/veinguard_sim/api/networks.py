from __future__ import annotations

from fastapi import APIRouter, Request

from veinguard_sim.api.schemas import NetworkRequest
from veinguard_sim.epanet.engine import engine_versions, load_network, validate_required_assets
from veinguard_sim.http import ok
from veinguard_sim.inputs import resolve_inp
from veinguard_sim.topology import normalize_topology

router = APIRouter(prefix="/v1/networks")


@router.post("/validate")
def validate_network(body: NetworkRequest, request: Request) -> dict[str, object]:
    loaded = resolve_inp(body.network_id, body.inp_text)
    wn = load_network(loaded.inp_bytes)
    summary = validate_required_assets(wn)
    versions = engine_versions()
    return ok(
        {
            "valid": True,
            "networkId": loaded.network_id,
            "name": loaded.name,
            "sourceType": loaded.source_type,
            "sha256": loaded.sha256,
            "assetSummary": summary,
            "engines": {
                "wntrVersion": versions.wntr_version,
                "epanetVersion": versions.epanet_version,
                "simulationServiceVersion": versions.simulation_service_version,
            },
        },
        request,
    )


@router.post("/topology")
def network_topology(body: NetworkRequest, request: Request) -> dict[str, object]:
    loaded = resolve_inp(body.network_id, body.inp_text)
    wn = load_network(loaded.inp_bytes)
    topology = normalize_topology(wn)
    return ok(
        {
            "networkId": loaded.network_id,
            "name": loaded.name,
            "sourceType": loaded.source_type,
            "sha256": loaded.sha256,
            **topology,
        },
        request,
    )
