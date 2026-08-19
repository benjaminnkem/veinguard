from fastapi.testclient import TestClient


def test_validate_net3(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(
        "/v1/networks/validate",
        headers=auth_headers,
        json={"networkId": "epa-net3"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["valid"] is True
    assert data["sourceType"] == "EPA_BENCHMARK"
    assert data["sha256"] == "ea3e825c4fef0b5cba47fb06301bc85253f18b6364dc96c44d9fb492c40faa52"
    assert data["assetSummary"]["junctionCount"] > 0
    assert data["assetSummary"]["pipeCount"] > 0
    assert data["assetSummary"]["reservoirCount"] == 2
    assert data["assetSummary"]["tankCount"] == 3
    assert data["assetSummary"]["pumpCount"] == 2
    assert data["engines"]["wntrVersion"]
    assert data["engines"]["epanetVersion"].startswith("2.2")


def test_topology_preserves_source_ids(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(
        "/v1/networks/topology",
        headers=auth_headers,
        json={"networkId": "epa-net3"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    types = {node["type"] for node in data["nodes"]}
    assert types == {"JUNCTION", "RESERVOIR", "TANK"}
    lake = next(node for node in data["nodes"] if node["sourceId"] == "Lake")
    assert lake["id"] == "R-Lake"
    assert lake["type"] == "RESERVOIR"
    pump = next(link for link in data["links"] if link["sourceId"] == "10")
    assert pump["type"] == "PUMP"
    assert pump["id"] == "PU-10"
    pipe = next(link for link in data["links"] if link["sourceId"] == "101")
    assert pipe["fromNodeId"].startswith("J-")
    assert pipe["toNodeId"].startswith("J-")


def test_unknown_network_id(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(
        "/v1/networks/validate",
        headers=auth_headers,
        json={"networkId": "not-a-network"},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "NETWORK_INVALID"


def test_empty_inp_rejected(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(
        "/v1/networks/validate",
        headers=auth_headers,
        json={"inpText": "   "},
    )
    assert response.status_code == 400


def test_malformed_inp_rejected(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(
        "/v1/networks/validate",
        headers=auth_headers,
        json={"inpText": "[JUNCTIONS]\nthis is not a valid epanet file"},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "NETWORK_INVALID"
