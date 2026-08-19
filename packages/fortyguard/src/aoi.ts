import { FortyGuardError } from "./errors";
import type { GeoJsonFeatureCollection } from "./types";

const M2_PER_SQ_MI = 2_589_988.11;

interface LatLonBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

const US_BOXES: LatLonBox[] = [
  { minLat: 24.396, maxLat: 49.384, minLon: -125.0, maxLon: -66.934 },
  { minLat: 51.2, maxLat: 71.5, minLon: -179.15, maxLon: -129.97 },
  { minLat: 18.9, maxLat: 22.24, minLon: -160.25, maxLon: -154.8 },
  { minLat: 17.88, maxLat: 18.52, minLon: -67.95, maxLon: -65.22 },
];

function inBox(lat: number, lon: number, box: LatLonBox): boolean {
  return lat >= box.minLat && lat <= box.maxLat && lon >= box.minLon && lon <= box.maxLon;
}

export function pointInUnitedStates(lat: number, lon: number): boolean {
  return US_BOXES.some((box) => inBox(lat, lon, box));
}

function sameCoord(a: number[], b: number[]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function ringAreaSqMi(ring: number[][]): number {
  if (ring.length < 4) {
    return 0;
  }
  const lats = ring.map((c) => c[1] ?? 0);
  const meanLat = lats.reduce((s, v) => s + v, 0) / lats.length;
  const mPerDegLat = 110_574;
  const mPerDegLon = 111_320 * Math.cos((meanLat * Math.PI) / 180);
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const lon1 = ring[i]?.[0] ?? 0;
    const lat1 = ring[i]?.[1] ?? 0;
    const lon2 = ring[i + 1]?.[0] ?? 0;
    const lat2 = ring[i + 1]?.[1] ?? 0;
    const x1 = lon1 * mPerDegLon;
    const y1 = lat1 * mPerDegLat;
    const x2 = lon2 * mPerDegLon;
    const y2 = lat2 * mPerDegLat;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2 / M2_PER_SQ_MI;
}

export function validateAoi(
  aoi: GeoJsonFeatureCollection,
  maxAreaSqMi: number,
): { areaSqMi: number; centroid: { latitude: number; longitude: number } } {
  if (aoi.type !== "FeatureCollection" || !Array.isArray(aoi.features) || aoi.features.length === 0) {
    throw new FortyGuardError(
      "REQUEST_INVALID",
      "AOI must be a GeoJSON FeatureCollection with at least one Polygon.",
    );
  }

  let areaSqMi = 0;
  let latSum = 0;
  let lonSum = 0;
  let points = 0;

  for (const feature of aoi.features) {
    if (feature.type !== "Feature" || feature.geometry?.type !== "Polygon") {
      throw new FortyGuardError(
        "REQUEST_INVALID",
        "FortyGuard heatmap AOI geometry must be a closed Polygon.",
      );
    }
    const rings = feature.geometry.coordinates;
    const outer = rings[0];
    if (!outer || outer.length < 4) {
      throw new FortyGuardError("REQUEST_INVALID", "Polygon ring is too short.");
    }
    const first = outer[0];
    const last = outer[outer.length - 1];
    if (!first || !last || !sameCoord(first, last)) {
      throw new FortyGuardError(
        "REQUEST_INVALID",
        "Polygon ring must be closed (first and last coordinates identical).",
      );
    }
    for (const coord of outer) {
      const lon = coord[0];
      const lat = coord[1];
      if (typeof lon !== "number" || typeof lat !== "number") {
        throw new FortyGuardError("REQUEST_INVALID", "Polygon coordinates must be numbers.");
      }
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        throw new FortyGuardError("REQUEST_INVALID", "Coordinates are out of range.");
      }
      if (!pointInUnitedStates(lat, lon)) {
        throw new FortyGuardError(
          "REQUEST_INVALID",
          "FortyGuard current coverage is the United States only.",
        );
      }
      latSum += lat;
      lonSum += lon;
      points += 1;
    }
    areaSqMi += ringAreaSqMi(outer);
  }

  if (areaSqMi > maxAreaSqMi) {
    throw new FortyGuardError(
      "REQUEST_INVALID",
      `AOI area ${areaSqMi.toFixed(2)} mi² exceeds the configured plan limit of ${maxAreaSqMi} mi².`,
    );
  }

  return {
    areaSqMi,
    centroid: {
      latitude: latSum / points,
      longitude: lonSum / points,
    },
  };
}
