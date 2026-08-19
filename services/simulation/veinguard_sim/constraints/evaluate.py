from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from veinguard_sim.epanet.engine import HydraulicRun
from veinguard_sim.settings import get_settings


@dataclass(frozen=True)
class ConstraintProfile:
    profile_id: str
    model_version: str
    hard: tuple[dict[str, Any], ...]


def constraints_dir() -> Path:
    configured = Path(get_settings().constraints_data_dir)
    if not configured.is_absolute():
        from_cwd = (Path.cwd() / configured).resolve()
        if from_cwd.exists():
            return from_cwd
        return (Path(__file__).resolve().parents[4] / "data" / "constraints").resolve()
    return configured


def load_constraints(profile_id: str = "demo-constraints-v1") -> ConstraintProfile:
    path = constraints_dir() / f"{profile_id}.json"
    if not path.is_file():
        raise FileNotFoundError(f"Unknown constraints profile '{profile_id}'.")
    raw = json.loads(path.read_text(encoding="utf-8"))
    return ConstraintProfile(
        profile_id=str(raw["id"]),
        model_version=str(raw["modelVersion"]),
        hard=tuple(raw["hard"]),
    )


def evaluate_constraints(
    *,
    profile: ConstraintProfile,
    hydraulics: HydraulicRun,
    wn: Any,
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for rule in profile.hard:
        kind = str(rule["type"])
        if kind == "CONVERGED":
            passed = hydraulics.converged
            results.append(_result(rule, passed, observed=1.0 if passed else 0.0, limit=1.0))
        elif kind == "MIN_PRESSURE_M":
            observed = _sample_pressure_extrema(hydraulics)[0]
            limit = float(rule["limit"])
            passed = observed is not None and observed >= limit
            assets = _nodes_below(hydraulics, limit) if not passed else []
            results.append(
                _result(rule, passed, observed=observed, limit=limit, units="m", asset_ids=assets)
            )
        elif kind == "MAX_PRESSURE_M":
            observed = _sample_pressure_extrema(hydraulics)[1]
            limit = float(rule["limit"])
            passed = observed is not None and observed <= limit
            results.append(_result(rule, passed, observed=observed, limit=limit, units="m"))
        elif kind == "TANK_LEVEL_BOUNDS":
            failed: list[str] = []
            for tank_id in wn.tank_name_list:
                tank = wn.get_node(tank_id)
                level = float(tank.init_level)
                if level < float(tank.min_level) or level > float(tank.max_level):
                    failed.append(tank_id)
            results.append(_result(rule, len(failed) == 0, asset_ids=failed))
        else:
            results.append(
                _result(
                    {**rule, "message": f"Unknown constraint type {kind}."},
                    False,
                )
            )
    return results


def _sample_pressure_extrema(hydraulics: HydraulicRun) -> tuple[float | None, float | None]:
    values = [
        pressure
        for values in hydraulics.nodes.values()
        if (pressure := values.get("pressureM")) is not None
    ]
    if not values:
        return None, None
    return min(values), max(values)


def _nodes_below(hydraulics: HydraulicRun, limit: float) -> list[str]:
    ids: list[str] = []
    for node_id, values in hydraulics.nodes.items():
        pressure = values.get("pressureM")
        if pressure is not None and pressure < limit:
            ids.append(str(node_id))
    return ids[:20]


def _result(
    rule: dict[str, Any],
    passed: bool,
    *,
    observed: float | None = None,
    limit: float | None = None,
    units: str | None = None,
    asset_ids: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "id": rule["id"],
        "type": rule["type"],
        "severity": "HARD",
        "passed": passed,
        "assetIds": asset_ids or [],
        "timeIndices": [],
        "observed": observed,
        "limit": limit if limit is not None else rule.get("limit"),
        "units": units or rule.get("units"),
        "message": rule.get("message") or "",
    }
