export const DATA_FRESHNESS = ["LIVE", "FORECAST", "HISTORICAL", "CACHED_REAL"] as const;
export type DataFreshness = (typeof DATA_FRESHNESS)[number];

export const CHEMISTRY_PROFILE_TYPES = [
  "FREE_CHLORINE",
  "MONOCHLORAMINE",
  "CHLORINE_DIOXIDE",
  "ADVANCED_MULTI_SPECIES",
] as const;
export type ChemistryProfileType = (typeof CHEMISTRY_PROFILE_TYPES)[number];

export const CHEMISTRY_PROFILE_STATUSES = ["ACTIVE", "COMING_SOON"] as const;
export type ChemistryProfileStatus = (typeof CHEMISTRY_PROFILE_STATUSES)[number];

export const ACTIVE_CHEMISTRY_PROFILES = ["FREE_CHLORINE", "MONOCHLORAMINE"] as const;
export type ActiveChemistryProfile = (typeof ACTIVE_CHEMISTRY_PROFILES)[number];

export const NETWORK_SOURCE_TYPES = ["EPA_BENCHMARK", "USER_UPLOAD"] as const;
export type NetworkSourceType = (typeof NETWORK_SOURCE_TYPES)[number];

export const GEO_REFERENCE_TYPES = ["REAL_GEOGRAPHIC", "SYNTHETIC_GEOREFERENCING", "NONE"] as const;
export type GeoReferenceType = (typeof GEO_REFERENCE_TYPES)[number];

export const RUN_STATUSES = [
  "PENDING",
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "PARTIAL",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const NETWORK_ASSET_TYPES = [
  "RESERVOIR",
  "TANK",
  "JUNCTION",
  "PUMP",
  "VALVE",
  "PIPE",
] as const;
export type NetworkAssetType = (typeof NETWORK_ASSET_TYPES)[number];

export const INTERVENTION_TYPES = [
  "CHANGE_PUMP_SCHEDULE",
  "CHANGE_PUMP_SETTING",
  "CHANGE_TANK_CONTROL",
  "CHANGE_VALVE_SETTING",
  "FLUSH_EVENT",
  "CHANGE_BOOSTER_PROFILE",
] as const;
export type InterventionType = (typeof INTERVENTION_TYPES)[number];

export const USER_ROLES = ["ADMIN", "OPERATOR", "VIEWER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// BullMQ 5+ rejects ":" in queue names (it is the Redis key separator).
// Namespace Redis keys with QUEUE_PREFIX instead.
export const QUEUE_PREFIX = "veinguard";

export const QUEUE_NAMES = {
  fortyguard: "fortyguard",
  simulation: "simulation",
  agent: "agent",
  resilience: "resilience",
} as const;
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
