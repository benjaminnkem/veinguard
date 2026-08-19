import { validateAoi } from "./aoi";
import { BASIC_MAX_AOI_SQ_MI, FORECAST_HORIZON_HOURS, HISTORICAL_START } from "./docs";
import { FortyGuardError } from "./errors";
import { assertModeMatchesFreshness, classifyFreshness } from "./freshness";
import { hashHeatmapRequest } from "./hash";
import type {
  FortyGuardAnalyticType,
  FortyGuardDateTime,
  FortyGuardGranularity,
  FortyGuardHeatmapRequest,
  PlanResult,
  PlannedSlice,
  ProductAcquisitionRequest,
  ProductAnalytic,
} from "./types";

const ANALYTIC_MAP: Record<ProductAnalytic, FortyGuardAnalyticType> = {
  TCM: "tcm",
  TIME_OF_MEASURE: "time_of_measure",
  EXCEEDANCE: "exceedance",
  PERSISTENCE: "persistence",
};

const GRANULARITY = new Set<FortyGuardGranularity>([60, 80, 100]);

interface ClockParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  offset: string;
  instant: Date;
}

function parseIso(value: string, label: string): ClockParts {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/,
  );
  if (!match) {
    throw new FortyGuardError(
      "REQUEST_INVALID",
      `${label} must be an ISO-8601 timestamp with offset, on a whole minute.`,
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const offset = match[6] === "Z" ? "+00:00" : (match[6] ?? "+00:00");
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw new FortyGuardError("REQUEST_INVALID", `${label} is not a valid timestamp.`);
  }
  return { year, month, day, hour, minute, offset, instant };
}

