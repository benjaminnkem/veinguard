from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from veinguard_sim.settings import get_settings


@dataclass(frozen=True)
class ObjectiveProfile:
    profile_id: str
    model_version: str
    weights: dict[str, float]


def objective_dir() -> Path:
    configured = Path(get_settings().objective_data_dir)
    if not configured.is_absolute():
        from_cwd = (Path.cwd() / configured).resolve()
        if from_cwd.exists():
            return from_cwd
        return (Path(__file__).resolve().parents[4] / "data" / "objective").resolve()
    return configured


def load_objective(profile_id: str = "demo-objective-v1") -> ObjectiveProfile:
    path = objective_dir() / f"{profile_id}.json"
    if not path.is_file():
        raise FileNotFoundError(f"Unknown objective profile '{profile_id}'.")
    raw = json.loads(path.read_text(encoding="utf-8"))
    weights = {str(key): float(value) for key, value in raw["weights"].items()}
    return ObjectiveProfile(
        profile_id=str(raw["id"]),
        model_version=str(raw["modelVersion"]),
        weights=weights,
    )


def score_objective(
    profile: ObjectiveProfile,
    *,
    residual_deficit: float,
    target_breach_count: int,
    flush_water_liters: float,
    chemical_increment_mg: float,
    energy_kwh: float,
    switching_complexity: float,
) -> float:
    weights = profile.weights
    return (
        weights.get("residualDeficitIntegral", 0.0) * residual_deficit
        + weights.get("targetBreachCount", 0.0) * float(target_breach_count)
        + weights.get("flushWaterLiters", 0.0) * flush_water_liters
        + weights.get("chemicalIncrementMg", 0.0) * chemical_increment_mg
        + weights.get("energyDeltaKwh", 0.0) * energy_kwh
        + weights.get("switchingComplexity", 0.0) * switching_complexity
    )


def compare_candidates(results: list[dict[str, Any]], profile: ObjectiveProfile) -> dict[str, Any]:
    feasible: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    for item in results:
        if item.get("feasible"):
            feasible.append(item)
        else:
            rejected.append(
                {
                    "scenarioRunId": item.get("scenarioRunId"),
                    "hardConstraintViolationIds": [
                        row["id"]
                        for row in item.get("constraints", [])
                        if row.get("severity") == "HARD" and not row.get("passed")
                    ],
                }
            )
    feasible.sort(key=lambda row: (float(row["objective"]), str(row.get("scenarioRunId"))))
    ranked = [
        {
            "scenarioRunId": row.get("scenarioRunId"),
            "objective": row["objective"],
            "rank": index + 1,
        }
        for index, row in enumerate(feasible)
    ]
    return {
        "feasible": ranked,
        "rejected": rejected,
        "objectiveProfileVersion": profile.model_version,
        "objectiveProfileId": profile.profile_id,
    }
