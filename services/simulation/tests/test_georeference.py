from __future__ import annotations

from veinguard_sim.georeference.affine import (
    aoi_bounds,
    apply_affine,
    load_aoi_polygon,
    load_georeference_profile,
    source_bounds,
)
from veinguard_sim.georeference.associate import (
    FLAG_NO_THERMAL_COVERAGE,
    associate_assets,
    point_in_ring,
)


def test_affine_is_deterministic_and_centered() -> None:
    profile = load_georeference_profile()
    aoi = load_aoi_polygon(profile.aoi_profile_id)
    dest = aoi_bounds(aoi)
    points = [(8.0, 0.0), (44.86, 31.06), (9.0, 27.85)]
    first, mapped = apply_affine(points, profile, dest)
    second, mapped_again = apply_affine(points, profile, dest)
    assert first.scale == second.scale
    assert mapped == mapped_again
    assert first.type == "SYNTHETIC_GEOREFERENCING"
    lons = [p[0] for p in mapped]
    lats = [p[1] for p in mapped]
    inset_lon = (dest["maxLon"] - dest["minLon"]) * profile.inset_fraction
    inset_lat = (dest["maxLat"] - dest["minLat"]) * profile.inset_fraction
    assert min(lons) >= dest["minLon"] + inset_lon - 1e-9
    assert max(lons) <= dest["maxLon"] - inset_lon + 1e-9
    assert min(lats) >= dest["minLat"] + inset_lat - 1e-9
    assert max(lats) <= dest["maxLat"] - inset_lat + 1e-9


def test_source_bounds_preserved_separately() -> None:
    points = [(8.0, 0.0), (44.86, 31.06)]
    bounds = source_bounds(points)
    assert bounds["minX"] == 8.0
    assert bounds["maxY"] == 31.06


def test_point_in_ring_and_miss() -> None:
    square = [[0.0, 0.0], [2.0, 0.0], [2.0, 2.0], [0.0, 2.0], [0.0, 0.0]]
    assert point_in_ring(1.0, 1.0, square) is True
    assert point_in_ring(3.0, 1.0, square) is False


def test_association_and_no_coverage() -> None:
    nodes = [
        {"id": "J-1", "longitude": 1.0, "latitude": 1.0, "fromNodeId": None},
        {"id": "J-2", "longitude": 9.0, "latitude": 9.0},
    ]
    links = [{"id": "P-1", "fromNodeId": "J-1", "toNodeId": "J-2"}]
    map_data = {
        "type": "FeatureCollection",
        "features": [
            {
                "id": "cell-a",
                "type": "Feature",
                "properties": {"value": 31.5},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [[0.0, 0.0], [2.0, 0.0], [2.0, 2.0], [0.0, 2.0], [0.0, 0.0]]
                    ],
                },
            }
        ],
    }
    associated = associate_assets(nodes=nodes, links=links, map_data=map_data)
    assert associated["J-1"].temperature_c == 31.5
    assert associated["J-1"].cell_id == "cell-a"
    assert FLAG_NO_THERMAL_COVERAGE in associated["J-2"].flags
    assert associated["J-2"].temperature_c is None
