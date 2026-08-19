import os

os.environ.setdefault("SERVICE_TOKEN", "test-simulation-token")

from fastapi.testclient import TestClient

from veinguard_sim.main import app

client = TestClient(app)


def test_live_does_not_require_token() -> None:
    response = client.get("/health/live")
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["status"] == "ok"
    assert body["data"]["service"] == "veinguard-simulation"


def test_ready_does_not_require_token() -> None:
    response = client.get("/health/ready")
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "ready"


def test_unknown_route_requires_token() -> None:
    response = client.get("/v1/networks/validate")
    assert response.status_code == 401


def test_unknown_route_rejects_wrong_token() -> None:
    response = client.get(
        "/v1/networks/validate",
        headers={"Authorization": "Bearer wrong-token-value"},
    )
    assert response.status_code == 401
