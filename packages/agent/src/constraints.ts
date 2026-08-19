import type { InterventionType } from "@repo/contracts";
import type { StructuredConstraints } from "./types";

const KNOWN_TYPES = new Set<InterventionType>([
  "CHANGE_PUMP_SCHEDULE",
  "CHANGE_PUMP_SETTING",
  "CHANGE_TANK_CONTROL",
  "CHANGE_VALVE_SETTING",
  "FLUSH_EVENT",
  "CHANGE_BOOSTER_PROFILE",
]);

const ACTUATION_RE =
  /\b(scada|actuator|actuate|dispatch crew|live (pump|valve|control)|send (a )?command|open the (valve|pump) in the field|real infrastructure|operate the real)\b/i;

const BYPASS_RE =
  /\b(ignore|bypass|override|disable|waive)\b.{0,40}\b(constraint|no[- ]flush|forbidden|rule|limit)\b/i;

export function interventionTypeOf(item: unknown): InterventionType | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const type = (item as { type?: unknown }).type;
  if (typeof type !== "string" || !KNOWN_TYPES.has(type as InterventionType)) {
    return null;
  }
  return type as InterventionType;
}

export function rejectForbiddenInterventions(
  interventions: unknown[],
  constraints: StructuredConstraints,
): { ok: true } | { ok: false; message: string; types: InterventionType[] } {
  const forbidden = new Set(constraints.forbidInterventionTypes ?? []);
  const hits: InterventionType[] = [];
  for (const item of interventions) {
    const type = interventionTypeOf(item);
    if (type && forbidden.has(type)) {
      hits.push(type);
    }
  }
  if (hits.length === 0) {
    return { ok: true };
  }
  return {
    ok: false,
    message: `Structured constraint forbids ${[...new Set(hits)].join(", ")} before simulation.`,
    types: hits,
  };
}

export function detectActuationRequest(goal: string): boolean {
  return ACTUATION_RE.test(goal);
}

export function detectBypassRequest(goal: string): boolean {
  return BYPASS_RE.test(goal);
}

export function normalizeConstraints(raw: unknown): StructuredConstraints {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const input = raw as Record<string, unknown>;
  const forbid = Array.isArray(input.forbidInterventionTypes)
    ? input.forbidInterventionTypes.filter(
        (item): item is InterventionType =>
          typeof item === "string" && KNOWN_TYPES.has(item as InterventionType),
      )
    : undefined;
  const zones = Array.isArray(input.targetZoneIds)
    ? input.targetZoneIds.filter((item): item is string => typeof item === "string" && item.length > 0)
    : undefined;
  return {
    ...(forbid && forbid.length > 0 ? { forbidInterventionTypes: forbid } : {}),
    ...(zones && zones.length > 0 ? { targetZoneIds: zones } : {}),
    ...(typeof input.horizonStart === "string" ? { horizonStart: input.horizonStart } : {}),
    ...(typeof input.horizonEnd === "string" ? { horizonEnd: input.horizonEnd } : {}),
    ...(typeof input.networkId === "string" ? { networkId: input.networkId } : {}),
    ...(typeof input.sampleTimeSeconds === "number"
      ? { sampleTimeSeconds: input.sampleTimeSeconds }
      : {}),
  };
}
