from __future__ import annotations

from typing import Any

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


def normalize_topology(wn: Any) -> dict[str, Any]:
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

    return {
        "geoReference": {"type": "NONE"},
        "nodes": nodes,
        "links": links,
    }
