import { createHash } from "node:crypto";
import { CANONICAL_HASH_VERSION, HEATMAP_PATH } from "./docs";
import type { FortyGuardHeatmapRequest } from "./types";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const sorted: Record<string, unknown> = {};
    for (const [key, item] of entries) {
      sorted[key] = sortValue(item);
    }
    return sorted;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value.toFixed(7));
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function hashHeatmapRequest(request: FortyGuardHeatmapRequest): string {
  const payload = {
    endpoint: HEATMAP_PATH,
    hashVersion: CANONICAL_HASH_VERSION,
    request,
  };
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}
