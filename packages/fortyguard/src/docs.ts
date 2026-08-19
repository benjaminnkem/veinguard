/** Official pages consulted for the V1 client (docs SPA bundle 2026-08-19). */
export const FORTYGUARD_PAGES_CONSULTED = [
  "https://docs-api.fortyguard.com/",
  "https://docs-api.fortyguard.com/docs/authentication",
  "https://docs-api.fortyguard.com/docs/quickstart",
  "https://docs-api.fortyguard.com/docs/create-heatmap",
  "https://docs-api.fortyguard.com/docs/environmental-parameters",
  "https://docs-api.fortyguard.com/docs/check-status",
  "https://docs-api.fortyguard.com/docs/limitations",
  "https://docs-api.fortyguard.com/docs/release-notes",
] as const;

export const FORTYGUARD_API_HOST = "https://api.fortyguard.com";
export const HEATMAP_PATH = "/v1/heatmap";
export const STATUS_PATH = "/v1/status";
export const ENV_PARAMS_PATH = "/v1/env_params";

export const CANONICAL_HASH_VERSION = "fortyguard-canonical-v1";
export const HEATMAP_NORMALIZATION_VERSION = "fortyguard-heatmap-v1";

/** Create Heatmap lists filter_type 4; Known Limitations allow 1–3 only. V1 emits 1–3. */
export const SUPPORTED_FILTER_TYPES = [1, 2, 3] as const;

export const SUPPORTED_GRANULARITY_METERS = [60, 80, 100] as const;

export const FORECAST_HORIZON_HOURS = 12;
export const HISTORICAL_START = "2019-01-01";

export const BASIC_MAX_AOI_SQ_MI = 10;
export const PREMIUM_MAX_AOI_SQ_MI = 50;
