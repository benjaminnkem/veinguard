import { compareScenarios } from '@repo/agent';
import { validateInterventions } from './lab.interventions';

describe('lab interventions', () => {
  it('rejects MASS booster without inventing a conversion', () => {
    const result = validateInterventions([
      {
        type: 'CHANGE_BOOSTER_PROFILE',
        sourceNodeId: '101',
        start: '1970-01-01T00:00:00Z',
        end: '1970-01-01T01:00:00Z',
        mode: 'MASS',
        value: 1,
        units: 'mg/s',
      },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/MASS/);
    }
  });

  it('accepts a typed pump setting', () => {
    const result = validateInterventions([
      {
        type: 'CHANGE_PUMP_SETTING',
        pumpId: '10',
        start: '1970-01-01T00:00:00Z',
        end: '1970-01-01T06:00:00Z',
        setting: 1,
      },
    ]);
    expect(result.ok).toBe(true);
  });

  it('ranks feasible scenarios by deterministic objective', () => {
    const ranked = compareScenarios([
      {
        scenarioRunId: 'b',
        feasible: true,
        objective: 20,
        constraints: [],
      },
      {
        scenarioRunId: 'a',
        feasible: true,
        objective: 10,
        constraints: [],
      },
      {
        scenarioRunId: 'c',
        feasible: false,
        objective: null,
        constraints: [{ id: 'pressure.min', severity: 'HARD', passed: false }],
      },
    ]);
    expect(ranked.feasible.map((row) => row.scenarioRunId)).toEqual(['a', 'b']);
    expect(ranked.feasible[0]?.rank).toBe(1);
    expect(ranked.rejected[0]?.hardConstraintViolationIds).toContain(
      'pressure.min',
    );
  });
});
