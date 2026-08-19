from __future__ import annotations

from typing import Any

from veinguard_sim.georeference.affine import (
    aoi_bounds,
    apply_affine,
    load_aoi_polygon,
    load_georeference_profile,
)

NODE_PREFIX = {
    "JUNCTION": "J",
    "RESERVOIR": "R",
    "TANK": "T",
}
LINK_PREFIX = {
    "PIPE": "P",
    "PUMP": "PU",
    "VALVE": "V",
}


def prefixed_id(kind: str, source_id: str) -> str:
    prefix = NODE_PREFIX.get(kind) or LINK_PREFIX[kind]
    return f"{prefix}-{source_id}"


def _coords(node: Any) -> tuple[float | None, float | None]:
    coordinates = getattr(node, "coordinates", None)
    if not coordinates or len(coordinates) < 2:
        return None, None
    try:
        return float(coordinates[0]), float(coordinates[1])
    except (TypeError, ValueError):
        return None, None


def normalize_topology(wn: Any, georeference_profile_id: str | None = None) -> dict[str, Any]:
    node_kind: dict[str, str] = {}
    nodes: list[dict[str, Any]] = []

    def add_nodes(names: list[str], kind: str) -> None:
        for source_id in names:
            node_kind[source_id] = kind
            node = wn.get_node(source_id)
            x, y = _coords(node)
            nodes.append(
                {
                    "id": prefixed_id(kind, source_id),
                    "sourceId": source_id,
                    "type": kind,
                    "x": x,
                    "y": y,
                    "longitude": None,
                    "latitude": None,
                }
            )

    add_nodes(list(wn.junction_name_list), "JUNCTION")
    add_nodes(list(wn.reservoir_name_list), "RESERVOIR")
    add_nodes(list(wn.tank_name_list), "TANK")

    links: list[dict[str, Any]] = []

    def add_links(names: list[str], kind: str) -> None:
        for source_id in names:
            link = wn.get_link(source_id)
            start = str(link.start_node_name)
            end = str(link.end_node_name)
            links.append(
                {
                    "id": prefixed_id(kind, source_id),
                    "sourceId": source_id,
                    "type": kind,
                    "fromNodeId": prefixed_id(node_kind[start], start),
                    "toNodeId": prefixed_id(node_kind[end], end),
                }
            )

    add_links(list(wn.pipe_name_list), "PIPE")
    add_links(list(wn.pump_name_list), "PUMP")
    add_links(list(wn.valve_name_list), "VALVE")

    geo: dict[str, Any] = {"type": "NONE"}
    if georeference_profile_id:
        profile = load_georeference_profile(georeference_profile_id)
        aoi = load_aoi_polygon(profile.aoi_profile_id)
        dest = aoi_bounds(aoi)
        indexed = [(i, n) for i, n in enumerate(nodes) if n["x"] is not None and n["y"] is not None]
        transform, mapped = apply_affine(
            [(float(n["x"]), float(n["y"])) for _, n in indexed],
            profile,
            dest,
        )
        for (i, _node), (lon, lat) in zip(indexed, mapped, strict=True):
            nodes[i]["longitude"] = lon
            nodes[i]["latitude"] = lat
        geo = {
            "type": transform.type,
            "version": transform.version,
            "algorithm": transform.algorithm,
            "aoiProfileId": transform.aoi_profile_id,
            "sourceBounds": transform.source_bounds,
            "destBounds": transform.dest_bounds,
            "scale": transform.scale,
            "translateLon": transform.translate_lon,
            "translateLat": transform.translate_lat,
            "rotationDegrees": transform.rotation_degrees,
            "insetFraction": transform.inset_fraction,
            "samplingVersion": transform.sampling_version,
        }

    return {
        "geoReference": geo,
        "nodes": nodes,
        "links": links,
    }
