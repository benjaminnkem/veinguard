import { AGENT_TOOL_NAMES } from "@repo/contracts";
import { z } from "zod";

const interventionType = z.enum([
  "CHANGE_PUMP_SCHEDULE",
  "CHANGE_PUMP_SETTING",
  "CHANGE_TANK_CONTROL",
  "CHANGE_VALVE_SETTING",
  "FLUSH_EVENT",
  "CHANGE_BOOSTER_PROFILE",
]);

export const getZoneStateArgs = z.object({
  baselineRunId: z.string().min(1),
  zoneId: z.string().min(1),
});

export const getNetworkContextArgs = z.object({
  baselineRunId: z.string().min(1),
  zoneId: z.string().min(1),
  direction: z.enum(["UPSTREAM", "DOWNSTREAM"]).default("UPSTREAM"),
  maxDepth: z.number().int().min(1).max(8).default(4),
});

export const getThermalContextArgs = z.object({
  baselineRunId: z.string().min(1),
  zoneId: z.string().min(1),
});

export const getBaselineSummaryArgs = z.object({
  baselineRunId: z.string().min(1),
});

export const simulateScenarioArgs = z.object({
  baselineRunId: z.string().min(1),
  name: z.string().min(1).max(120),
  interventions: z.array(z.record(z.string(), z.unknown())).min(1),
});

export const getScenarioResultArgs = z.object({
  scenarioRunId: z.string().min(1),
});

export const compareFeasibleScenariosArgs = z.object({
  scenarioRunIds: z.array(z.string().min(1)).min(1).optional(),
});

export const toolArgSchemas = {
  get_zone_state: getZoneStateArgs,
  get_network_context: getNetworkContextArgs,
  get_thermal_context: getThermalContextArgs,
  get_baseline_summary: getBaselineSummaryArgs,
  simulate_scenario: simulateScenarioArgs,
  get_scenario_result: getScenarioResultArgs,
  compare_feasible_scenarios: compareFeasibleScenariosArgs,
} as const;

export const GROQ_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_zone_state",
      description:
        "Compact modeled zone flags and numbers for a completed baseline. Not a full node array.",
      parameters: {
        type: "object",
        properties: {
          baselineRunId: { type: "string" },
          zoneId: { type: "string", description: "Zone id, or 'network' for the whole model." },
        },
        required: ["baselineRunId", "zoneId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_network_context",
      description: "Compact upstream or downstream neighborhood around a zone.",
      parameters: {
        type: "object",
        properties: {
          baselineRunId: { type: "string" },
          zoneId: { type: "string" },
          direction: { type: "string", enum: ["UPSTREAM", "DOWNSTREAM"] },
          maxDepth: { type: "integer", minimum: 1, maximum: 8 },
        },
        required: ["baselineRunId", "zoneId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_thermal_context",
      description: "Compact associated air and modeled water-temperature context for a zone.",
      parameters: {
        type: "object",
        properties: {
          baselineRunId: { type: "string" },
          zoneId: { type: "string" },
        },
        required: ["baselineRunId", "zoneId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_baseline_summary",
      description: "Compact baseline hydraulics, residual, and target-breach summary.",
      parameters: {
        type: "object",
        properties: {
          baselineRunId: { type: "string" },
        },
        required: ["baselineRunId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "simulate_scenario",
      description:
        "Run a typed digital-twin scenario. Interventions must match VeinGuard types. User constraints are enforced before simulation.",
      parameters: {
        type: "object",
        properties: {
          baselineRunId: { type: "string" },
          name: { type: "string" },
          interventions: {
            type: "array",
            items: { type: "object" },
            description: "Typed interventions only. FLUSH_EVENT is rejected when forbidden.",
          },
        },
        required: ["baselineRunId", "name", "interventions"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_scenario_result",
      description: "Compact result of a previously simulated scenario.",
      parameters: {
        type: "object",
        properties: {
          scenarioRunId: { type: "string" },
        },
        required: ["scenarioRunId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_feasible_scenarios",
      description:
        "Deterministic ranking of simulated scenarios. Groq cannot override hard-constraint rejections.",
      parameters: {
        type: "object",
        properties: {
          scenarioRunIds: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
  },
] as const;

export function isAgentToolName(name: string): name is (typeof AGENT_TOOL_NAMES)[number] {
  return (AGENT_TOOL_NAMES as readonly string[]).includes(name);
}

export { interventionType };
