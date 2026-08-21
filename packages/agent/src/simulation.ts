import { AgentError } from "./errors";
import type { ScenarioResult, SimulationPort } from "./types";

export interface HttpSimulationClientOptions {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class HttpSimulationClient implements SimulationPort {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpSimulationClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async runScenario(input: {
    networkId: string;
    horizonStart: string;
    interventions: unknown[];
    sampleTimeSeconds?: number;
    scenarioRunId?: string;
    airTemperatureC?: number;
    sourceTemperatureC?: number;
  }): Promise<ScenarioResult> {
    const payload = await this.request("/v1/simulations/scenario", {
      networkId: input.networkId,
      horizonStart: input.horizonStart,
      interventions: input.interventions,
      sampleTimeSeconds: input.sampleTimeSeconds ?? 18000,
      scenarioRunId: input.scenarioRunId,
      airTemperatureC: input.airTemperatureC,
      sourceTemperatureC: input.sourceTemperatureC,
    });
    return normalizeScenario(payload, input.scenarioRunId);
  }

  async topology(networkId: string): Promise<Record<string, unknown>> {
    return this.request("/v1/networks/topology", { networkId });
  }

  private async request(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      let parsed: unknown = {};
      if (text.length > 0) {
        try {
          parsed = JSON.parse(text) as unknown;
        } catch (error) {
          throw new AgentError("SIMULATION_FAILED", "Simulation service returned non-JSON.", {
            cause: error,
          });
        }
      }
      if (!response.ok) {
        const message =
          parsed &&
          typeof parsed === "object" &&
          "error" in parsed &&
          parsed.error &&
          typeof parsed.error === "object" &&
          "message" in parsed.error
            ? String((parsed.error as { message?: unknown }).message)
            : `Simulation service returned HTTP ${response.status}.`;
        throw new AgentError("SIMULATION_FAILED", message, { providerStatus: response.status });
      }
      if (parsed && typeof parsed === "object" && "data" in parsed) {
        return (parsed as { data: Record<string, unknown> }).data;
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      if (error instanceof AgentError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new AgentError("TIMEOUT", "Simulation service timed out.", { cause: error });
      }
      throw new AgentError("SIMULATION_FAILED", "Simulation service request failed.", { cause: error });
    } finally {
      clearTimeout(timer);
    }
  }
}

function normalizeScenario(payload: Record<string, unknown>, fallbackId?: string): ScenarioResult {
  const constraintsRaw = Array.isArray(payload.constraints) ? payload.constraints : [];
  return {
    scenarioRunId: String(payload.scenarioRunId ?? fallbackId ?? ""),
    name: typeof payload.name === "string" ? payload.name : undefined,
    feasible: payload.feasible === true,
    objective: typeof payload.objective === "number" ? payload.objective : null,
    constraints: constraintsRaw
      .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
      .map((row) => ({
        id: String(row.id ?? ""),
        severity: typeof row.severity === "string" ? row.severity : undefined,
        passed: row.passed === true,
      })),
    metrics: (payload.metrics as ScenarioResult["metrics"]) ?? undefined,
    hydraulics: (payload.hydraulics as ScenarioResult["hydraulics"]) ?? undefined,
    networkState: (payload.networkState as ScenarioResult["networkState"]) ?? undefined,
  };
}
