import type { TwinColorBy, TwinNode } from "@/lib/operations";

export const UNKNOWN_FILL = "#94a3b8";
export const UNKNOWN_STROKE = "#64748b";
export const BREACH_STROKE = "#b42318";

const TYPE_FILL: Record<string, string> = {
  JUNCTION: "#cbd5e1",
  RESERVOIR: "#0284c7",
  TANK: "#1d4ed8",
  PUMP: "#7c3aed",
  VALVE: "#0f766e",
};

export function nodeColors(
  node: TwinNode,
  colorBy: TwinColorBy,
  range: { min: number; max: number } | null,
  target: number | null,
): { fill: string; stroke: string } {
  const stroke = node.projectedTargetBreach ? BREACH_STROKE : "#0f172a";
  if (colorBy === "target") {
    if (node.residualMgL == null && node.type !== "JUNCTION") {
      return { fill: TYPE_FILL[node.type] ?? UNKNOWN_FILL, stroke };
    }
    if (node.residualMgL == null) {
      return { fill: UNKNOWN_FILL, stroke: UNKNOWN_STROKE };
    }
    return {
      fill: node.projectedTargetBreach ? "#b42318" : "#64748b",
      stroke,
    };
  }
  const value = metricValue(node, colorBy);
  if (value == null) {
    return {
      fill: TYPE_FILL[node.type] ?? UNKNOWN_FILL,
      stroke: node.type === "JUNCTION" ? UNKNOWN_STROKE : stroke,
    };
  }
  const t = normalize(value, range, colorBy === "residual" ? target : null);
  return { fill: sequentialFill(colorBy, t), stroke };
}

export function metricValue(node: TwinNode, colorBy: TwinColorBy): number | null {
  if (colorBy === "residual" || colorBy === "target") {
    return node.residualMgL;
  }
  if (colorBy === "pressure") {
    return node.pressureM;
  }
  if (colorBy === "water-age") {
    return node.waterAgeHours;
  }
  return node.modeledWaterTemperatureC;
}

export function metricRange(
  nodes: TwinNode[],
  colorBy: TwinColorBy,
): { min: number; max: number } | null {
  const values = nodes
    .map((node) => metricValue(node, colorBy))
    .filter((value): value is number => value != null);
  if (values.length === 0) {
    return null;
  }
  return { min: Math.min(...values), max: Math.max(...values) };
}

function normalize(
  value: number,
  range: { min: number; max: number } | null,
  target: number | null,
): number {
  if (target != null && target > 0 && range) {
    return clamp(value / Math.max(range.max, target, 1e-6));
  }
  if (!range || range.max === range.min) {
    return 0.5;
  }
  return clamp((value - range.min) / (range.max - range.min));
}

function sequentialFill(colorBy: TwinColorBy, t: number): string {
  if (colorBy === "residual") {
    return lerp("#c2410c", "#1e3a8a", t);
  }
  if (colorBy === "water-temperature" || colorBy === "water-age") {
    return lerp("#fef3c7", "#c2410c", t);
  }
  return lerp("#e2e8f0", "#0f766e", t);
}

function lerp(a: string, b: string, t: number): string {
  const pa = hex(a);
  const pb = hex(b);
  const u = clamp(t);
  const ch = (i: number) => Math.round(pa[i] + (pb[i] - pa[i]) * u);
  return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
}

function hex(value: string): [number, number, number] {
  const raw = value.replace("#", "");
  return [
    Number.parseInt(raw.slice(0, 2), 16),
    Number.parseInt(raw.slice(2, 4), 16),
    Number.parseInt(raw.slice(4, 6), 16),
  ];
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
