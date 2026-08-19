from __future__ import annotations

from dataclasses import replace
from math import exp

from fastapi.testclient import TestClient

from veinguard_sim.thermal.calibration import load_thermal_calibration
from veinguard_sim.thermal.mixing import mix_inflows
from veinguard_sim.thermal.network import (
    KIND_JUNCTION,
    KIND_RESERVOIR,
    KIND_TANK,
    NodeThermal,
    ThermalLinkSpec,
    ThermalNetworkSpec,
    ThermalState,
    ThermalTankSpec,
    step_thermal_network,
)
from veinguard_sim.thermal.pipes import pipe_outlet_temperature, pipe_rate_constant
from veinguard_sim.thermal.soil import soil_lag_seconds, step_soil_temperature
from veinguard_sim.thermal.tanks import step_tank_temperature


def test_k_zero_preserves_inlet() -> None:
    cal = load_thermal_calibration()
    zero_u = replace(cal, pipe_overall_heat_transfer_w_m2_k=0.0)
    outlet, _flag = pipe_outlet_temperature(
        inlet_temperature_c=12.0,
        boundary_temperature_c=30.0,
        length_m=100.0,
        diameter_m=0.2,
        flow_m3s=0.05,
        timestep_seconds=3600,
        closed=False,
        calibration=zero_u,
    )
    assert abs(outlet - 12.0) < 1e-12


def test_long_contact_approaches_boundary() -> None:
    cal = load_thermal_calibration()
    outlet, flag = pipe_outlet_temperature(
        inlet_temperature_c=10.0,
        boundary_temperature_c=25.0,
        length_m=20_000.0,
        diameter_m=0.05,
        flow_m3s=0.0005,
        timestep_seconds=3600,
        closed=False,
        calibration=cal,
    )
    assert flag == "FLOWING"
    assert outlet > 24.0
    assert outlet <= 25.0


def test_stagnant_is_finite() -> None:
    cal = load_thermal_calibration()
    outlet, flag = pipe_outlet_temperature(
        inlet_temperature_c=10.0,
        boundary_temperature_c=20.0,
        length_m=100.0,
        diameter_m=0.2,
        flow_m3s=0.0,
        timestep_seconds=3600,
        closed=False,
        calibration=cal,
        previous_outlet_c=10.0,
    )
    assert flag == "STAGNANT"
    assert 10.0 < outlet < 20.0


def test_closed_link_does_not_transport() -> None:
    cal = load_thermal_calibration()
    outlet, flag = pipe_outlet_temperature(
        inlet_temperature_c=5.0,
        boundary_temperature_c=20.0,
        length_m=100.0,
        diameter_m=0.2,
        flow_m3s=1.0,
        timestep_seconds=3600,
        closed=True,
        calibration=cal,
        previous_outlet_c=8.0,
    )
    assert flag == "CLOSED_LINK"
    assert outlet != 5.0


def test_flow_reversal_uses_opposite_inlet() -> None:
    cal = load_thermal_calibration()
    forward, flag_f = pipe_outlet_temperature(
        inlet_temperature_c=10.0,
        boundary_temperature_c=20.0,
        length_m=200.0,
        diameter_m=0.15,
        flow_m3s=0.02,
        timestep_seconds=3600,
        closed=False,
        calibration=cal,
    )
    reverse, flag_r = pipe_outlet_temperature(
        inlet_temperature_c=30.0,
        boundary_temperature_c=20.0,
        length_m=200.0,
        diameter_m=0.15,
        flow_m3s=-0.02,
        timestep_seconds=3600,
        closed=False,
        calibration=cal,
    )
    assert flag_f == "FLOWING"
    assert flag_r == "FLOW_REVERSED"
    assert forward > 10.0
    assert reverse < 30.0
    assert abs(pipe_rate_constant(0.15, cal) - pipe_rate_constant(0.15, cal)) == 0


def test_junction_mix_is_flow_weighted() -> None:
    mixed, flag = mix_inflows(
        [(2.0, 10.0), (1.0, 40.0)],
        previous_temperature_c=0.0,
        stagnant_flow_m3s=1e-8,
    )
    assert flag == "MIXED"
    assert abs(mixed - 20.0) < 1e-12


def test_no_inflow_keeps_previous() -> None:
    mixed, flag = mix_inflows([], previous_temperature_c=16.5, stagnant_flow_m3s=1e-8)
    assert flag == "NO_INFLOW"
    assert mixed == 16.5


