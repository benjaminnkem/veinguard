from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from veinguard_sim.settings import get_settings

MODEL_VERSION = "free-chlorine-v1"
DEFAULT_PROFILE_ID = "literature-free-chlorine-v1"


@dataclass(frozen=True)
class FreeChlorineCalibration:
    profile_id: str
    source: str
    model_version: str
    source_residual_mg_l: float
    operational_target_mg_l: float
    reference_temperature_c: float
    bulk_decay_per_day: float
    theta: float
    wall_decay: float
    references: tuple[str, ...]


def calibration_dir() -> Path:
    configured = Path(get_settings().calibration_data_dir)
    if not configured.is_absolute():
        from_cwd = (Path.cwd() / configured).resolve()
        if from_cwd.exists():
            return from_cwd
        return (Path(__file__).resolve().parents[4] / "data" / "calibration").resolve()
    return configured


def load_free_chlorine_calibration(profile_id: str = DEFAULT_PROFILE_ID) -> FreeChlorineCalibration:
    path = calibration_dir() / f"{profile_id}.json"
    if not path.is_file():
        msg = f"Unknown free-chlorine calibration profile '{profile_id}'."
        raise FileNotFoundError(msg)
    raw = json.loads(path.read_text(encoding="utf-8"))
    if raw.get("modelVersion") != MODEL_VERSION:
        msg = f"Calibration {profile_id} is not {MODEL_VERSION}."
        raise ValueError(msg)
    refs = tuple(
        str(item.get("doi") or item.get("url") or item.get("citation"))
        for item in raw.get("references", [])
    )
    return FreeChlorineCalibration(
        profile_id=str(raw["id"]),
        source=str(raw["source"]),
        model_version=str(raw["modelVersion"]),
        source_residual_mg_l=float(raw["sourceResidualMgL"]),
        operational_target_mg_l=float(raw["operationalTargetMgL"]),
        reference_temperature_c=float(raw["referenceTemperatureC"]),
        bulk_decay_per_day=float(raw["bulkDecayPerDay"]),
        theta=float(raw["theta"]),
        wall_decay=float(raw["wallDecay"]),
        references=refs,
    )
