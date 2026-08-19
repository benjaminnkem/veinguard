from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from veinguard_sim import __version__
from veinguard_sim.settings import Settings, get_settings

app = FastAPI(title="VeinGuard Simulation", version=__version__, docs_url=None, redoc_url=None)


@app.middleware("http")
async def service_auth_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    if request.url.path.startswith("/health"):
        return await call_next(request)

    settings = get_settings()
    authorization = request.headers.get("authorization", "")
    if not authorization.startswith("Bearer "):
        return JSONResponse(status_code=401, content={"detail": "Missing bearer token"})
    token = authorization.removeprefix("Bearer ").strip()
    if token != settings.service_token:
        return JSONResponse(status_code=401, content={"detail": "Invalid service token"})
    return await call_next(request)


@app.get("/health/live")
def live() -> dict[str, object]:
    return {
        "data": {"status": "ok", "service": "veinguard-simulation"},
        "meta": {"version": __version__},
    }


@app.get("/health/ready")
def ready() -> dict[str, object]:
    settings: Settings = get_settings()
    return {
        "data": {
            "status": "ready",
            "service": "veinguard-simulation",
            "checks": [
                {"name": "service_token", "status": "up"},
                {"name": "thermal_model", "status": "up", "detail": settings.thermal_model_version},
            ],
        },
        "meta": {"version": __version__},
    }
