import { randomUUID } from "node:crypto";
import { compareScenarios } from "./compare";
import { rejectForbiddenInterventions } from "./constraints";
import { hashValue } from "./hash";
import { isAgentToolName, toolArgSchemas } from "./tools";
import type {
  AgentRun,
  CompactBaseline,
  CompactNetwork,
  CompactZone,
  ComparisonResult,
  ScenarioResult,
  SimulationPort,
} from "./types";

export interface ToolExecution {
  ok: boolean;
  toolName: string;
  validatedArgs: unknown;
  argsHash: string;
  result: Record<string, unknown>;
  displayMessage: string;
  scenarioRunId?: string;
  eventType?: "SCENARIO_CREATED" | "SCENARIO_REJECTED" | "COMPARISON_COMPLETED";
}

export class ToolSession {
  simulationsUsed = 0;
  readonly scenarios = new Map<string, ScenarioResult>();
  lastComparison: ComparisonResult | null = null;

  constructor(
    private readonly run: AgentRun,
    private readonly simulation: SimulationPort,
    private readonly limits: { maxSimulations: number },
  ) {}

  async execute(name: string, rawArguments: string): Promise<ToolExecution> {
    if (!isAgentToolName(name)) {
      return fail(name, {}, `Unknown tool '${name}'.`);
    }
    let parsed: unknown;
    try {
      parsed = rawArguments.trim().length === 0 ? {} : JSON.parse(rawArguments);
    } catch {
      return fail(name, {}, "Tool arguments were not valid JSON.");
    }
    const parsedArgs = parseToolArgs(name, parsed);
    if (!parsedArgs.ok) {
      return fail(name, parsed, "Tool arguments failed schema validation.");
    }
    switch (parsedArgs.name) {
      case "get_zone_state":
        return ok(
          parsedArgs.name,
          parsedArgs.args,
          this.zoneState(parsedArgs.args.zoneId),
          `Inspected zone ${parsedArgs.args.zoneId}.`,
        );
      case "get_network_context":
        return ok(
          parsedArgs.name,
          parsedArgs.args,
          this.networkContext(
            parsedArgs.args.zoneId,
            parsedArgs.args.direction,
            parsedArgs.args.maxDepth,
          ),
          `Loaded ${parsedArgs.args.direction.toLowerCase()} network context.`,
        );
      case "get_thermal_context":
        return ok(
          parsedArgs.name,
          parsedArgs.args,
          this.thermalContext(parsedArgs.args.zoneId),
          `Loaded thermal context for ${parsedArgs.args.zoneId}.`,
        );
      case "get_baseline_summary":
        return ok(parsedArgs.name, parsedArgs.args, this.baselineSummary(), "Loaded compact baseline summary.");
      case "simulate_scenario":
        return this.simulate(parsedArgs.args);
      case "get_scenario_result":
        return this.scenarioResult(parsedArgs.args.scenarioRunId);
      case "compare_feasible_scenarios":
        return this.compare(parsedArgs.args.scenarioRunIds);
    }
  }

  private baseline(): CompactBaseline | null {
    return this.run.compactBaseline;
  }

  private zone(zoneId: string): CompactZone | null {
    const baseline = this.baseline();
    if (!baseline) {
      return null;
    }
    if (baseline.zones[zoneId]) {
      return baseline.zones[zoneId] ?? null;
    }
    if (zoneId === "network") {
      return {
        zoneId: "network",
        nodeIds: baseline.junctionsSample,
        minResidualMgL: baseline.minResidualMgL,
        maxWaterAgeHours: baseline.maxWaterAgeHours,
        meanWaterTempC: null,
        meanAirTempC: baseline.meanAssociatedAirTemperatureC,
        breachCount: baseline.targetBreachCount,
      };
    }
    return null;
  }

  private zoneState(zoneId: string): Record<string, unknown> {
    const zone = this.zone(zoneId);
    if (!zone) {
      return { error: { code: "VALIDATION_FAILED", message: `Unknown zone '${zoneId}'.` } };
    }
    return {
      zoneId: zone.zoneId,
      nodeCount: zone.nodeIds.length,
      minResidualMgL: zone.minResidualMgL,
      maxWaterAgeHours: zone.maxWaterAgeHours,
      meanWaterTempC: zone.meanWaterTempC,
      meanAirTempC: zone.meanAirTempC,
      projectedTargetBreachCount: zone.breachCount,
      language: "modeled/projected",
    };
  }

