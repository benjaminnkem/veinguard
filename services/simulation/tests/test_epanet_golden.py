from __future__ import annotations

import tempfile
from pathlib import Path

import wntr
from fastapi.testclient import TestClient

from veinguard_sim.catalog import EPA_NET3_ID, load_catalog_bytes
from veinguard_sim.epanet.engine import simulate_hydraulics_and_age

ABS_TOL = 1e-6
REL_TOL = 1e-6


def _close(left: float, right: float) -> bool:
    scale = max(abs(left), abs(right), 1.0)
    return abs(left - right) <= max(ABS_TOL, REL_TOL * scale)


def test_wrapper_matches_direct_wntr_hydraulics_and_age() -> None:
    _, inp_bytes = load_catalog_bytes(EPA_NET3_ID)

    with tempfile.TemporaryDirectory(prefix="veinguard-golden-") as tmp:
        path = Path(tmp) / "Net3.inp"
        path.write_bytes(inp_bytes)
        wn = wntr.network.WaterNetworkModel(str(path))
        wn.options.quality.parameter = "AGE"
        simulator = wntr.sim.EpanetSimulator(wn)
        prefix = str(Path(tmp) / "direct")
        direct = simulator.run_sim(version=2.2, file_prefix=prefix)

    wrapped = simulate_hydraulics_and_age(inp_bytes, sample_time_seconds=5 * 3600)

    sample = wrapped.sample_time_seconds
    assert sample in wrapped.times_seconds

    for node_id in ("101", "123", "Lake", "1"):
        expected_p = float(direct.node["pressure"].loc[sample, node_id])
        actual_p = wrapped.nodes[node_id]["pressureM"]
        assert actual_p is not None
        assert _close(actual_p, expected_p), (
            f"pressure mismatch at {node_id}: {actual_p} vs {expected_p}"
        )

        expected_age_h = float(direct.node["quality"].loc[sample, node_id]) / 3600.0
        actual_age = wrapped.nodes[node_id]["waterAgeHours"]
        assert actual_age is not None
        assert _close(actual_age, expected_age_h), (
            f"age mismatch at {node_id}: {actual_age} vs {expected_age_h}"
        )

    expected_flow = float(direct.link["flowrate"].loc[sample, "101"])
    actual_flow = wrapped.links["101"]["flowM3s"]
    assert actual_flow is not None
    assert _close(actual_flow, expected_flow)

    assert wrapped.converged is True
    assert wrapped.engines.wntr_version == wntr.__version__
    assert wrapped.engines.epanet_version.startswith("2.2")
    assert wrapped.summary.max_water_age_hours is not None
    assert wrapped.summary.max_water_age_hours >= 0


def test_hydraulics_api_returns_real_values(
    client: TestClient,
    auth_headers: dict[str, str],
) -> None:
    response = client.post(
        "/v1/simulations/hydraulics",
        headers=auth_headers,
        json={"networkId": "epa-net3", "sampleTimeSeconds": 0},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["converged"] is True
    assert data["summary"]["maxPressureM"] is not None
    assert data["nodes"]["101"]["pressureM"] is not None
    assert data["links"]["101"]["flowM3s"] is not None
    assert data["engines"]["wntrVersion"]
    assert "wntr" not in data["nodes"]
