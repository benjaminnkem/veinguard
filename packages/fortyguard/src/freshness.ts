import type { DataFreshness } from "@repo/contracts";
import { FORECAST_HORIZON_HOURS } from "./docs";
import { FortyGuardError } from "./errors";
import type { ProductMode } from "./types";

export function classifyFreshness(
  observation: Date,
  now: Date,
): Exclude<DataFreshness, "CACHED_REAL"> {
  const deltaMs = observation.getTime() - now.getTime();
  if (deltaMs > 30 * 60 * 1000) {
    return "FORECAST";
  }
  if (deltaMs < -90 * 60 * 1000) {
    return "HISTORICAL";
  }
  return "LIVE";
}

export function assertModeMatchesFreshness(
  mode: ProductMode,
  freshness: Exclude<DataFreshness, "CACHED_REAL">,
): void {
  if (mode === "FORECAST" && freshness !== "FORECAST") {
    throw new FortyGuardError(
      "REQUEST_INVALID",
      "FORECAST requests must fall in the future forecast window.",
    );
  }
  if (mode === "HISTORICAL" && freshness === "FORECAST") {
    throw new FortyGuardError(
      "REQUEST_INVALID",
      "HISTORICAL requests cannot include forecast times.",
    );
  }
  if (mode === "LIVE" && freshness !== "LIVE") {
    throw new FortyGuardError(
      "REQUEST_INVALID",
      "LIVE requests must target the current observation hour.",
    );
  }
}

export function forecastDeadline(now: Date): Date {
  return new Date(now.getTime() + FORECAST_HORIZON_HOURS * 3600 * 1000);
}
