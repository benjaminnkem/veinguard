import type { GeoJsonFeatureCollection, ProductAcquisitionRequest } from "./types";

export const NYC_BLOCK: GeoJsonFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-74.017, 40.705],
            [-74.003, 40.705],
            [-74.003, 40.718],
            [-74.017, 40.718],
            [-74.017, 40.705],
          ],
        ],
      },
    },
  ],
};

export function productRequest(
  overrides: Partial<ProductAcquisitionRequest> = {},
): ProductAcquisitionRequest {
  return {
    mode: "HISTORICAL",
    aoi: NYC_BLOCK,
    time: {
      start: "2024-07-15T14:00:00-04:00",
      end: "2024-07-15T15:00:00-04:00",
    },
    granularityMeters: 100,
    analytics: ["TCM"],
    ...overrides,
  };
}