  private thermalContext(zoneId: string): Record<string, unknown> {
    const zone = this.zone(zoneId);
    const baseline = this.baseline();
    if (!zone || !baseline) {
      return { error: { code: "VALIDATION_FAILED", message: "Baseline thermal context is not available." } };
    }
    return {
      zoneId: zone.zoneId,
      meanAssociatedAirTemperatureC: zone.meanAirTempC ?? baseline.meanAssociatedAirTemperatureC,
      meanModeledWaterTemperatureC: zone.meanWaterTempC,
      noCoverageAssetCount: baseline.noCoverageAssetCount,
      uncoveredMeansNoInventedTemperature: true,
    };
  }

  private baselineSummary(): Record<string, unknown> {
    const baseline = this.baseline();
    if (!baseline) {
      return { error: { code: "VALIDATION_FAILED", message: "Baseline summary is not available." } };
    }
    return {
      baselineRunId: baseline.baselineRunId,
      networkId: baseline.networkId,
      hydraulicsConverged: baseline.hydraulicsConverged,
      minPressureM: baseline.minPressureM,
      maxWaterAgeHours: baseline.maxWaterAgeHours,
      operationalTargetMgL: baseline.operationalTargetMgL,
      minResidualMgL: baseline.minResidualMgL,
      projectedTargetBreachCount: baseline.targetBreachCount,
      targetBreachAssetIds: baseline.targetBreachAssetIds.slice(0, 12),
      noCoverageAssetCount: baseline.noCoverageAssetCount,
      pumps: baseline.pumps,
      tanks: baseline.tanks,
    };
  }

  private networkContext(
    zoneId: string,
    direction: "UPSTREAM" | "DOWNSTREAM",
    maxDepth: number,
  ): Record<string, unknown> {
    const network = this.run.compactNetwork;
    const zone = this.zone(zoneId);
    if (!network) {
      return { error: { code: "VALIDATION_FAILED", message: "Network context is not available." } };
    }
    const seeds = new Set(zone?.nodeIds ?? []);
    const visited = walk(network, seeds, direction, maxDepth);
    return {
      zoneId,
      direction,
      maxDepth,
      pumps: network.pumps.filter((id) => visited.has(id) || seeds.size === 0).slice(0, 8),
      tanks: network.tanks.filter((id) => visited.has(id) || seeds.size === 0).slice(0, 8),
      valves: network.valves.slice(0, 8),
      neighborNodeIds: [...visited].slice(0, 16),
    };
  }

