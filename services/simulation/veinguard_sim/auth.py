from fastapi import Header, HTTPException, status

from veinguard_sim.settings import get_settings


async def require_service_token(authorization: str | None = Header(default=None)) -> None:
    """Internal service authentication for non-health routes."""
    expected = get_settings().service_token
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )
    token = authorization.removeprefix("Bearer ").strip()
    if token != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid service token",
        )
