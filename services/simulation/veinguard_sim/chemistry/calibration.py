from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from veinguard_sim.settings import get_settings

MODEL_VERSION = "free-chlorine-v1"
DEFAULT_PROFILE_ID = "literature-free-chlorine-v1"
MONOCHLORAMINE_MODEL_VERSION = "monochloramine-v1"
DEFAULT_MONOCHLORAMINE_PROFILE_ID = "literature-monochloramine-v1"
NITRIFICATION_MODEL_VERSION = "nitrification-conditions-v1"
DEFAULT_NITRIFICATION_PROFILE_ID = "nitrification-conditions-v1"


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


@dataclass(frozen=True)
class HalfLifePoint:
    temperature_c: float
    hours: float
    ph: float
    qualifier: str


@dataclass(frozen=True)
class MonochloramineCalibration:
    profile_id: str
    source: str
    model_version: str
    source_residual_mg_l: float
    operational_target_mg_l: float
    ph_reference: float
    half_lives: tuple[HalfLifePoint, ...]
    wall_decay: float
    validity_temperature_c: tuple[float, float]
    validity_ph: tuple[float, float]
    validity_residual_mg_l: tuple[float, float]
    validity_free_ammonia_mg_n_l: tuple[float, float]
    validity_cl_n_ratio: tuple[float, float]
    references: tuple[str, ...]


@dataclass(frozen=True)
class NitrificationThresholds:
    profile_id: str
    source: str
    model_version: str
    high_water_age_hours: float
    elevated_temperature_c: float
    low_residual_mg_l: float
    free_ammonia_mg_n_l: float
    elevated_min_drivers: int
    high_min_drivers: int
    label_when_favorable: str
    label_when_not_indicated: str
    references: tuple[str, ...]


def _reference_tuple(raw: dict[str, object]) -> tuple[str, ...]:
    items = raw.get("references", [])
    if not isinstance(items, list):
        return ()
    refs: list[str] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        refs.append(str(item.get("doi") or item.get("url") or item.get("citation")))
    return tuple(refs)


def load_monochloramine_calibration(
    profile_id: str = DEFAULT_MONOCHLORAMINE_PROFILE_ID,
) -> MonochloramineCalibration:
    path = calibration_dir() / f"{profile_id}.json"
    if not path.is_file():
        msg = f"Unknown monochloramine calibration profile '{profile_id}'."
        raise FileNotFoundError(msg)
    raw = json.loads(path.read_text(encoding="utf-8"))
    if raw.get("modelVersion") != MONOCHLORAMINE_MODEL_VERSION:
        msg = f"Calibration {profile_id} is not {MONOCHLORAMINE_MODEL_VERSION}."
        raise ValueError(msg)
    points = tuple(
        HalfLifePoint(
            temperature_c=float(item["temperatureC"]),
            hours=float(item["hours"]),
            ph=float(item["ph"]),
            qualifier=str(item["qualifier"]),
        )
        for item in raw["halfLives"]
    )
    if len(points) != 2:
        msg = "Monochloramine V1 requires exactly two published half-life points."
        raise ValueError(msg)
    validity = raw["validityRange"]
    return MonochloramineCalibration(
        profile_id=str(raw["id"]),
        source=str(raw["source"]),
        model_version=str(raw["modelVersion"]),
        source_residual_mg_l=float(raw["sourceResidualMgL"]),
        operational_target_mg_l=float(raw["operationalTargetMgL"]),
        ph_reference=float(raw["phReference"]),
        half_lives=points,
        wall_decay=float(raw["wallDecay"]),
        validity_temperature_c=(
            float(validity["waterTemperatureC"][0]),
            float(validity["waterTemperatureC"][1]),
        ),
        validity_ph=(float(validity["pH"][0]), float(validity["pH"][1])),
        validity_residual_mg_l=(
            float(validity["residualMgL"][0]),
            float(validity["residualMgL"][1]),
        ),
        validity_free_ammonia_mg_n_l=(
            float(validity["freeAmmoniaMgNL"][0]),
            float(validity["freeAmmoniaMgNL"][1]),
        ),
        validity_cl_n_ratio=(
            float(validity["chlorineToNitrogenWeightRatio"][0]),
            float(validity["chlorineToNitrogenWeightRatio"][1]),
        ),
        references=_reference_tuple(raw),
    )


def load_nitrification_thresholds(
    profile_id: str = DEFAULT_NITRIFICATION_PROFILE_ID,
) -> NitrificationThresholds:
    path = calibration_dir() / f"{profile_id}.json"
    if not path.is_file():
        msg = f"Unknown nitrification threshold profile '{profile_id}'."
        raise FileNotFoundError(msg)
    raw = json.loads(path.read_text(encoding="utf-8"))
    if raw.get("modelVersion") != NITRIFICATION_MODEL_VERSION:
        msg = f"Threshold profile {profile_id} is not {NITRIFICATION_MODEL_VERSION}."
        raise ValueError(msg)
    thresholds = raw["thresholds"]
    levels = raw["levelRules"]
    return NitrificationThresholds(
        profile_id=str(raw["id"]),
        source=str(raw["source"]),
        model_version=str(raw["modelVersion"]),
        high_water_age_hours=float(thresholds["highWaterAgeHours"]["value"]),
        elevated_temperature_c=float(thresholds["elevatedWaterTemperatureC"]["value"]),
        low_residual_mg_l=float(thresholds["lowMonochloramineResidualMgL"]["value"]),
        free_ammonia_mg_n_l=float(thresholds["freeAmmoniaPresentMgNL"]["value"]),
        elevated_min_drivers=int(levels["ELEVATED"]["minDrivers"]),
        high_min_drivers=int(levels["HIGH"]["minDrivers"]),
        label_when_favorable=str(raw["labelWhenFavorable"]),
        label_when_not_indicated=str(raw["labelWhenNotIndicated"]),
        references=_reference_tuple(raw),
    )
