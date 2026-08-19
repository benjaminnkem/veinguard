# ADR-003 Benchmark network and synthetic georeferencing

**Status:** Accepted for V1  
**Date:** 2026-08-19  
**Versions:** network `epa-net3`, transform `synthetic-georef-v1`, AOI `demo-aoi-v1`

## Decision

EPA EPANET Example Network 3 is the V1 benchmark. It is labeled `EPA_BENCHMARK`. Its INP drawing coordinates are not WGS84. VeinGuard keeps those source `x`/`y` values and, when a map/thermal layer is needed, applies a **deterministic uniform-scale centered affine** into a documented demo AOI. That placement is `SYNTHETIC_GEOREFERENCING`.

## Transform

```text
s = min( destWidth * (1-2i) / srcWidth, destHeight * (1-2i) / srcHeight )
lon = destMidLon + (x - srcMidX) * s
lat = destMidLat + (y - srcMidY) * s
```

`i` is an inset fraction (demo 0.08) so nodes sit inside the AOI, not on the ring. Rotation is 0. Aspect ratio of the drawing is preserved. EPANET pipe lengths stay the INP lengths.

Each run stores source bounds, destination bounds, scale, translation, algorithm id, and version.

## Demo AOI

`demo-aoi-v1` is the United States polygon from the current FortyGuard Create Heatmap examples (Lower Manhattan block). It is eligible (US, small). It is **not** a claim that Net3 is New York infrastructure.

## Spatial association

FortyGuard `map_data` polygons are point-tested. Nodes use their georeferenced coordinates. Pipes use the midpoint of the georeferenced endpoints. A miss is `NO_THERMAL_COVERAGE`. No temperature is invented for a miss.

## Out of scope

- Real utility GIS
- Claiming the benchmark is a named city’s network
- Invented thermal cells
