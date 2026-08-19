from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from veinguard_sim import __version__
from veinguard_sim.api.networks import router as networks_router
from veinguard_sim.api.simulations import router as simulations_router
from veinguard_sim.catalog import EPA_NET3_ID, catalog_networks
from veinguard_sim.epanet.errors import SimulationError
from veinguard_sim.http import correlation_id, error_response
from veinguard_sim.settings import Settings, get_settings

app = FastAPI(title="VeinGuard Simulation", version=__version__, docs_url=None, redoc_url=None)


@app.middleware("http")
async def service_auth_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    cid = correlation_id(request)
    if request.url.path.startswith("/health"):
        response = await call_next(request)
        response.headers["x-correlation-id"] = cid
        return response

    settings = get_settings()
    authorization = request.headers.get("authorization", "")
    if not authorization.startswith("Bearer "):
        return JSONResponse(
            status_code=401,
            content={
                "error": {
                    "code": "AUTH_INVALID_CREDENTIALS",
                    "message": "Missing bearer token",
                    "correlationId": cid,
                }
            },
            headers={"x-correlation-id": cid},
        )
    token = authorization.removeprefix("Bearer ").strip()
    if token != settings.service_token:
        return JSONResponse(
            status_code=401,
            content={
                "error": {
                    "code": "AUTH_INVALID_CREDENTIALS",
                    "message": "Invalid service token",
                    "correlationId": cid,
                }
            },
            headers={"x-correlation-id": cid},
        )
    response = await call_next(request)
    response.headers.setdefault("x-correlation-id", cid)
    return response


@app.exception_handler(SimulationError)
async def simulation_error_handler(request: Request, exc: SimulationError) -> JSONResponse:
    return error_response(exc, request)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    cid = correlation_id(request)
    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "code": "NETWORK_INVALID",
                "message": "Request validation failed.",
                "correlationId": cid,
            }
        },
        headers={"x-correlation-id": cid},
    )


@app.get("/health/live")
def live() -> dict[str, object]:
    return {
        "data": {"status": "ok", "service": "veinguard-simulation"},
        "meta": {"version": __version__},
    }


@app.get("/health/ready")
def ready() -> dict[str, object]:
    settings: Settings = get_settings()
    checks: list[dict[str, str]] = [
        {"name": "service_token", "status": "up"},
    ]
    try:
        import wntr

        checks.append({"name": "wntr", "status": "up", "detail": str(wntr.__version__)})
    except Exception as exc:  # noqa: BLE001
        checks.append({"name": "wntr", "status": "down", "detail": str(exc)})

    net3 = catalog_networks().get(EPA_NET3_ID)
    if net3 is not None and net3.inp_path.is_file():
        checks.append({"name": "epa-net3", "status": "up"})
    else:
        checks.append({"name": "epa-net3", "status": "down", "detail": "Net3.inp missing"})

    ready_ok = all(check["status"] == "up" for check in checks)
    return {
        "data": {
            "status": "ready" if ready_ok else "not_ready",
            "service": "veinguard-simulation",
            "checks": checks,
            "thermalModelVersion": settings.thermal_model_version,
        },
        "meta": {"version": __version__},
    }


app.include_router(networks_router)
app.include_router(simulations_router)
