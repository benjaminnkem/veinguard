from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from veinguard_sim.settings import get_settings

GEOREF_VERSION = "synthetic-georef-v1"
DEFAULT_PROFILE_ID = "synthetic-georef-v1"
DEFAULT_AOI_ID = "demo-aoi-v1"


@dataclass(frozen=True)
class GeoreferenceProfile:
    profile_id: str
    model_version: str
    algorithm: str
    aoi_profile_id: str
    inset_fraction: float
    rotation_degrees: float
    sampling_version: str


@dataclass(frozen=True)
class AppliedTransform:
    type: str
    version: str
    algorithm: str
    aoi_profile_id: str
    source_bounds: dict[str, float]
    dest_bounds: dict[str, float]
    scale: float
    translate_lon: float
    translate_lat: float
    rotation_degrees: float
    inset_fraction: float
    sampling_version: str


def georeference_dir() -> Path:
    configured = Path(get_settings().georeference_data_dir)
    if not configured.is_absolute():
        from_cwd = (Path.cwd() / configured).resolve()
        if from_cwd.exists():
            return from_cwd
        return (Path(__file__).resolve().parents[4] / "data" / "georeference").resolve()
    return configured


def load_georeference_profile(profile_id: str = DEFAULT_PROFILE_ID) -> GeoreferenceProfile:
    path = georeference_dir() / f"{profile_id}.json"
    if not path.is_file():
        msg = f"Unknown georeference profile '{profile_id}'."
        raise FileNotFoundError(msg)
    raw = json.loads(path.read_text(encoding="utf-8"))
    if raw.get("modelVersion") != GEOREF_VERSION:
        msg = f"Georeference profile {profile_id} is not {GEOREF_VERSION}."
        raise ValueError(msg)
    sampling = raw.get("sampling") or {}
    return GeoreferenceProfile(
        profile_id=str(raw["id"]),
        model_version=str(raw["modelVersion"]),
        algorithm=str(raw["algorithm"]),
        aoi_profile_id=str(raw["aoiProfileId"]),
        inset_fraction=float(raw["insetFraction"]),
        rotation_degrees=float(raw["rotationDegrees"]),
        sampling_version=str(sampling.get("version") or "asset-sample-v1"),
    )


def load_aoi_polygon(aoi_profile_id: str = DEFAULT_AOI_ID) -> dict[str, object]:
    path = georeference_dir() / f"{aoi_profile_id}.json"
    if not path.is_file():
        msg = f"Unknown AOI profile '{aoi_profile_id}'."
        raise FileNotFoundError(msg)
    raw = json.loads(path.read_text(encoding="utf-8"))
    polygon = raw.get("polygon")
    if not isinstance(polygon, dict):
        raise ValueError(f"AOI {aoi_profile_id} has no polygon.")
    return polygon


def aoi_bounds(polygon: dict[str, object]) -> dict[str, float]:
    lons: list[float] = []
    lats: list[float] = []
    features = polygon.get("features")
    if not isinstance(features, list):
        raise ValueError("AOI is not a FeatureCollection.")
    for feature in features:
        if not isinstance(feature, dict):
            continue
        geometry = feature.get("geometry")
        if not isinstance(geometry, dict):
            continue
        coords = geometry.get("coordinates")
        if not isinstance(coords, list) or not coords:
            continue
        ring = coords[0]
        if not isinstance(ring, list):
            continue
        for point in ring:
            if isinstance(point, list) and len(point) >= 2:
                lons.append(float(point[0]))
                lats.append(float(point[1]))
    if not lons or not lats:
        raise ValueError("AOI polygon has no coordinates.")
    return {
        "minLon": min(lons),
        "maxLon": max(lons),
        "minLat": min(lats),
        "maxLat": max(lats),
    }


def source_bounds(points: list[tuple[float, float]]) -> dict[str, float]:
    if not points:
        raise ValueError("Network has no source coordinates to georeference.")
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return {"minX": min(xs), "maxX": max(xs), "minY": min(ys), "maxY": max(ys)}


def apply_affine(
    points: list[tuple[float, float]],
    profile: GeoreferenceProfile,
    dest: dict[str, float],
) -> tuple[AppliedTransform, list[tuple[float, float]]]:
    src = source_bounds(points)
    src_w = src["maxX"] - src["minX"]
    src_h = src["maxY"] - src["minY"]
    if src_w <= 0 or src_h <= 0:
        raise ValueError("Source bounds have zero width or height.")
    inset = profile.inset_fraction
    dest_w = (dest["maxLon"] - dest["minLon"]) * (1.0 - 2.0 * inset)
    dest_h = (dest["maxLat"] - dest["minLat"]) * (1.0 - 2.0 * inset)
    if dest_w <= 0 or dest_h <= 0:
        raise ValueError("Destination AOI is too small after inset.")
    scale = min(dest_w / src_w, dest_h / src_h)
    src_mid_x = 0.5 * (src["minX"] + src["maxX"])
    src_mid_y = 0.5 * (src["minY"] + src["maxY"])
    dest_mid_lon = 0.5 * (dest["minLon"] + dest["maxLon"])
    dest_mid_lat = 0.5 * (dest["minLat"] + dest["maxLat"])
    mapped = [
        (dest_mid_lon + (x - src_mid_x) * scale, dest_mid_lat + (y - src_mid_y) * scale)
        for x, y in points
    ]
    transform = AppliedTransform(
        type="SYNTHETIC_GEOREFERENCING",
        version=profile.model_version,
        algorithm=profile.algorithm,
        aoi_profile_id=profile.aoi_profile_id,
        source_bounds=src,
        dest_bounds=dest,
        scale=scale,
        translate_lon=dest_mid_lon - src_mid_x * scale,
        translate_lat=dest_mid_lat - src_mid_y * scale,
        rotation_degrees=profile.rotation_degrees,
        inset_fraction=profile.inset_fraction,
        sampling_version=profile.sampling_version,
    )
    return transform, mapped
