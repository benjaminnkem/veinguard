from __future__ import annotations

from uuid import uuid4

from fastapi import Request
from fastapi.responses import JSONResponse

from veinguard_sim.epanet.errors import SimulationError


def correlation_id(request: Request) -> str:
    existing = request.headers.get("x-correlation-id", "").strip()
    return existing or str(uuid4())


def ok(data: object, request: Request) -> dict[str, object]:
    return {
        "data": data,
        "meta": {"correlationId": correlation_id(request)},
    }


def error_response(exc: SimulationError, request: Request) -> JSONResponse:
    status = {
        "NETWORK_INVALID": 400,
        "SIMULATION_CONVERGENCE_FAILED": 422,
        "SIMULATION_TIMEOUT": 504,
    }.get(exc.code, 500)
    cid = correlation_id(request)
    return JSONResponse(
        status_code=status,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "correlationId": cid,
            }
        },
        headers={"x-correlation-id": cid},
    )
