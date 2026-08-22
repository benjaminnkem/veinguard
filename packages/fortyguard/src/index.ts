export { FortyGuardClient } from "./client";
export type { FortyGuardClientOptions } from "./client";
export {
  BASIC_MAX_AOI_SQ_MI,
  CANONICAL_HASH_VERSION,
  ENV_PARAMS_PATH,
  FORTYGUARD_API_HOST,
  FORTYGUARD_PAGES_CONSULTED,
  FORECAST_HORIZON_HOURS,
  HEATMAP_NORMALIZATION_VERSION,
  HEATMAP_PATH,
  HISTORICAL_START,
  PREMIUM_MAX_AOI_SQ_MI,
  STATUS_PATH,
  SUPPORTED_FILTER_TYPES,
  SUPPORTED_GRANULARITY_METERS,
} from "./docs";
export { FortyGuardError, safeProviderMessage } from "./errors";
export { hashHeatmapRequest, canonicalJson } from "./hash";
export { planFortyGuardRequests } from "./planner";
export { pollUntilTerminal } from "./poll";
export { maybeFetchSolar, runAcquisitionSlice, summarizeAcquisition } from "./acquire";
export { MemoryThermalStore, MongoThermalStore, newAcquisitionId } from "./store";
export type { ThermalStore } from "./store";
export { validateAoi, pointInUnitedStates } from "./aoi";
export { classifyFreshness } from "./freshness";
export { NYC_BLOCK } from "./fixtures";
export { normalizeStats } from "./stats";
export type {
  CachedCompleted,
  FortyGuardHeatmapRequest,
  PlanResult,
  PlannedSlice,
  ProductAcquisitionRequest,
  ThermalAcquisition,
  ThermalStats,
} from "./types";
