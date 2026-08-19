from __future__ import annotations

from dataclasses import replace
from math import exp

from fastapi.testclient import TestClient

from veinguard_sim.chemistry.breach import target_breach
from veinguard_sim.chemistry.calibration import load_free_chlorine_calibration
from veinguard_sim.chemistry.kinetics import bulk_rate_per_second, decay_residual
from veinguard_sim.chemistry.network import step_free_chlorine_network
from veinguard_sim.chemistry.transport import pipe_outlet_residual, step_tank_residual
from veinguard_sim.thermal.network import (
    KIND_JUNCTION,
    KIND_RESERVOIR,
    ThermalLinkSpec,
    ThermalNetworkSpec,
)


def test_first_order_matches_closed_form() -> None:
    cal = load_free_chlorine_calibration()
    rate = bulk_rate_per_second(20.0, cal)
    got = decay_residual(1.0, rate, 3600)
    assert abs(got - exp(-rate * 3600)) < 1e-12


def test_hotter_decays_faster() -> None:
    cal = load_free_chlorine_calibration()
    cool = decay_residual(1.0, bulk_rate_per_second(10.0, cal), 7200)
    warm = decay_residual(1.0, bulk_rate_per_second(30.0, cal), 7200)
    assert warm < cool
    assert warm > 0


def test_no_negative_residual() -> None:
    cal = load_free_chlorine_calibration()
    huge_k = replace(cal, bulk_decay_per_day=50.0)
    assert decay_residual(0.01, bulk_rate_per_second(35.0, huge_k), 86400) == 0.0


def test_one_pipe_matches_analytical_tau() -> None:
    cal = load_free_chlorine_calibration()
    outlet, flag = pipe_outlet_residual(
        inlet_mg_l=1.0,
        temperature_c=20.0,
        length_m=1000.0,
        diameter_m=0.3,
        flow_m3s=0.02,
        timestep_seconds=3600,
        closed=False,
        calibration=cal,
    )
    from veinguard_sim.thermal.pipes import residence_time_seconds

    tau = residence_time_seconds(1000.0, 0.3, 0.02)
    expected = decay_residual(1.0, bulk_rate_per_second(20.0, cal), tau)
    assert flag == "FLOWING"
    assert abs(outlet - expected) < 1e-12


def test_stagnant_two_steps_match_one_step() -> None:
    cal = load_free_chlorine_calibration()
    rate = bulk_rate_per_second(20.0, cal)
    one = decay_residual(1.0, rate, 3600)
    two = decay_residual(decay_residual(1.0, rate, 1800), rate, 1800)
    assert abs(one - two) < 1e-12


