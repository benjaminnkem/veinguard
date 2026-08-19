from fastapi.testclient import TestClient


def test_live_does_not_require_token(client: TestClient) -> None:
    response = client.get("/health/live")
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["status"] == "ok"
    assert body["data"]["service"] == "veinguard-simulation"


def test_ready_does_not_require_token(client: TestClient) -> None:
    response = client.get("/health/ready")
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["status"] == "ready"
    names = {check["name"] for check in body["data"]["checks"]}
    assert "wntr" in names
    assert "epa-net3" in names


def test_unknown_route_requires_token(client: TestClient) -> None:
    response = client.get("/v1/networks/validate")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTH_INVALID_CREDENTIALS"


def test_unknown_route_rejects_wrong_token(client: TestClient) -> None:
    response = client.get(
        "/v1/networks/validate",
        headers={"Authorization": "Bearer wrong-token-value"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTH_INVALID_CREDENTIALS"
