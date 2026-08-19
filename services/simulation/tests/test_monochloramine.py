from __future__ import annotations

from math import exp, log

from fastapi.testclient import TestClient

from veinguard_sim.chemistry.calibration import load_monochloramine_calibration
from veinguard_sim.chemistry.kinetics import decay_residual
from veinguard_sim.chemistry.monochloramine import (
    bulk_rate_per_second,
    pipe_outlet_residual,
    step_monochloramine_network,
    step_tank_ammonia,
    step_tank_residual,
    validity_flags,
)
from veinguard_sim.thermal.network import (
    KIND_JUNCTION,
    KIND_RESERVOIR,
    KIND_TANK,
    ThermalLinkSpec,
    ThermalNetworkSpec,
    ThermalTankSpec,
)
from veinguard_sim.thermal.pipes import residence_time_seconds


def test_reference_half_life_at_35c_ph_7_5() -> None:
    cal = load_monochloramine_calibration()
    rate = bulk_rate_per_second(35.0, cal)
    remaining = decay_residual(2.0, rate, 75 * 3600)
    assert abs(remaining - 1.0) < 1e-10


def test_reference_half_life_bound_at_4c_ph_7_5() -> None:
    cal = load_monochloramine_calibration()
    rate = bulk_rate_per_second(4.0, cal)
    remaining = decay_residual(2.0, rate, 300 * 3600)
    assert abs(remaining - 1.0) < 1e-10


def test_hotter_decays_faster_than_free_chlorine_would_imply_distinct_k() -> None:
    cal = load_monochloramine_calibration()
    cool = decay_residual(2.0, bulk_rate_per_second(10.0, cal), 24 * 3600)
    warm = decay_residual(2.0, bulk_rate_per_second(30.0, cal), 24 * 3600)
    assert warm < cool
    assert warm > 0
    from veinguard_sim.chemistry.calibration import load_free_chlorine_calibration
    from veinguard_sim.chemistry.kinetics import bulk_rate_per_second as chlorine_rate

    cl = load_free_chlorine_calibration()
    assert bulk_rate_per_second(20.0, cal) < chlorine_rate(20.0, cl)


def test_first_order_matches_closed_form() -> None:
    cal = load_monochloramine_calibration()
    rate = bulk_rate_per_second(20.0, cal)
    got = decay_residual(2.0, rate, 3600)
    assert abs(got - 2.0 * exp(-rate * 3600)) < 1e-12


def test_ph_does_not_change_v1_residual() -> None:
    cal = load_monochloramine_calibration()
    rate = bulk_rate_per_second(25.0, cal)
    residual = decay_residual(2.0, rate, 7200)
    low_ph = validity_flags(
        temperature_c=25.0,
        ph=6.0,
        residual_mg_l=residual,
        free_ammonia_mg_n_l=0.02,
        chlorine_to_nitrogen_ratio=4.5,
        calibration=cal,
    )
    in_range = validity_flags(
        temperature_c=25.0,
        ph=7.5,
        residual_mg_l=residual,
        free_ammonia_mg_n_l=0.02,
        chlorine_to_nitrogen_ratio=4.5,
        calibration=cal,
    )
    assert residual > 0
    assert "PH_OUTSIDE_REFERENCE" in low_ph
    assert "PH_OUTSIDE_REFERENCE" not in in_range


