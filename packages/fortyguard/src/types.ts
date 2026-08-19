import type { DataFreshness, RunStatus } from "@repo/contracts";

export type FortyGuardFilterType = 1 | 2 | 3;
export type FortyGuardGranularity = 60 | 80 | 100;
export type FortyGuardAnalyticType =
  | "tcm"
  | "time_of_measure"
  | "exceedance"
  | "persistence";
export type FortyGuardDirection = "above" | "below";

export type ProductAnalytic =
  | "TCM"
  | "TIME_OF_MEASURE"
  | "EXCEEDANCE"
  | "PERSISTENCE";

export type ProductMode = "LIVE" | "FORECAST" | "HISTORICAL";

export interface GeoJsonPolygonGeometry {
  type: "Polygon";
  coordinates: number[][][];
}

export interface GeoJsonFeature {
  type: "Feature";
  properties?: Record<string, unknown> | null;
  geometry: GeoJsonPolygonGeometry;
}

export interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

export interface ProductTimeRange {
  start: string;
  end: string;
}

export interface ProductAcquisitionRequest {
  mode: ProductMode;
  aoi: GeoJsonFeatureCollection;
  time: ProductTimeRange;
  granularityMeters: FortyGuardGranularity;
  analytics: ProductAnalytic[];
  thresholdC?: number;
  direction?: FortyGuardDirection;
  includeSolarIrradiance?: boolean;
}

export interface FortyGuardDateTime {
  start_date: string;
  filter_type: FortyGuardFilterType;
  start_time?: string;
  end_time?: string;
  end_date?: string;
}

export interface FortyGuardHeatmapRequest {
  polygon_aoi: GeoJsonFeatureCollection;
  date_time: FortyGuardDateTime;
  granularity: FortyGuardGranularity;
  analytic_type?: FortyGuardAnalyticType;
  threshold?: number;
  direction?: FortyGuardDirection;
}

export interface FortyGuardEnvParamsRequest {
  latitude: number;
  longitude: number;
  temperature: number;
  date_time: FortyGuardDateTime;
  analysis?: string[];
}

export interface PlannedSlice {
  providerRequest: FortyGuardHeatmapRequest;
  requestHash: string;
  freshness: Exclude<DataFreshness, "CACHED_REAL">;
  observationOrForecastTime: string;
}

export interface PlanResult {
  slices: PlannedSlice[];
  centroid: { latitude: number; longitude: number };
  areaSqMi: number;
  includeSolarIrradiance: boolean;
}

export interface ThermalStats {
  min?: number;
  max?: number;
  mean?: number;
  standardDeviation?: number;
  units: string;
}

export interface CachedCompleted {
  requestHash: string;
  endpoint: string;
  providerRequest: FortyGuardHeatmapRequest;
  activityId: string;
  fetchedAt: string;
  observationOrForecastTime: string;
  originalFreshness: Exclude<DataFreshness, "CACHED_REAL">;
  rawResponse: unknown;
  mapGeoJson: GeoJsonFeatureCollection;
  stats: ThermalStats;
  normalizationVersion: string;
}

export interface AcquisitionSliceState {
  requestHash: string;
  providerRequest: FortyGuardHeatmapRequest;
  freshness: Exclude<DataFreshness, "CACHED_REAL">;
  observationOrForecastTime: string;
  activityId?: string;
  snapshot?: CachedCompleted;
  error?: { code: string; message: string };
}

export interface ThermalAcquisition {
  id: string;
  organizationId?: string;
  status: RunStatus;
  mode: ProductMode;
  productRequest: ProductAcquisitionRequest;
  slices: AcquisitionSliceState[];
  includeSolarIrradiance: boolean;
  centroid?: { latitude: number; longitude: number };
  solar?: unknown;
  correlationId: string;
  createdAt: string;
  updatedAt: string;
  error?: { code: string; message: string };
}

export interface FortyGuardSubmitResponse {
  error: boolean;
  status_code: number;
  message: string;
  data: { activity_id: string };
}

export interface FortyGuardStatusResponse {
  error: boolean;
  status_code: number;
  message: string;
  data: {
    activity_id: string;
    status: "Processing" | "Completed" | "Failed";
    result?: {
      map_data: unknown;
      stats_data?: unknown;
    };
  };
}
