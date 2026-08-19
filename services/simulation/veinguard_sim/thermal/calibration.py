from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from veinguard_sim.settings import get_settings

MODEL_VERSION = "water-temp-v1"
DEFAULT_PROFILE_ID = "literature-water-temp-v1"


@dataclass(frozen=True)
class ThermalCalibration:
    profile_id: str
    source: str
    model_version: str
    water_density_kg_m3: float
    water_specific_heat_j_kg_k: float
    pipe_overall_heat_transfer_w_m2_k: float
    stagnant_flow_m3s: float
    burial_depth_m: float
    ground_thermal_diffusivity_m2s: float
    tank_overall_heat_transfer_w_m2_k: float
    tank_solar_absorptance: float
    references: tuple[str, ...]


def calibration_dir() -> Path:
    configured = Path(get_settings().calibration_data_dir)
    if not configured.is_absolute():
        from_cwd = (Path.cwd() / configured).resolve()
        if from_cwd.exists():
            return from_cwd
        return (Path(__file__).resolve().parents[4] / "data" / "calibration").resolve()
    return configured


def load_thermal_calibration(profile_id: str = DEFAULT_PROFILE_ID) -> ThermalCalibration:
    path = calibration_dir() / f"{profile_id}.json"
    if not path.is_file():
        msg = f"Unknown thermal calibration profile '{profile_id}'."
        raise FileNotFoundError(msg)
    raw = json.loads(path.read_text(encoding="utf-8"))
    if raw.get("modelVersion") != MODEL_VERSION:
        msg = f"Calibration {profile_id} is not {MODEL_VERSION}."
        raise ValueError(msg)
    refs = tuple(str(item.get("doi") or item.get("citation")) for item in raw.get("references", []))
    return ThermalCalibration(
        profile_id=str(raw["id"]),
        source=str(raw["source"]),
        model_version=str(raw["modelVersion"]),
        water_density_kg_m3=float(raw["waterDensityKgM3"]),
        water_specific_heat_j_kg_k=float(raw["waterSpecificHeatJKgK"]),
        pipe_overall_heat_transfer_w_m2_k=float(raw["pipeOverallHeatTransferWm2K"]),
        stagnant_flow_m3s=float(raw["stagnantFlowM3s"]),
        burial_depth_m=float(raw["burialDepthM"]),
        ground_thermal_diffusivity_m2s=float(raw["groundThermalDiffusivityM2s"]),
        tank_overall_heat_transfer_w_m2_k=float(raw["tankOverallHeatTransferWm2K"]),
        tank_solar_absorptance=float(raw["tankSolarAbsorptance"]),
        references=refs,
    )
