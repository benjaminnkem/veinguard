from __future__ import annotations

from datetime import UTC, datetime

from fastapi.testclient import TestClient

from veinguard_sim.interventions.types import InterventionError, parse_interventions
from veinguard_sim.objective.score import compare_candidates, load_objective
from veinguard_sim.scenarios.run import run_scenario

ORIGIN = "1970-01-01T00:00:00+00:00"


def test_invalid_pump_never_reaches_simulation() -> None:
    try:
        parse_interventions(
            [
                {
                    "type": "CHANGE_PUMP_SETTING",
                    "pumpId": "",
                    "start": ORIGIN,
                    "end": "1970-01-01T01:00:00+00:00",
                    "setting": 1.0,
                }
            ],
            datetime(1970, 1, 1, tzinfo=UTC),
        )
    except InterventionError:
        pass
    else:
        raise AssertionError("expected validation failure")


def test_unknown_pump_rejected_before_epanet() -> None:
    try:
        run_scenario(
            network_id="epa-net3",
            horizon_start=ORIGIN,
            interventions_raw=[
                {
                    "type": "CHANGE_PUMP_SETTING",
                    "pumpId": "not-a-pump",
                    "start": ORIGIN,
                    "end": "1970-01-01T02:00:00+00:00",
                    "setting": 1.0,
                }
            ],
        )
    except InterventionError as exc:
        assert "does not exist" in str(exc)
    else:
        raise AssertionError("invalid intervention reached simulation")


def test_mass_booster_not_invented() -> None:
    try:
        parse_interventions(
            [
                {
                    "type": "CHANGE_BOOSTER_PROFILE",
                    "sourceNodeId": "101",
                    "start": ORIGIN,
                    "end": "1970-01-01T01:00:00+00:00",
                    "mode": "MASS",
                    "value": 1.0,
                    "units": "mg/s",
                }
            ],
            datetime(1970, 1, 1, tzinfo=UTC),
        )
    except InterventionError as exc:
        assert "MASS" in str(exc)
    else:
        raise AssertionError("expected MASS booster rejection")


def test_feasible_pump_setting() -> None:
    result = run_scenario(
        network_id="epa-net3",
        horizon_start=ORIGIN,
        interventions_raw=[
            {
                "type": "CHANGE_PUMP_SETTING",
                "pumpId": "10",
                "start": ORIGIN,
                "end": "1970-01-01T06:00:00+00:00",
                "setting": 1.0,
            }
        ],
        sample_time_seconds=5 * 3600,
        scenario_run_id="feasible-1",
    )
    assert result["baseNetworkImmutable"] is True
    assert result["hydraulics"]["converged"] is True
    assert result["feasible"] is True
    assert isinstance(result["objective"], float)


def test_closed_pumps_fail_min_pressure() -> None:
    result = run_scenario(
        network_id="epa-net3",
        horizon_start=ORIGIN,
        interventions_raw=[
            {
                "type": "CHANGE_PUMP_SCHEDULE",
                "pumpId": "10",
                "intervals": [
                    {
                        "start": ORIGIN,
                        "end": "1970-01-01T10:00:00+00:00",
                        "enabled": False,
                    }
                ],
            },
            {
                "type": "CHANGE_PUMP_SCHEDULE",
                "pumpId": "335",
                "intervals": [
                    {
                        "start": ORIGIN,
                        "end": "1970-01-01T10:00:00+00:00",
                        "enabled": False,
                    }
                ],
            },
        ],
        sample_time_seconds=5 * 3600,
        scenario_run_id="rejected-1",
    )
    assert result["hydraulics"]["converged"] is True
    assert result["feasible"] is False
    assert result["objective"] is None
    ids = [row["id"] for row in result["constraints"] if not row["passed"]]
    assert "pressure.min" in ids


def test_flush_increases_objective_vs_no_flush() -> None:
    base = run_scenario(
        network_id="epa-net3",
        horizon_start=ORIGIN,
        interventions_raw=[],
        sample_time_seconds=5 * 3600,
        scenario_run_id="rank-a",
    )
    flushed = run_scenario(
        network_id="epa-net3",
        horizon_start=ORIGIN,
        interventions_raw=[
            {
                "type": "FLUSH_EVENT",
                "junctionId": "101",
                "start": ORIGIN,
                "durationSeconds": 3600,
                "dischargeLps": 50.0,
            }
        ],
        sample_time_seconds=5 * 3600,
        scenario_run_id="rank-b",
    )
    assert base["feasible"] is True
    assert flushed["feasible"] is True
    assert flushed["metrics"]["flushWaterLiters"] == 50.0 * 3600
    assert flushed["objective"] > base["objective"]
    ranked = compare_candidates([base, flushed], load_objective())
    assert ranked["feasible"][0]["scenarioRunId"] == "rank-a"
    assert ranked["feasible"][0]["rank"] == 1
    again = compare_candidates([flushed, base], load_objective())
    assert again["feasible"][0]["scenarioRunId"] == "rank-a"


def test_compare_api(client: TestClient, auth_headers: dict[str, str]) -> None:
    first = client.post(
        "/v1/simulations/scenario",
        headers=auth_headers,
        json={
            "networkId": "epa-net3",
            "horizonStart": ORIGIN,
            "interventions": [],
            "scenarioRunId": "cmp-a",
            "sampleTimeSeconds": 18000,
        },
    )
    second = client.post(
        "/v1/simulations/scenario",
        headers=auth_headers,
        json={
            "networkId": "epa-net3",
            "horizonStart": ORIGIN,
            "interventions": [
                {
                    "type": "FLUSH_EVENT",
                    "junctionId": "101",
                    "start": ORIGIN,
                    "durationSeconds": 1800,
                    "dischargeLps": 20,
                }
            ],
            "scenarioRunId": "cmp-b",
            "sampleTimeSeconds": 18000,
        },
    )
    assert first.status_code == 200
    assert second.status_code == 200
    compared = client.post(
        "/v1/simulations/scenarios/compare",
        headers=auth_headers,
        json={"results": [second.json()["data"], first.json()["data"]]},
    )
    assert compared.status_code == 200
    data = compared.json()["data"]
    assert data["feasible"][0]["scenarioRunId"] == "cmp-a"
    assert "objectiveProfileVersion" in data


def test_invalid_intervention_api(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(
        "/v1/simulations/scenario",
        headers=auth_headers,
        json={
            "networkId": "epa-net3",
            "horizonStart": ORIGIN,
            "interventions": [{"type": "CHANGE_VALVE_SETTING", "valveId": "nope",
                               "start": ORIGIN, "end": "1970-01-01T01:00:00+00:00",
                               "setting": 1.0}],
        },
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "NETWORK_INVALID"


def test_no_llm_in_scenario_modules() -> None:
    from pathlib import Path

    root = Path(__file__).resolve().parents[1] / "veinguard_sim"
    for rel in ("interventions", "constraints", "objective", "scenarios"):
        for path in (root / rel).rglob("*.py"):
            text = path.read_text(encoding="utf-8")
            assert "groq" not in text.lower()
            assert "openai" not in text.lower()
