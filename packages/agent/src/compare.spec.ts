import { compareScenarios } from "./compare";

describe("compareScenarios", () => {
  it("ranks feasible scenarios by objective then id", () => {
    const result = compareScenarios([
      {
        scenarioRunId: "b",
        feasible: true,
        objective: 10,
        constraints: [],
      },
      {
        scenarioRunId: "a",
        feasible: true,
        objective: 10,
        constraints: [],
      },
      {
        scenarioRunId: "c",
        feasible: false,
        objective: null,
        constraints: [{ id: "MIN_PRESSURE_M", severity: "HARD", passed: false }],
      },
    ]);
    expect(result.feasible.map((row) => row.scenarioRunId)).toEqual(["a", "b"]);
    expect(result.feasible[0]?.rank).toBe(1);
    expect(result.rejected[0]?.hardConstraintViolationIds).toEqual(["MIN_PRESSURE_M"]);
  });
});
