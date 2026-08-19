import { DEFAULT_RATIONALE_MAX_CHARS, DEFAULT_TOOL_RESULT_MAX_BYTES } from "./docs";
import type {
  CompactBaseline,
  CompactNetwork,
  CompactNetworkLink,
  CompactZone,
  GroqChatMessage,
} from "./types";

export function truncateJson(value: unknown, maxBytes = DEFAULT_TOOL_RESULT_MAX_BYTES): string {
  const raw = JSON.stringify(value);
  if (Buffer.byteLength(raw, "utf8") <= maxBytes) {
    return raw;
  }
  const suffix = ',"truncated":true}';
  const budget = Math.max(32, maxBytes - Buffer.byteLength(suffix, "utf8"));
  let cut = raw.slice(0, budget);
  const lastComma = cut.lastIndexOf(",");
  if (lastComma > 8) {
    cut = cut.slice(0, lastComma);
  }
  if (!cut.endsWith("}")) {
    cut = `${cut}${suffix}`;
  }
  return cut;
}

export function clipRationale(text: string, maxChars = DEFAULT_RATIONALE_MAX_CHARS): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) {
    return cleaned;
  }
  return `${cleaned.slice(0, maxChars - 1).trimEnd()}…`;
}

export function capMessages(messages: GroqChatMessage[], maxBytes: number): GroqChatMessage[] {
  const encoded = () => Buffer.byteLength(JSON.stringify(messages), "utf8");
  if (encoded() <= maxBytes) {
    return messages;
  }
  const pinned = messages.slice(0, 2);
  const rest = messages.slice(2);
  while (rest.length > 2 && encoded() > maxBytes) {
    rest.shift();
  }
  return [...pinned, ...rest];
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string").slice(0, 24);
}

export function compactBaselineFromSummary(
  baselineRunId: string,
  summary: Record<string, unknown>,
): CompactBaseline {
  const hydraulics = (summary.hydraulics ?? {}) as Record<string, unknown>;
  const hydSummary = (hydraulics.summary ?? {}) as Record<string, unknown>;
  const rollup = (summary.summary ?? summary) as Record<string, unknown>;
  const zonesRaw = (summary.zones ?? {}) as Record<string, unknown>;
  const zones: Record<string, CompactZone> = {};
  for (const [zoneId, raw] of Object.entries(zonesRaw)) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const zone = raw as Record<string, unknown>;
    zones[zoneId] = {
      zoneId,
      nodeIds: asStringArray(zone.nodeIds),
      minResidualMgL: asNumber(zone.minResidualMgL),
      maxWaterAgeHours: asNumber(zone.maxWaterAgeHours),
      meanWaterTempC: asNumber(zone.meanWaterTempC),
      meanAirTempC: asNumber(zone.meanAirTempC),
      breachCount: asNumber(zone.breachCount) ?? 0,
    };
  }
  return {
    baselineRunId,
    networkId: typeof summary.networkId === "string" ? summary.networkId : "epa-net3",
    sampleTimeSeconds: asNumber(summary.sampleTimeSeconds) ?? 3600,
    hydraulicsConverged: hydraulics.converged === true,
    minPressureM: asNumber(hydSummary.minPressureM),
    maxPressureM: asNumber(hydSummary.maxPressureM),
    minWaterAgeHours: asNumber(hydSummary.minWaterAgeHours),
    maxWaterAgeHours: asNumber(hydSummary.maxWaterAgeHours),
    meanAssociatedAirTemperatureC: asNumber(summary.meanAssociatedAirTemperatureC),
    operationalTargetMgL: asNumber(summary.operationalTargetMgL),
    minResidualMgL: asNumber(rollup.minimumResidualMgL ?? rollup.minResidualMgL),
    targetBreachCount: asNumber(rollup.targetBreachAssetCount ?? rollup.targetBreachCount) ?? 0,
    targetBreachAssetIds: asStringArray(rollup.targetBreachAssetIds),
    noCoverageAssetCount: asNumber(rollup.noCoverageAssetCount) ?? 0,
    pumps: asStringArray(summary.pumps),
    tanks: asStringArray(summary.tanks),
    junctionsSample: asStringArray(summary.junctionsSample),
    zones,
  };
}

export function compactNetworkFromTopology(payload: Record<string, unknown>): CompactNetwork {
  const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
  const linksRaw = Array.isArray(payload.links) ? payload.links : [];
  const pumps: string[] = [];
  const tanks: string[] = [];
  const valves: string[] = [];
  const junctionsSample: string[] = [];
  for (const node of nodes) {
    if (!node || typeof node !== "object") {
      continue;
    }
    const typed = node as { id?: unknown; type?: unknown; sourceId?: unknown };
    const id = String(typed.sourceId ?? typed.id ?? "");
    if (!id) {
      continue;
    }
    if (typed.type === "PUMP") {
      pumps.push(id);
    } else if (typed.type === "TANK") {
      tanks.push(id);
    } else if (typed.type === "JUNCTION" && junctionsSample.length < 16) {
      junctionsSample.push(id);
    }
  }
  const links = [];
  for (const link of linksRaw) {
    if (!link || typeof link !== "object") {
      continue;
    }
    const typed = link as {
      id?: unknown;
      sourceId?: unknown;
      type?: unknown;
      fromNodeId?: unknown;
      toNodeId?: unknown;
    };
    const type = typed.type;
    if (type !== "PIPE" && type !== "PUMP" && type !== "VALVE") {
      continue;
    }
    const linkType: CompactNetworkLink["type"] = type;
    if (linkType === "PUMP") {
      pumps.push(String(typed.sourceId ?? typed.id ?? ""));
    }
    if (linkType === "VALVE") {
      valves.push(String(typed.sourceId ?? typed.id ?? ""));
    }
    links.push({
      id: String(typed.sourceId ?? typed.id ?? ""),
      type: linkType,
      fromNodeId: String(typed.fromNodeId ?? ""),
      toNodeId: String(typed.toNodeId ?? ""),
    });
  }
  return {
    networkId: typeof payload.networkId === "string" ? payload.networkId : "epa-net3",
    pumps: [...new Set(pumps.filter(Boolean))],
    tanks: [...new Set(tanks.filter(Boolean))],
    valves: [...new Set(valves.filter(Boolean))],
    junctionsSample,
    links,
  };
}