def test_ammonia_is_conservative_and_does_not_change_residual() -> None:
    cal = load_monochloramine_calibration()
    network = ThermalNetworkSpec(
        node_kinds={"R1": KIND_RESERVOIR, "J1": KIND_JUNCTION},
        links=[ThermalLinkSpec("P1", "R1", "J1", 200.0, 0.2, 0.02)],
        tanks=[],
        source_node_ids=("R1",),
    )
    low_nh3 = step_monochloramine_network(
        network=network,
        residuals_mg_l={"R1": 2.0, "J1": 2.0},
        temperatures_c={"R1": 20.0, "J1": 20.0},
        water_age_hours={"R1": 1.0, "J1": 2.0},
        free_ammonia_mg_n_l={"R1": 0.02, "J1": 0.02},
        timestep_seconds=3600,
        calibration=cal,
        source_residual_mg_l=2.0,
        source_free_ammonia_mg_n_l=0.02,
        ph=7.5,
    )
    high_nh3 = step_monochloramine_network(
        network=network,
        residuals_mg_l={"R1": 2.0, "J1": 2.0},
        temperatures_c={"R1": 20.0, "J1": 20.0},
        water_age_hours={"R1": 1.0, "J1": 2.0},
        free_ammonia_mg_n_l={"R1": 0.2, "J1": 0.2},
        timestep_seconds=3600,
        calibration=cal,
        source_residual_mg_l=2.0,
        source_free_ammonia_mg_n_l=0.2,
        ph=7.5,
    )
    assert abs(low_nh3.nodes["J1"].residual_mg_l - high_nh3.nodes["J1"].residual_mg_l) < 1e-12
    assert abs(high_nh3.nodes["J1"].free_ammonia_mg_n_l - 0.2) < 1e-9


def test_one_pipe_matches_analytical_tau() -> None:
    cal = load_monochloramine_calibration()
    outlet, flag = pipe_outlet_residual(
        inlet_mg_l=2.0,
        temperature_c=20.0,
        length_m=1000.0,
        diameter_m=0.3,
        flow_m3s=0.02,
        timestep_seconds=3600,
        closed=False,
        calibration=cal,
    )
    tau = residence_time_seconds(1000.0, 0.3, 0.02)
    expected = decay_residual(2.0, bulk_rate_per_second(20.0, cal), tau)
    assert flag == "FLOWING"
    assert abs(outlet - expected) < 1e-12


def test_stagnant_two_steps_match_one_step() -> None:
    cal = load_monochloramine_calibration()
    rate = bulk_rate_per_second(20.0, cal)
    one = decay_residual(2.0, rate, 3600)
    two = decay_residual(decay_residual(2.0, rate, 1800), rate, 1800)
    assert abs(one - two) < 1e-12


def test_flow_reversal_decays_from_opposite_inlet() -> None:
    cal = load_monochloramine_calibration()
    forward, flag_f = pipe_outlet_residual(
        inlet_mg_l=2.0,
        temperature_c=20.0,
        length_m=400.0,
        diameter_m=0.2,
        flow_m3s=0.01,
        timestep_seconds=3600,
        closed=False,
        calibration=cal,
    )
    reverse, flag_r = pipe_outlet_residual(
        inlet_mg_l=0.8,
        temperature_c=20.0,
        length_m=400.0,
        diameter_m=0.2,
        flow_m3s=-0.01,
        timestep_seconds=3600,
        closed=False,
        calibration=cal,
    )
    assert flag_f == "FLOWING"
    assert flag_r == "FLOW_REVERSED"
    assert reverse < 0.8
    assert forward < 2.0


def test_tank_cstr_continuity() -> None:
    cal = load_monochloramine_calibration()
    one = step_tank_residual(
        residual_mg_l=2.0,
        inflow_mg_l=2.0,
        inflow_m3s=0.0,
        volume_m3=100.0,
        temperature_c=20.0,
        timestep_seconds=3600,
        calibration=cal,
    )
    mid = step_tank_residual(
        residual_mg_l=2.0,
        inflow_mg_l=2.0,
        inflow_m3s=0.0,
        volume_m3=100.0,
        temperature_c=20.0,
        timestep_seconds=1800,
        calibration=cal,
    )
    two = step_tank_residual(
        residual_mg_l=mid,
        inflow_mg_l=2.0,
        inflow_m3s=0.0,
        volume_m3=100.0,
        temperature_c=20.0,
        timestep_seconds=1800,
        calibration=cal,
    )
    assert abs(one - two) < 1e-12
    assert one < 2.0