  private async simulate(args: {
    baselineRunId: string;
    name: string;
    interventions: Record<string, unknown>[];
  }): Promise<ToolExecution> {
    if (this.simulationsUsed >= this.limits.maxSimulations) {
      return fail(
        "simulate_scenario",
        args,
        "Agent simulation budget reached.",
        "AGENT_LIMIT_REACHED",
      );
    }
    const forbidden = rejectForbiddenInterventions(args.interventions, this.run.structuredConstraints);
    if (!forbidden.ok) {
      return {
        ...fail("simulate_scenario", args, forbidden.message, "SCENARIO_INVALID_INTERVENTION"),
        eventType: "SCENARIO_REJECTED",
      };
    }
    this.simulationsUsed += 1;
    const scenarioRunId = randomUUID();
    try {
      const result = await this.simulation.runScenario({
        networkId: this.run.structuredConstraints.networkId ?? this.baseline()?.networkId ?? "epa-net3",
        horizonStart: this.run.structuredConstraints.horizonStart ?? "1970-01-01T00:00:00+00:00",
        interventions: args.interventions,
        sampleTimeSeconds: this.run.structuredConstraints.sampleTimeSeconds,
        scenarioRunId,
      });
      result.name = args.name;
      this.scenarios.set(result.scenarioRunId, result);
      const summary = compactScenario(result);
      if (!result.feasible) {
        return {
          ok: true,
          toolName: "simulate_scenario",
          validatedArgs: args,
          argsHash: hashValue(args),
          result: summary,
          displayMessage: `Scenario ${result.scenarioRunId} rejected by hard constraints.`,
          scenarioRunId: result.scenarioRunId,
          eventType: "SCENARIO_REJECTED",
        };
      }
      return {
        ok: true,
        toolName: "simulate_scenario",
        validatedArgs: args,
        argsHash: hashValue(args),
        result: summary,
        displayMessage: `Simulated scenario ${args.name}.`,
        scenarioRunId: result.scenarioRunId,
        eventType: "SCENARIO_CREATED",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Simulation failed.";
      return fail("simulate_scenario", args, message, "SIMULATION_CONVERGENCE_FAILED");
    }
  }

  private scenarioResult(scenarioRunId: string): ToolExecution {
    const found = this.scenarios.get(scenarioRunId);
    if (!found) {
      return fail("get_scenario_result", { scenarioRunId }, "Unknown scenarioRunId.");
    }
    return ok("get_scenario_result", { scenarioRunId }, compactScenario(found), "Loaded scenario result.");
  }

  private compare(scenarioRunIds?: string[]): ToolExecution {
    const selected = scenarioRunIds
      ? scenarioRunIds
          .map((id) => this.scenarios.get(id))
          .filter((item): item is ScenarioResult => item !== undefined)
      : [...this.scenarios.values()];
    const comparison = compareScenarios(selected);
    this.lastComparison = comparison;
    return {
      ok: true,
      toolName: "compare_feasible_scenarios",
      validatedArgs: { scenarioRunIds: scenarioRunIds ?? [...this.scenarios.keys()] },
      argsHash: hashValue(scenarioRunIds ?? [...this.scenarios.keys()]),
      result: comparison as unknown as Record<string, unknown>,
      displayMessage: `Compared ${selected.length} scenario(s).`,
      eventType: "COMPARISON_COMPLETED",
    };
  }
}

function walk(
  network: CompactNetwork,
  seeds: Set<string>,
  direction: "UPSTREAM" | "DOWNSTREAM",
  maxDepth: number,
): Set<string> {
  const visited = new Set<string>(seeds);
  let frontier = [...seeds];
  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth += 1) {
    const next: string[] = [];
    for (const nodeId of frontier) {
      for (const link of network.links) {
        const from = direction === "UPSTREAM" ? link.toNodeId : link.fromNodeId;
        const to = direction === "UPSTREAM" ? link.fromNodeId : link.toNodeId;
        if (from === nodeId && !visited.has(to)) {
          visited.add(to);
          next.push(to);
        }
      }
    }
    frontier = next;
  }
  return visited;
}

function compactScenario(result: ScenarioResult): Record<string, unknown> {
  return {
    scenarioRunId: result.scenarioRunId,
    name: result.name,
    feasible: result.feasible,
    objective: result.objective,
    metrics: result.metrics ?? {},
    hardConstraintViolationIds: result.constraints
      .filter((row) => row.severity === "HARD" && !row.passed)
      .map((row) => row.id),
    hydraulicsConverged: result.hydraulics?.converged ?? null,
  };
}

function ok(
  toolName: string,
  args: unknown,
  result: Record<string, unknown>,
  displayMessage: string,
): ToolExecution {
  return {
    ok: true,
    toolName,
    validatedArgs: args,
    argsHash: hashValue(args),
    result,
    displayMessage,
  };
}

type ParsedToolArgs =
  | { ok: true; name: "get_zone_state"; args: { baselineRunId: string; zoneId: string } }
  | {
      ok: true;
      name: "get_network_context";
      args: {
        baselineRunId: string;
        zoneId: string;
        direction: "UPSTREAM" | "DOWNSTREAM";
        maxDepth: number;
      };
    }
  | { ok: true; name: "get_thermal_context"; args: { baselineRunId: string; zoneId: string } }
  | { ok: true; name: "get_baseline_summary"; args: { baselineRunId: string } }
  | {
      ok: true;
      name: "simulate_scenario";
      args: { baselineRunId: string; name: string; interventions: Record<string, unknown>[] };
    }
  | { ok: true; name: "get_scenario_result"; args: { scenarioRunId: string } }
  | { ok: true; name: "compare_feasible_scenarios"; args: { scenarioRunIds?: string[] } }
  | { ok: false };

function parseToolArgs(name: keyof typeof toolArgSchemas, parsed: unknown): ParsedToolArgs {
  const checked = toolArgSchemas[name].safeParse(parsed);
  if (!checked.success) {
    return { ok: false };
  }
  return { ok: true, name, args: checked.data } as ParsedToolArgs;
}

function fail(
  toolName: string,
  args: unknown,
  message: string,
  code = "VALIDATION_FAILED",
): ToolExecution {
  return {
    ok: false,
    toolName,
    validatedArgs: args,
    argsHash: hashValue(args),
    result: { error: { code, message } },
    displayMessage: message,
  };
}


