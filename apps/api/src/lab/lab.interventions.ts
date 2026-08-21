import { INTERVENTION_TYPES, type InterventionType } from '@repo/contracts';

export function validateInterventions(
  raw: unknown,
):
  | { ok: true; interventions: Record<string, unknown>[] }
  | { ok: false; message: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, message: 'At least one intervention is required.' };
  }
  if (raw.length > 12) {
    return {
      ok: false,
      message: 'At most 12 interventions are allowed per scenario.',
    };
  }
  const interventions: Record<string, unknown>[] = [];
  for (const [index, item] of raw.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, message: `Intervention ${index} must be an object.` };
    }
    const record = item as Record<string, unknown>;
    const type = typeof record.type === 'string' ? record.type : '';
    if (!isInterventionType(type)) {
      return { ok: false, message: `Unsupported intervention type '${type}'.` };
    }
    const error = validateOne(type, record);
    if (error) {
      return { ok: false, message: error };
    }
    interventions.push(record);
  }
  return { ok: true, interventions };
}

function isInterventionType(value: string): value is InterventionType {
  return (INTERVENTION_TYPES as readonly string[]).includes(value);
}

function validateOne(
  type: InterventionType,
  item: Record<string, unknown>,
): string | null {
  if (type === 'CHANGE_PUMP_SCHEDULE') {
    if (!nonEmpty(item.pumpId)) {
      return 'CHANGE_PUMP_SCHEDULE requires pumpId.';
    }
    if (!Array.isArray(item.intervals) || item.intervals.length === 0) {
      return 'CHANGE_PUMP_SCHEDULE requires intervals.';
    }
    return null;
  }
  if (type === 'CHANGE_PUMP_SETTING') {
    if (!nonEmpty(item.pumpId) || !iso(item.start) || !iso(item.end)) {
      return 'CHANGE_PUMP_SETTING requires pumpId, start, and end.';
    }
    if (typeof item.setting !== 'number' || item.setting < 0) {
      return 'Pump setting must be a non-negative number.';
    }
    return null;
  }
  if (type === 'CHANGE_TANK_CONTROL') {
    const op = typeof item.op === 'string' ? item.op : '';
    if (op === 'SET_INITIAL_LEVEL') {
      if (!nonEmpty(item.tankId) || typeof item.levelM !== 'number') {
        return 'SET_INITIAL_LEVEL requires tankId and levelM.';
      }
      return null;
    }
    if (op === 'LEVEL_TRIGGERS_PUMP') {
      if (
        !nonEmpty(item.tankId) ||
        !nonEmpty(item.pumpId) ||
        typeof item.belowLevelM !== 'number' ||
        typeof item.aboveLevelM !== 'number'
      ) {
        return 'LEVEL_TRIGGERS_PUMP requires tankId, pumpId, belowLevelM, and aboveLevelM.';
      }
      return null;
    }
    return 'CHANGE_TANK_CONTROL op must be SET_INITIAL_LEVEL or LEVEL_TRIGGERS_PUMP.';
  }
  if (type === 'CHANGE_VALVE_SETTING') {
    if (!nonEmpty(item.valveId) || !iso(item.start) || !iso(item.end)) {
      return 'CHANGE_VALVE_SETTING requires valveId, start, and end.';
    }
    if (typeof item.setting !== 'number') {
      return 'Valve setting must be a number.';
    }
    return null;
  }
  if (type === 'FLUSH_EVENT') {
    if (!nonEmpty(item.junctionId) || !iso(item.start)) {
      return 'FLUSH_EVENT requires junctionId and start.';
    }
    if (
      typeof item.durationSeconds !== 'number' ||
      item.durationSeconds <= 0 ||
      typeof item.dischargeLps !== 'number' ||
      item.dischargeLps <= 0
    ) {
      return 'Flush duration and discharge must be positive.';
    }
    return null;
  }
  if (type === 'CHANGE_BOOSTER_PROFILE') {
    if (item.mode === 'MASS') {
      return 'MASS booster is not implemented in V1 without a verified flow-to-concentration conversion.';
    }
    if (item.mode !== 'CONCENTRATION') {
      return 'Booster mode must be CONCENTRATION or MASS.';
    }
    if (
      !nonEmpty(item.sourceNodeId) ||
      !iso(item.start) ||
      !iso(item.end) ||
      typeof item.value !== 'number'
    ) {
      return 'CHANGE_BOOSTER_PROFILE requires sourceNodeId, start, end, and value.';
    }
    return null;
  }
  return 'Unsupported intervention type.';
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function iso(value: unknown): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
