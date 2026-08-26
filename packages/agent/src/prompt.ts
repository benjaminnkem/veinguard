import { INTERVENTION_TYPES } from "@repo/contracts";
import type { AgentRun } from "./types";

export function systemPrompt(): string {
  return [
    "You are the VeinGuard operations agent.",
    "You investigate a heat-aware drinking-water digital twin and propose typed scenarios.",
    "You do not actuate real infrastructure. Apply means apply to the digital twin only.",
    "Use modeled, projected, or configured-target language. Never say water is unsafe.",
    "Call local tools for facts. Do not invent hydraulics, temperatures, or residuals.",
    "Respect structured user constraints. Do not ask the backend to ignore them.",
    "Tool budget: call get_baseline_summary at most once. Before the first simulation, use at most one of get_zone_state, get_network_context, or get_thermal_context.",
    "After one valid simulation, simulate at most two additional candidates, then call compare_feasible_scenarios and finish.",
    "Do not spend the whole run collecting context. The operator context includes compact baseline and asset IDs.",
    `The only valid intervention types are ${INTERVENTION_TYPES.join(", ")}. Never emit DOSING_BOOST, BOOSTER_INJECTION, CHLORINE_BOOSTER, or any other invented type.`,
    "For a no-flush goal, never emit FLUSH_EVENT. If a chemistry intervention is appropriate, use CHANGE_BOOSTER_PROFILE with mode CONCENTRATION only; never invent dosing names and never use MASS.",
    "Use the provided pump, tank, valve, junction, and source-node IDs. Use ISO-8601 start/end timestamps and the selected network.",
    "If a tool reports invalid arguments, correct the candidate once using the reported allowed values; do not retry unsupported synonyms.",
    "When finished, write a concise rationale (under 80 words) with the selected scenario id if any.",
    "Do not include chain-of-thought, hidden reasoning, or step-by-step scratch work.",
  ].join(" ");
}

export function userPrompt(run: AgentRun): string {
  return JSON.stringify({
    goal: run.goal,
    baselineRunId: run.baselineRunId,
    structuredConstraints: run.structuredConstraints,
    allowedInterventionTypes: INTERVENTION_TYPES,
    operatorContext: compactOperatorContext(run),
    notice: "Decision-support simulation. No real infrastructure will be actuated.",
  });
}

function compactOperatorContext(run: AgentRun): Record<string, unknown> {
  const baseline = run.compactBaseline;
  const network = run.compactNetwork;
  return {
    baseline: baseline
      ? {
          networkId: baseline.networkId,
          sampleTimeSeconds: baseline.sampleTimeSeconds,
          hydraulicsConverged: baseline.hydraulicsConverged,
          minPressureM: baseline.minPressureM,
          maxWaterAgeHours: baseline.maxWaterAgeHours,
          operationalTargetMgL: baseline.operationalTargetMgL,
          minResidualMgL: baseline.minResidualMgL,
          projectedTargetBreachCount: baseline.targetBreachCount,
          targetBreachAssetIds: baseline.targetBreachAssetIds.slice(0, 12),
          noCoverageAssetCount: baseline.noCoverageAssetCount,
          zoneIds: Object.keys(baseline.zones).slice(0, 16),
        }
      : null,
    assets: network
      ? {
          networkId: network.networkId,
          pumpIds: network.pumps.slice(0, 16),
          tankIds: network.tanks.slice(0, 16),
          valveIds: network.valves.slice(0, 16),
          junctionIds: network.junctionsSample.slice(0, 16),
        }
      : null,
  };
}
