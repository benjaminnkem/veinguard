import { AGENT_TOOL_NAMES, INTERVENTION_TYPES } from "@repo/contracts";
import { z } from "zod";

const interventionType = z.enum(INTERVENTION_TYPES);
const isoTimestamp = z.string().min(1);
const nonNegativeNumber = z.number().nonnegative();

const intervention = z.union([
  z.object({
    type: z.literal("CHANGE_PUMP_SCHEDULE"),
    pumpId: z.string().min(1),
    intervals: z
      .array(
        z.object({
          start: isoTimestamp,
          end: isoTimestamp,
          enabled: z.boolean().optional(),
        }),
      )
      .min(1),
  }),
  z.object({
    type: z.literal("CHANGE_PUMP_SETTING"),
    pumpId: z.string().min(1),
    start: isoTimestamp,
    end: isoTimestamp,
    setting: nonNegativeNumber,
  }),
  z.object({
    type: z.literal("CHANGE_TANK_CONTROL"),
    op: z.literal("SET_INITIAL_LEVEL"),
    tankId: z.string().min(1),
    levelM: z.number(),
  }),
  z.object({
    type: z.literal("CHANGE_TANK_CONTROL"),
    op: z.literal("LEVEL_TRIGGERS_PUMP"),
    tankId: z.string().min(1),
    pumpId: z.string().min(1),
    belowLevelM: z.number(),
    aboveLevelM: z.number(),
  }),
  z.object({
    type: z.literal("CHANGE_VALVE_SETTING"),
    valveId: z.string().min(1),
    start: isoTimestamp,
    end: isoTimestamp,
    setting: z.number(),
  }),
  z.object({
    type: z.literal("FLUSH_EVENT"),
    junctionId: z.string().min(1),
    start: isoTimestamp,
    durationSeconds: z.number().int().positive(),
    dischargeLps: z.number().positive(),
  }),
  z.object({
    type: z.literal("CHANGE_BOOSTER_PROFILE"),
    sourceNodeId: z.string().min(1),
    start: isoTimestamp,
    end: isoTimestamp,
    mode: z.literal("CONCENTRATION"),
    value: z.number(),
    units: z.string().min(1).optional(),
  }),
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
  interventions: z.array(intervention).min(1).max(12),
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

export const GEMINI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "get_zone_state",
        description:
          "Compact modeled zone flags and numbers for a completed baseline. Not a full node array.",
        parameters: {
          type: "object",
          properties: {
            baselineRunId: { type: "string" },
            zoneId: {
              type: "string",
              description:
                "A real zone or target asset id. Use get_baseline_summary for whole-network facts.",
            },
          },
          required: ["baselineRunId", "zoneId"],
        },
      },
    ],
  },
  {
    functionDeclarations: [
      {
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
    ],
  },
  {
    functionDeclarations: [
      {
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
    ],
  },
  {
    functionDeclarations: [
      {
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
    ],
  },
  {
    functionDeclarations: [
      {
        name: "simulate_scenario",
        description:
          "Run a typed digital-twin scenario. The only valid intervention type values are CHANGE_PUMP_SCHEDULE, CHANGE_PUMP_SETTING, CHANGE_TANK_CONTROL, CHANGE_VALVE_SETTING, FLUSH_EVENT, and CHANGE_BOOSTER_PROFILE. Do not invent names such as DOSING_BOOST, BOOSTER_INJECTION, or CHLORINE_BOOSTER. User constraints are enforced before simulation.",
        parameters: {
          type: "object",
          properties: {
            baselineRunId: { type: "string" },
            name: { type: "string" },
            interventions: {
              type: "array",
              minItems: 1,
              maxItems: 12,
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: [...INTERVENTION_TYPES] },
                  pumpId: { type: "string" },
                  tankId: { type: "string" },
                  valveId: { type: "string" },
                  junctionId: { type: "string" },
                  sourceNodeId: { type: "string" },
                  start: { type: "string", description: "ISO-8601 timestamp." },
                  end: { type: "string", description: "ISO-8601 timestamp." },
                  setting: { type: "number", minimum: 0 },
                  levelM: { type: "number" },
                  belowLevelM: { type: "number" },
                  aboveLevelM: { type: "number" },
                  durationSeconds: { type: "integer", minimum: 1 },
                  dischargeLps: { type: "number", minimum: 0 },
                  op: {
                    type: "string",
                    enum: ["SET_INITIAL_LEVEL", "LEVEL_TRIGGERS_PUMP"],
                  },
                  mode: { type: "string", enum: ["CONCENTRATION"] },
                  value: { type: "number" },
                  units: { type: "string" },
                  intervals: {
                    type: "array",
                    minItems: 1,
                    items: {
                      type: "object",
                      properties: {
                        start: { type: "string" },
                        end: { type: "string" },
                        enabled: { type: "boolean" },
                      },
                      required: ["start", "end"],
                    },
                  },
                },
                required: ["type"],
              },
              description:
                "Typed interventions only. For a no-flush goal, prefer CHANGE_PUMP_SETTING or CHANGE_PUMP_SCHEDULE. FLUSH_EVENT is rejected when forbidden. CHANGE_BOOSTER_PROFILE supports CONCENTRATION only.",
            },
          },
          required: ["baselineRunId", "name", "interventions"],
        },
      },
    ],
  },
  {
    functionDeclarations: [
      {
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
    ],
  },
  {
    functionDeclarations: [
      {
        name: "compare_feasible_scenarios",
        description:
          "Deterministic ranking of simulated scenarios. Gemini cannot override hard-constraint rejections.",
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
    ],
  },
] as const;

export function isAgentToolName(name: string): name is (typeof AGENT_TOOL_NAMES)[number] {
  return (AGENT_TOOL_NAMES as readonly string[]).includes(name);
}

export { interventionType };