def test_flow_reversal_decays_from_opposite_inlet() -> None:
    cal = load_free_chlorine_calibration()
    forward, flag_f = pipe_outlet_residual(
        inlet_mg_l=1.0,
        temperature_c=20.0,
        length_m=400.0,
        diameter_m=0.2,
        flow_m3s=0.01,
        timestep_seconds=3600,
        closed=False,
        calibration=cal,
    )
    reverse, flag_r = pipe_outlet_residual(
        inlet_mg_l=0.4,
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
    assert reverse < 0.4
    assert forward < 1.0


def test_branch_mixing() -> None:
    cal = load_free_chlorine_calibration()
    network = ThermalNetworkSpec(
        node_kinds={
            "R1": KIND_RESERVOIR,
            "R2": KIND_RESERVOIR,
            "J": KIND_JUNCTION,
        },
        links=[
            ThermalLinkSpec("P1", "R1", "J", 10.0, 0.2, 0.02),
            ThermalLinkSpec("P2", "R2", "J", 10.0, 0.2, 0.02),
        ],
        tanks=[],
        source_node_ids=("R1", "R2"),
    )
    # Short pipes → residual almost source. Override by using different source steps.
    state = step_free_chlorine_network(
        network=network,
        residuals_mg_l={"R1": 1.0, "R2": 0.2, "J": 0.5},
        temperatures_c={"R1": 20.0, "R2": 20.0, "J": 20.0},
        timestep_seconds=60,
        calibration=cal,
        source_residual_mg_l=1.0,
    )
    # Both sources forced to source_residual 1.0, so mix ~1 after short pipes.
    assert state.nodes["J"].residual_mg_l > 0.9


def test_tank_cstr_continuity() -> None:
    cal = load_free_chlorine_calibration()
    one = step_tank_residual(
        residual_mg_l=1.0,
        inflow_mg_l=1.0,
        inflow_m3s=0.0,
        volume_m3=100.0,
        temperature_c=20.0,
        timestep_seconds=3600,
        calibration=cal,
    )
    mid = step_tank_residual(
        residual_mg_l=1.0,
        inflow_mg_l=1.0,
        inflow_m3s=0.0,
        volume_m3=100.0,
        temperature_c=20.0,
        timestep_seconds=1800,
        calibration=cal,
    )
    two = step_tank_residual(
        residual_mg_l=mid,
        inflow_mg_l=1.0,
        inflow_m3s=0.0,
        volume_m3=100.0,
        temperature_c=20.0,
        timestep_seconds=1800,
        calibration=cal,
    )
    assert abs(one - two) < 1e-12


def test_target_breach_language() -> None:
    assert target_breach(0.19, 0.2) is True
    assert target_breach(0.2, 0.2) is False


def test_network_target_breach() -> None:
    cal = replace(
        load_free_chlorine_calibration(),
        operational_target_mg_l=0.9,
        bulk_decay_per_day=5.0,
    )
    network = ThermalNetworkSpec(
        node_kinds={"R1": KIND_RESERVOIR, "J1": KIND_JUNCTION},
        links=[ThermalLinkSpec("P1", "R1", "J1", 8000.0, 0.1, 0.005)],
        tanks=[],
        source_node_ids=("R1",),
    )
    state = step_free_chlorine_network(
        network=network,
        residuals_mg_l={"R1": 1.0, "J1": 1.0},
        temperatures_c={"R1": 30.0, "J1": 30.0},
        timestep_seconds=3600,
        calibration=cal,
        source_residual_mg_l=1.0,
    )
    assert state.nodes["R1"].target_breach is False
    assert state.nodes["J1"].residual_mg_l < 0.9
    assert state.nodes["J1"].target_breach is True


def test_constant_t_epanet_one_pipe_same_direction() -> None:
    import tempfile
    from pathlib import Path

    import wntr

    cal = load_free_chlorine_calibration()
    k = bulk_rate_per_second(20.0, cal)
    wn = wntr.network.WaterNetworkModel()
    wn.add_reservoir("R", base_head=40.0)
    wn.add_junction("J", base_demand=0.02, elevation=0.0)
    wn.add_pipe("P", "R", "J", length=500.0, diameter=0.25, roughness=100.0)
    wn.options.time.duration = 8 * 3600
    wn.options.time.hydraulic_timestep = 3600
    wn.options.time.quality_timestep = 60
    wn.options.time.report_timestep = 3600
    wn.options.quality.parameter = "CHEMICAL"
    wn.options.reaction.bulk_order = 1.0
    wn.options.reaction.bulk_coeff = -k
    wn.get_node("R").initial_quality = 1.0
    wn.get_node("J").initial_quality = 1.0
    wn.add_source("src", "R", "SETPOINT", 1.0, None)
    with tempfile.TemporaryDirectory() as tmp:
        results = wntr.sim.EpanetSimulator(wn).run_sim(
            version=2.2,
            file_prefix=str(Path(tmp) / "cl"),
        )
    last = float(results.node["quality"].index[-1])
    epanet_c = float(results.node["quality"].loc[last, "J"])
    flow = abs(float(results.link["flowrate"].loc[last, "P"]))
    outlet, _ = pipe_outlet_residual(
        inlet_mg_l=1.0,
        temperature_c=20.0,
        length_m=500.0,
        diameter_m=0.25,
        flow_m3s=flow,
        timestep_seconds=3600,
        closed=False,
        calibration=cal,
    )
    # Plug-flow ODE vs EPANET discrete quality: same decay direction, not bit-identical.
    assert 0 < epanet_c < 1.0
    assert 0 < outlet < 1.0
    assert abs(epanet_c - outlet) < 0.15


def test_free_chlorine_api(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(
        "/v1/simulations/free-chlorine",
        headers=auth_headers,
        json={
            "sourceResidualMgL": 1.0,
            "operationalTargetMgL": 0.2,
            "timestepSeconds": 3600,
            "sourceNodeIds": ["R1"],
            "nodes": [
                {"id": "R1", "kind": "RESERVOIR", "residualMgL": 1.0, "temperatureC": 28.0},
                {"id": "J1", "kind": "JUNCTION", "residualMgL": 1.0, "temperatureC": 28.0},
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
    assert data["modelVersion"] == "free-chlorine-v1"
    assert data["calibrationSource"] == "LITERATURE_REFERENCE"
    assert data["nodes"]["R1"]["residualMgL"] == 1.0
    assert data["nodes"]["J1"]["residualMgL"] < 1.0
    assert data["nodes"]["J1"]["residualMgL"] >= 0.0
    assert "projectedTargetBreach" in data["nodes"]["J1"]