def test_soil_lag_is_not_air() -> None:
    cal = load_thermal_calibration()
    tau = soil_lag_seconds(cal)
    assert tau > 86400
    next_soil = step_soil_temperature(18.0, 40.0, 3600, cal)
    assert 18.0 < next_soil < 19.0
    expected = 18.0 + (40.0 - 18.0) * (1 - exp(-3600 / tau))
    assert abs(next_soil - expected) < 1e-9


def test_tank_balance_and_solar_absent() -> None:
    cal = load_thermal_calibration()
    updated, flags = step_tank_temperature(
        temperature_c=15.0,
        inflow_temperature_c=15.0,
        inflow_m3s=0.0,
        volume_m3=500.0,
        diameter_m=10.0,
        level_m=4.0,
        air_temperature_c=35.0,
        timestep_seconds=3600,
        calibration=cal,
        solar_irradiance_w_m2=None,
    )
    assert "SOLAR_ABSENT" in flags
    assert 15.0 < updated < 35.0


def test_one_pipe_network_step() -> None:
    cal = load_thermal_calibration()
    network = ThermalNetworkSpec(
        node_kinds={"R1": KIND_RESERVOIR, "J1": KIND_JUNCTION},
        links=[
            ThermalLinkSpec(
                link_id="P1",
                from_node_id="R1",
                to_node_id="J1",
                length_m=500.0,
                diameter_m=0.2,
                flow_m3s=0.02,
            )
        ],
        tanks=[],
        source_node_ids=("R1",),
    )
    state = ThermalState(
        node_temperature_c={
            "R1": NodeThermal(15.0),
            "J1": NodeThermal(15.0),
        },
        soil_temperature_c=18.0,
        calibration_profile_id=cal.profile_id,
        model_version=cal.model_version,
        solar_present=False,
    )
    nxt = step_thermal_network(
        network=network,
        state=state,
        air_temperature_c=35.0,
        timestep_seconds=3600,
        calibration=cal,
        source_temperature_c=15.0,
    )
    assert nxt.node_temperature_c["R1"].temperature_c == 15.0
    assert nxt.node_temperature_c["J1"].temperature_c > 15.0
    assert nxt.soil_temperature_c > 18.0
    assert nxt.soil_temperature_c < 35.0


def test_tank_node_in_network() -> None:
    cal = load_thermal_calibration()
    network = ThermalNetworkSpec(
        node_kinds={"R1": KIND_RESERVOIR, "T1": KIND_TANK},
        links=[
            ThermalLinkSpec(
                link_id="P1",
                from_node_id="R1",
                to_node_id="T1",
                length_m=50.0,
                diameter_m=0.3,
                flow_m3s=0.05,
            )
        ],
        tanks=[ThermalTankSpec(node_id="T1", volume_m3=800.0, diameter_m=12.0, level_m=5.0)],
        source_node_ids=("R1",),
    )
    state = ThermalState(
        node_temperature_c={"R1": NodeThermal(16.0), "T1": NodeThermal(16.0)},
        soil_temperature_c=18.0,
        calibration_profile_id=cal.profile_id,
        model_version=cal.model_version,
        solar_present=False,
    )
    nxt = step_thermal_network(
        network=network,
        state=state,
        air_temperature_c=32.0,
        timestep_seconds=3600,
        calibration=cal,
        source_temperature_c=16.0,
    )
    assert "TANK" in nxt.node_temperature_c["T1"].flags
    assert nxt.node_temperature_c["T1"].temperature_c >= 16.0


def test_water_temperature_api(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(
        "/v1/simulations/water-temperature",
        headers=auth_headers,
        json={
            "airTemperatureC": 38.0,
            "sourceTemperatureC": 14.0,
            "timestepSeconds": 3600,
            "soilTemperatureC": 18.0,
            "nodes": [
                {"id": "R1", "kind": "RESERVOIR", "temperatureC": 14.0},
                {"id": "J1", "kind": "JUNCTION", "temperatureC": 14.0},
            ],
            "links": [
                {
                    "id": "P1",
                    "fromNodeId": "R1",
                    "toNodeId": "J1",
                    "lengthM": 800,
                    "diameterM": 0.2,
                    "flowM3s": 0.03,
                }
            ],
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["modelVersion"] == "water-temp-v1"
    assert data["calibrationSource"] == "LITERATURE_REFERENCE"
    assert data["nodes"]["R1"]["temperatureC"] == 14.0
    assert data["nodes"]["J1"]["temperatureC"] > 14.0
    assert data["soilTemperatureC"] != 38.0
    assert data["solarPresent"] is False
