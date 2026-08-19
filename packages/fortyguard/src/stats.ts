import { asRecord, readNumber } from "./schemas";
import type { FortyGuardAnalyticType, ThermalStats } from "./types";

function unitsFor(analytic: FortyGuardAnalyticType | undefined): string {
  if (!analytic || analytic === "tcm") {
    return "°C";
  }
  return "hour";
}

export function normalizeStats(
  raw: unknown,
  analytic: FortyGuardAnalyticType | undefined,
): ThermalStats {
  const root = asRecord(raw) ?? {};
  const tempStats =
    asRecord(root.Temperature_stats) ??
    asRecord(root.temperature_stats) ??
    asRecord(root.stats) ??
    root;
  const unitsRaw = root.units;
  return {
    min: readNumber(tempStats.Minimum) ?? readNumber(tempStats.minimum) ?? readNumber(tempStats.min),
    max: readNumber(tempStats.Maximum) ?? readNumber(tempStats.maximum) ?? readNumber(tempStats.max),
    mean: readNumber(tempStats.Mean) ?? readNumber(tempStats.mean),
    standardDeviation:
      readNumber(tempStats.Standard_deviation) ??
      readNumber(tempStats.standard_deviation) ??
      readNumber(tempStats.standardDeviation),
    units: typeof unitsRaw === "string" && unitsRaw.length > 0 ? unitsRaw : unitsFor(analytic),
  };
}
