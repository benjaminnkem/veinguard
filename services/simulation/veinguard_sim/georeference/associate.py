from __future__ import annotations

from dataclasses import dataclass, field

FLAG_NO_THERMAL_COVERAGE = "NO_THERMAL_COVERAGE"
SAMPLING_VERSION = "asset-sample-v1"

_TEMP_KEYS = (
    "average_temperature",
    "value",
    "temperature",
    "tcm",
    "Temperature",
    "temp",
    "temp_c",
    "temperature_c",
)


@dataclass
class AssetAssociation:
    asset_id: str
    longitude: float
    latitude: float
    cell_id: str | None
    temperature_c: float | None
    flags: list[str] = field(default_factory=list)


def point_in_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    inside = False
    n = len(ring)
    if n < 4:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = float(ring[i][0]), float(ring[i][1])
        xj, yj = float(ring[j][0]), float(ring[j][1])
        intersects = ((yi > lat) != (yj > lat)) and (
            lon < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-18) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


def point_in_polygon(lon: float, lat: float, coordinates: list[object]) -> bool:
    if not coordinates:
        return False
    outer = coordinates[0]
    if not isinstance(outer, list):
        return False
    outer_ring = [pt for pt in outer if isinstance(pt, list) and len(pt) >= 2]
    if not point_in_ring(lon, lat, [[float(pt[0]), float(pt[1])] for pt in outer_ring]):
        return False
    for hole in coordinates[1:]:
        if not isinstance(hole, list):
            continue
        hole_ring = [pt for pt in hole if isinstance(pt, list) and len(pt) >= 2]
        if point_in_ring(lon, lat, [[float(pt[0]), float(pt[1])] for pt in hole_ring]):
            return False
    return True


def cell_temperature_c(properties: dict[str, object] | None) -> tuple[float | None, str | None]:
    if not properties:
        return None, None
    for key in _TEMP_KEYS:
        value = properties.get(key)
        if isinstance(value, (int, float)):
            return float(value), key
    for key, value in properties.items():
        if isinstance(value, (int, float)) and key.lower() not in {"id", "index"}:
            return float(value), key
    return None, None


def associate_point(
    lon: float,
    lat: float,
    features: list[dict[str, object]],
) -> tuple[str | None, float | None]:
    for index, feature in enumerate(features):
        geometry = feature.get("geometry")
        if not isinstance(geometry, dict) or geometry.get("type") != "Polygon":
            continue
        coords = geometry.get("coordinates")
        if not isinstance(coords, list):
            continue
        if point_in_polygon(lon, lat, coords):
            raw_props = feature.get("properties")
            props = raw_props if isinstance(raw_props, dict) else None
            temp, _key = cell_temperature_c(props)
            prop_id = props.get("id") if props else None
            cell_id = str(feature.get("id") or prop_id or f"cell-{index}")
            return cell_id, temp
    return None, None


def associate_assets(
    *,
    nodes: list[dict[str, object]],
    links: list[dict[str, object]],
    map_data: dict[str, object],
) -> dict[str, AssetAssociation]:
    features_raw = map_data.get("features")
    features = [item for item in features_raw if isinstance(item, dict)] if isinstance(
        features_raw, list
    ) else []
    by_id: dict[str, AssetAssociation] = {}
    node_xy: dict[str, tuple[float, float]] = {}

    for node in nodes:
        node_id = str(node["id"])
        lon = node.get("longitude")
        lat = node.get("latitude")
        if not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)):
            by_id[node_id] = AssetAssociation(
                asset_id=node_id,
                longitude=float("nan"),
                latitude=float("nan"),
                cell_id=None,
                temperature_c=None,
                flags=[FLAG_NO_THERMAL_COVERAGE],
            )
            continue
        node_xy[node_id] = (float(lon), float(lat))
        cell_id, temp = associate_point(float(lon), float(lat), features)
        flags = [] if cell_id is not None and temp is not None else [FLAG_NO_THERMAL_COVERAGE]
        by_id[node_id] = AssetAssociation(
            asset_id=node_id,
            longitude=float(lon),
            latitude=float(lat),
            cell_id=cell_id,
            temperature_c=temp,
            flags=flags,
        )

    for link in links:
        link_id = str(link["id"])
        start = node_xy.get(str(link.get("fromNodeId")))
        end = node_xy.get(str(link.get("toNodeId")))
        if start is None or end is None:
            by_id[link_id] = AssetAssociation(
                asset_id=link_id,
                longitude=float("nan"),
                latitude=float("nan"),
                cell_id=None,
                temperature_c=None,
                flags=[FLAG_NO_THERMAL_COVERAGE],
            )
            continue
        mid_lon = 0.5 * (start[0] + end[0])
        mid_lat = 0.5 * (start[1] + end[1])
        cell_id, temp = associate_point(mid_lon, mid_lat, features)
        flags = [] if cell_id is not None and temp is not None else [FLAG_NO_THERMAL_COVERAGE]
        by_id[link_id] = AssetAssociation(
            asset_id=link_id,
            longitude=mid_lon,
            latitude=mid_lat,
            cell_id=cell_id,
            temperature_c=temp,
            flags=flags,
        )
    return by_id