function ymd(parts: { year: number; month: number; day: number }): string {
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function hhmm(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function addHour(parts: ClockParts): ClockParts {
  const next = new Date(parts.instant.getTime() + 3600 * 1000);
  return parseIso(toOffsetIso(next, parts.offset), "hour");
}

function toOffsetIso(date: Date, offset: string): string {
  if (offset === "Z" || offset === "+00:00") {
    return date.toISOString().replace(/\.\d{3}Z$/, "+00:00");
  }
  const sign = offset.startsWith("-") ? -1 : 1;
  const [h, m] = offset.slice(1).split(":").map(Number);
  const shiftMin = sign * ((h ?? 0) * 60 + (m ?? 0));
  const local = new Date(date.getTime() + shiftMin * 60_000);
  const iso = local.toISOString().slice(0, 16);
  return `${iso}:00${offset}`;
}

function enumerateHours(start: ClockParts, end: ClockParts): ClockParts[] {
  if (start.instant.getTime() >= end.instant.getTime()) {
    throw new FortyGuardError("REQUEST_INVALID", "time.end must be after time.start.");
  }
  if (start.minute !== 0 || end.minute !== 0) {
    throw new FortyGuardError("REQUEST_INVALID", "Acquisition times must fall on whole hours.");
  }
  const hours: ClockParts[] = [];
  let cursor = start;
  while (cursor.instant.getTime() < end.instant.getTime()) {
    hours.push(cursor);
    cursor = addHour(cursor);
    if (hours.length > 24 * 31) {
      throw new FortyGuardError("REQUEST_INVALID", "Requested horizon is too long.");
    }
  }
  return hours;
}

function packDay(hours: ClockParts[]): FortyGuardDateTime[] {
  const date = ymd(hours[0] ?? { year: 0, month: 0, day: 0 });
  const hourValues = hours.map((h) => h.hour);
  const unique = [...new Set(hourValues)].sort((a, b) => a - b);
  if (unique.length === 24 && unique[0] === 0 && unique[23] === 23) {
    return [{ start_date: date, filter_type: 3 }];
  }
  const windows: FortyGuardDateTime[] = [];
  let i = 0;
  while (i < unique.length) {
    let j = i;
    while (j + 1 < unique.length && (unique[j + 1] ?? 0) === (unique[j] ?? 0) + 1) {
      j += 1;
    }
    const first = unique[i] ?? 0;
    const last = unique[j] ?? 0;
    if (first === last) {
      windows.push({ start_date: date, filter_type: 1, start_time: hhmm(first) });
    } else if (last === 23) {
      if (first < 23) {
        windows.push({
          start_date: date,
          filter_type: 2,
          start_time: hhmm(first),
          end_time: "23:00",
        });
      }
      windows.push({ start_date: date, filter_type: 1, start_time: "23:00" });
    } else {
      windows.push({
        start_date: date,
        filter_type: 2,
        start_time: hhmm(first),
        end_time: hhmm(last + 1),
      });
    }
    i = j + 1;
  }
  return windows;
}

function mapAnalytics(
  analytics: ProductAnalytic[],
): Pick<FortyGuardHeatmapRequest, "analytic_type" | "threshold" | "direction"> {
  const unique = [...new Set(analytics.length > 0 ? analytics : (["TCM"] as ProductAnalytic[]))];
  if (unique.length !== 1) {
    throw new FortyGuardError(
      "REQUEST_INVALID",
      "V1 heatmap requests support exactly one analytic type.",
    );
  }
  const analytic = ANALYTIC_MAP[unique[0] ?? "TCM"];
  return { analytic_type: analytic };
}

export function planFortyGuardRequests(
  product: ProductAcquisitionRequest,
  options?: { now?: Date; maxAoiSqMi?: number },
): PlanResult {
  const now = options?.now ?? new Date();
  const maxAoiSqMi = options?.maxAoiSqMi ?? BASIC_MAX_AOI_SQ_MI;
  if (!GRANULARITY.has(product.granularityMeters)) {
    throw new FortyGuardError("REQUEST_INVALID", "granularityMeters must be 60, 80, or 100.");
  }

  const aoi = validateAoi(product.aoi, maxAoiSqMi);
  const start = parseIso(product.time.start, "time.start");
  const end = parseIso(product.time.end, "time.end");
  if (start.offset !== end.offset) {
    throw new FortyGuardError("REQUEST_INVALID", "Start and end must share the same UTC offset.");
  }

  const earliest = new Date(`${HISTORICAL_START}T00:00:00${start.offset}`);
  const latest = new Date(now.getTime() + FORECAST_HORIZON_HOURS * 3600 * 1000);
  if (start.instant < earliest || end.instant > latest) {
    throw new FortyGuardError(
      "REQUEST_INVALID",
      `Times must fall between ${HISTORICAL_START} and now + ${FORECAST_HORIZON_HOURS}h.`,
    );
  }

  const hours = enumerateHours(start, end);
  const byDay = new Map<string, ClockParts[]>();
  for (const hour of hours) {
    const key = ymd(hour);
    const list = byDay.get(key) ?? [];
    list.push(hour);
    byDay.set(key, list);
  }

  const analytic = mapAnalytics(product.analytics);
  if (
    (analytic.analytic_type === "exceedance" || analytic.analytic_type === "persistence") &&
    product.thresholdC === undefined
  ) {
    throw new FortyGuardError(
      "REQUEST_INVALID",
      "exceedance and persistence require thresholdC.",
    );
  }

  const slices: PlannedSlice[] = [];
  for (const dayHours of byDay.values()) {
    for (const dateTime of packDay(dayHours)) {
      const observation = dayHours[0]?.instant ?? start.instant;
      const freshness = classifyFreshness(observation, now);
      assertModeMatchesFreshness(product.mode, freshness);
      const providerRequest: FortyGuardHeatmapRequest = {
        polygon_aoi: product.aoi,
        date_time: dateTime,
        granularity: product.granularityMeters,
        ...analytic,
      };
      if (analytic.analytic_type === "exceedance" || analytic.analytic_type === "persistence") {
        providerRequest.threshold = product.thresholdC ?? 30;
        providerRequest.direction = product.direction ?? "above";
      }
      slices.push({
        providerRequest,
        requestHash: hashHeatmapRequest(providerRequest),
        freshness,
        observationOrForecastTime: observation.toISOString(),
      });
    }
  }

  if (slices.length === 0) {
    throw new FortyGuardError("REQUEST_INVALID", "Planner produced no provider requests.");
  }

  return {
    slices,
    centroid: aoi.centroid,
    areaSqMi: aoi.areaSqMi,
    includeSolarIrradiance: Boolean(product.includeSolarIrradiance),
  };
}
