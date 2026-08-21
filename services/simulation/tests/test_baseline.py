from __future__ import annotations

from fastapi.testclient import TestClient

from veinguard_sim.baseline.pipeline import load_fortyguard_snapshot, run_baseline

FIXTURE_ID = "heatmap-2024-07-15T14-demo-aoi-v1"


def test_rejects_invented_snapshot_without_activity() -> None:
    try:
        load_fortyguard_snapshot(
            None,
            {
                "provenance": {"provider": "FORTYGUARD"},
                "rawResponse": {"data": {"status": "Completed", "result": {"map_data": {}}}},
            },
        )
    except ValueError as exc:
        assert "activityId" in str(exc)
    else:
        raise AssertionError("expected rejection")


def test_recorded_fixture_is_completed_real() -> None:
    payload = load_fortyguard_snapshot(FIXTURE_ID, None)
    assert payload["provenance"]["provider"] == "FORTYGUARD"
    assert payload["provenance"]["activityId"]
    assert payload["rawResponse"]["data"]["status"] == "Completed"
    features = payload["rawResponse"]["data"]["result"]["map_data"]["features"]
    assert len(features) == 150
    assert "average_temperature" in features[0]["properties"]


def test_baseline_net3_with_recorded_fortyguard() -> None:
    result = run_baseline(fixture_id=FIXTURE_ID, sample_time_seconds=3600)
    assert result["sourceType"] == "EPA_BENCHMARK"
    assert result["geoReferenceType"] == "SYNTHETIC_GEOREFERENCING"
    assert result["geoReference"]["version"] == "synthetic-georef-v1"
    assert result["sha256"] == "ea3e825c4fef0b5cba47fb06301bc85253f18b6364dc96c44d9fb492c40faa52"
    assert result["hydraulics"]["converged"] is True
    assert result["summary"]["coveredAssetCount"] > 0
    assert result["provenance"]["thermal"][0]["providerActivityId"]
    assert result["provenance"]["thermal"][0]["freshness"] == "HISTORICAL"
    assert result["provenance"]["models"]["thermalModelVersion"] == "water-temp-v1"
    assert result["provenance"]["models"]["chemistryModelVersion"] == "free-chlorine-v1"

    node = next(iter(result["nodes"].values()))
    assert node["x"] is not None
    assert node["longitude"] is not None
    assert result["links"]
    assert result["links"][0]["coordinates"] is not None
    covered = [
        item
        for item in result["nodes"].values()
        if item["associatedAirTemperatureC"] is not None
    ]
    assert covered
    sample = covered[0]
    assert sample["modeledWaterTemperatureC"] is not None
    assert sample["residualMgL"] is not None
    assert sample["projectedTargetBreach"] in {True, False}
    # Air is not copied as water.
    assert sample["modeledWaterTemperatureC"] != sample["associatedAirTemperatureC"]


def test_baseline_api(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(
        "/v1/simulations/baseline",
        headers=auth_headers,
        json={
            "networkId": "epa-net3",
            "georeferenceProfileId": "synthetic-georef-v1",
            "fortyGuard": {"fixtureId": FIXTURE_ID},
            "sampleTimeSeconds": 3600,
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["geoReferenceType"] == "SYNTHETIC_GEOREFERENCING"
    assert data["sourceType"] == "EPA_BENCHMARK"
    assert data["summary"]["targetBreachAssetCount"] >= 0


def test_topology_synthetic_georeference(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(
        "/v1/networks/topology",
        headers=auth_headers,
        json={"networkId": "epa-net3", "georeferenceProfileId": "synthetic-georef-v1"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["geoReference"]["type"] == "SYNTHETIC_GEOREFERENCING"
    lake = next(node for node in data["nodes"] if node["sourceId"] == "Lake")
    assert lake["x"] is not None
    assert lake["longitude"] is not None
    assert lake["latitude"] is not None
    # Original drawing coordinates are kept.
    assert lake["x"] != lake["longitude"]
