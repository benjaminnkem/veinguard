from __future__ import annotations

from veinguard_sim.operations.snapshot import project_layer


def _mini_snapshot() -> dict:
    return {
        "nodes": [
            {
                "id": "J-101",
                "sourceId": "101",
                "type": "JUNCTION",
                "longitude": -74.01,
                "latitude": 40.71,
                "pressureM": 12.4,
                "waterAgeHours": 8.0,
                "modeledWaterTemperatureC": 22.1,
                "residualMgL": 0.18,
                "projectedTargetBreach": True,
                "monochloramineResidualMgL": 1.7,
                "monochloramineTargetBreach": False,
                "nitrificationLevel": "ELEVATED",
                "flags": [],
            }
        ],
        "links": [
            {
                "id": "P-1",
                "sourceId": "1",
                "type": "PIPE",
                "fromNodeId": "J-101",
                "toNodeId": "J-105",
                "flowM3s": 0.02,
                "velocityMs": 0.4,
                "coordinates": [[-74.01, 40.71], [-74.012, 40.712]],
            }
        ],
    }


def test_pressure_layer_is_points_with_metric() -> None:
    geo = project_layer(_mini_snapshot(), "pressure")
    assert geo["features"][0]["geometry"]["type"] == "Point"
    assert geo["features"][0]["properties"]["pressureM"] == 12.4
    assert "residualMgL" not in geo["features"][0]["properties"]


def test_flow_layer_is_lines() -> None:
    geo = project_layer(_mini_snapshot(), "flow")
    assert geo["features"][0]["geometry"]["type"] == "LineString"
    assert geo["features"][0]["properties"]["flowM3s"] == 0.02


def test_monochloramine_residual_uses_modeled_field() -> None:
    geo = project_layer(_mini_snapshot(), "residual", chemistry="MONOCHLORAMINE")
    assert geo["features"][0]["properties"]["residualMgL"] == 1.7