def test_tank_ammonia_is_conservative_when_no_inflow() -> None:
    held = step_tank_ammonia(
        ammonia_mg_n_l=0.08,
        inflow_mg_n_l=0.01,
        inflow_m3s=0.0,
        volume_m3=50.0,
        timestep_seconds=7200,
    )
    assert abs(held - 0.08) < 1e-12


def test_network_target_breach() -> None:
    cal = load_monochloramine_calibration()
    network = ThermalNetworkSpec(
        node_kinds={"R1": KIND_RESERVOIR, "J1": KIND_JUNCTION},
        links=[ThermalLinkSpec("P1", "R1", "J1", 80000.0, 0.08, 0.001)],
        tanks=[],
        source_node_ids=("R1",),
    )
    state = step_monochloramine_network(
        network=network,
        residuals_mg_l={"R1": 2.0, "J1": 2.0},
        temperatures_c={"R1": 35.0, "J1": 35.0},
        water_age_hours={"R1": 1.0, "J1": 60.0},
        free_ammonia_mg_n_l={"R1": 0.02, "J1": 0.02},
        timestep_seconds=3600,
        calibration=cal,
        source_residual_mg_l=2.0,
        source_free_ammonia_mg_n_l=0.02,
        ph=7.5,
    )
    assert state.nodes["R1"].target_breach is False
    assert state.nodes["J1"].residual_mg_l < cal.operational_target_mg_l
    assert state.nodes["J1"].target_breach is True


def test_tank_node_flagged() -> None:
    cal = load_monochloramine_calibration()
    network = ThermalNetworkSpec(
        node_kinds={"R1": KIND_RESERVOIR, "T1": KIND_TANK},
        links=[ThermalLinkSpec("P1", "R1", "T1", 100.0, 0.3, 0.01)],
        tanks=[ThermalTankSpec(node_id="T1", volume_m3=200.0, diameter_m=10.0, level_m=2.0)],
        source_node_ids=("R1",),
    )
    state = step_monochloramine_network(
        network=network,
        residuals_mg_l={"R1": 2.0, "T1": 2.0},
        temperatures_c={"R1": 22.0, "T1": 22.0},
        water_age_hours={"R1": 1.0, "T1": 30.0},
        free_ammonia_mg_n_l={"R1": 0.04, "T1": 0.04},
        timestep_seconds=3600,
        calibration=cal,
        source_residual_mg_l=2.0,
        source_free_ammonia_mg_n_l=0.04,
        ph=7.5,
    )
    assert "TANK" in state.nodes["T1"].flags
    assert state.nodes["T1"].residual_mg_l <= 2.0


def test_rejects_negative_residual() -> None:
    cal = load_monochloramine_calibration()
    network = ThermalNetworkSpec(
        node_kinds={"R1": KIND_RESERVOIR},
        links=[],
        tanks=[],
        source_node_ids=("R1",),
    )
    try:
        step_monochloramine_network(
            network=network,
            residuals_mg_l={"R1": -0.1},
            temperatures_c={"R1": 20.0},
            water_age_hours={"R1": 1.0},
            free_ammonia_mg_n_l={"R1": 0.02},
            timestep_seconds=3600,
            calibration=cal,
            source_residual_mg_l=-0.1,
            source_free_ammonia_mg_n_l=0.02,
            ph=7.5,
        )
    except ValueError as exc:
        assert "negative" in str(exc).lower()
    else:
        raise AssertionError("expected validity rejection")


def test_temperature_outside_range_is_flagged_not_invented() -> None:
    cal = load_monochloramine_calibration()
    flags = validity_flags(
        temperature_c=40.0,
        ph=7.5,
        residual_mg_l=2.0,
        free_ammonia_mg_n_l=0.02,
        chlorine_to_nitrogen_ratio=3.0,
        calibration=cal,
    )
    assert "TEMPERATURE_OUTSIDE_REFERENCE" in flags
    assert "CL_N_OUTSIDE_REFERENCE" in flags


