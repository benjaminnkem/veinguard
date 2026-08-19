import type { ComparisonResult, ScenarioResult } from "./types";

export const OBJECTIVE_PROFILE_VERSION = "objective-v1";

export function compareScenarios(results: ScenarioResult[]): ComparisonResult {
  const feasible: ComparisonResult["feasible"] = [];
  const rejected: ComparisonResult["rejected"] = [];
  for (const item of results) {
    if (item.feasible && typeof item.objective === "number") {
      feasible.push({
        scenarioRunId: item.scenarioRunId,
        objective: item.objective,
        rank: 0,
      });
    } else {
      rejected.push({
        scenarioRunId: item.scenarioRunId,
        hardConstraintViolationIds: item.constraints
          .filter((row) => row.severity === "HARD" && !row.passed)
          .map((row) => row.id),
      });
    }
  }
  feasible.sort((a, b) => {
    if (a.objective !== b.objective) {
      return a.objective - b.objective;
    }
    return a.scenarioRunId.localeCompare(b.scenarioRunId);
  });
  feasible.forEach((row, index) => {
    row.rank = index + 1;
  });
  return {
    feasible,
    rejected,
    objectiveProfileVersion: OBJECTIVE_PROFILE_VERSION,
  };
}