def test_does_not_use_wntr_msx_batch_example() -> None:
    from pathlib import Path

    import veinguard_sim.chemistry.monochloramine as module

    source = module.__file__
    assert source is not None
    text = Path(source).read_text(encoding="utf-8")
    assert "batch_chloramine_decay" not in text
    assert "wntr.msx" not in text


def test_log_linear_rate_is_van_t_hoff_between_published_points() -> None:
    cal = load_monochloramine_calibration()
    low, high = cal.half_lives
    k0 = log(2.0) / (low.hours * 3600)
    k1 = log(2.0) / (high.hours * 3600)
    mid_t = 0.5 * (low.temperature_c + high.temperature_c)
    expected = exp(0.5 * (log(k0) + log(k1)))
    assert abs(bulk_rate_per_second(mid_t, cal) - expected) < 1e-16


def test_monochloramine_api(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(
        "/v1/simulations/monochloramine",
        headers=auth_headers,
        json={
            "sourceResidualMgL": 2.0,
            "operationalTargetMgL": 1.5,
            "freeAmmoniaMgL": 0.08,
            "pH": 7.5,
            "chlorineToNitrogenRatio": 4.5,
            "timestepSeconds": 3600,
            "sourceNodeIds": ["R1"],
            "nodes": [
                {
                    "id": "R1",
                    "kind": "RESERVOIR",
                    "residualMgL": 2.0,
                    "temperatureC": 28.0,
                    "waterAgeHours": 1.0,
                },
                {
                    "id": "J1",
                    "kind": "JUNCTION",
                    "residualMgL": 2.0,
                    "temperatureC": 28.0,
                    "waterAgeHours": 52.0,
                },
            ],
            "links": [
                {
                    "id": "P1",
                    "fromNodeId": "R1",
                    "toNodeId": "J1",
                    "lengthM": 1200,
                    "diameterM": 0.15,
                    "flowM3s": 0.01,
                }
            ],
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["modelVersion"] == "monochloramine-v1"
    assert data["chemistryProfile"] == "MONOCHLORAMINE"
    assert data["calibrationSource"] == "LITERATURE_REFERENCE"
    assert data["nodes"]["R1"]["residualMgL"] == 2.0
    assert data["nodes"]["J1"]["residualMgL"] < 2.0
    assert data["nodes"]["J1"]["residualMgL"] >= 0.0
    assert "projectedTargetBreach" in data["nodes"]["J1"]
    assert "probability" not in data["nitrificationConditions"]
    assert data["nitrificationConditions"]["modelVersion"] == "nitrification-conditions-v1"
    assert data["freeAmmoniaUnits"] == "mg-N/L"
    assert data["phReference"] == 7.5
    assert "HIGH_WATER_AGE" in data["nodes"]["J1"]["nitrificationConditions"]["drivers"]
    assert "FREE_AMMONIA_PRESENT" in data["nitrificationConditions"]["drivers"]


def test_monochloramine_api_rejects_invalid_ph(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/simulations/monochloramine",
        headers=auth_headers,
        json={
            "freeAmmoniaMgL": 0.02,
            "pH": 15.0,
            "sourceNodeIds": ["R1"],
            "nodes": [
                {
                    "id": "R1",
                    "kind": "RESERVOIR",
                    "residualMgL": 2.0,
                    "temperatureC": 20.0,
                }
            ],
            "links": [],
        },
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "NETWORK_INVALID"


def test_monochloramine_api_requires_ammonia(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/simulations/monochloramine",
        headers=auth_headers,
        json={
            "pH": 7.5,
            "nodes": [
                {
                    "id": "R1",
                    "kind": "RESERVOIR",
                    "residualMgL": 2.0,
                    "temperatureC": 20.0,
                }
            ],
            "links": [],
        },
    )
    assert response.status_code == 400
