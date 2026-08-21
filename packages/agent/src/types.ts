import type {
  AgentEventType,
  AgentOutcome,
  AgentToolName,
  InterventionType,
  RunStatus,
} from "@repo/contracts";

export interface StructuredConstraints {
  forbidInterventionTypes?: InterventionType[];
  targetZoneIds?: string[];
  horizonStart?: string;
  horizonEnd?: string;
  networkId?: string;
  sampleTimeSeconds?: number;
}

export interface CompactZone {
  zoneId: string;
  nodeIds: string[];
  minResidualMgL: number | null;
  maxWaterAgeHours: number | null;
  meanWaterTempC: number | null;
  meanAirTempC: number | null;
  breachCount: number;
}

export interface CompactBaseline {
  baselineRunId: string;
  networkId: string;
  sampleTimeSeconds: number;
  hydraulicsConverged: boolean;
  minPressureM: number | null;
  maxPressureM: number | null;
  minWaterAgeHours: number | null;
  maxWaterAgeHours: number | null;
  meanAssociatedAirTemperatureC: number | null;
  operationalTargetMgL: number | null;
  minResidualMgL: number | null;
  targetBreachCount: number;
  targetBreachAssetIds: string[];
  noCoverageAssetCount: number;
  pumps: string[];
  tanks: string[];
  junctionsSample: string[];
  zones: Record<string, CompactZone>;
}

export interface CompactNetworkLink {
  id: string;
  type: "PIPE" | "PUMP" | "VALVE";
  fromNodeId: string;
  toNodeId: string;
}

export interface CompactNetwork {
  networkId: string;
  pumps: string[];
  tanks: string[];
  valves: string[];
  junctionsSample: string[];
  links: CompactNetworkLink[];
}

export interface ScenarioResult {
  scenarioRunId: string;
  name?: string;
  feasible: boolean;
  objective: number | null;
  constraints: Array<{
    id: string;
    severity?: string;
    passed: boolean;
  }>;
  metrics?: {
    flushWaterLiters?: number;
    chemicalIncrementMg?: number;
    energyDeltaKwh?: number | null;
    switchingComplexity?: number;
    targetBreachCount?: number;
    residualDeficitIntegral?: number;
  };
  hydraulics?: {
    converged: boolean;
    summary?: Record<string, number | null | undefined>;
  };
  networkState?: {
    nodes: Array<{
      id: string;
      sourceId?: string;
      type?: string;
      pressureM?: number | null;
      waterAgeHours?: number | null;
      residualMgL?: number | null;
      projectedTargetBreach?: boolean;
    }>;
    links?: Array<{
      id: string;
      sourceId?: string;
      type?: string;
      flowM3s?: number | null;
      velocityMs?: number | null;
    }>;
    operationalTargetMgL?: number;
  };
}

export interface ComparisonResult {
  feasible: Array<{ scenarioRunId: string; objective: number; rank: number }>;
  rejected: Array<{
    scenarioRunId: string;
    hardConstraintViolationIds: string[];
  }>;
  objectiveProfileVersion: string;
}

export interface AgentEvent {
  id?: string;
  agentRunId: string;
  organizationId: string;
  sequence: number;
  type: AgentEventType;
  timestamp: string;
  displayMessage: string;
  toolName?: string | null;
  scenarioRunId?: string | null;
  argsHash?: string | null;
  resultSummary?: Record<string, unknown> | null;
}

export interface AgentRun {
  id: string;
  organizationId: string;
  status: RunStatus;
  outcome: AgentOutcome | null;
  goal: string;
  structuredConstraints: StructuredConstraints;
  baselineRunId: string;
  modelId: string;
  compactBaseline: CompactBaseline | null;
  compactNetwork: CompactNetwork | null;
  selectedScenarioRunId: string | null;
  rationale: string | null;
  scenarioRunIds: string[];
  correlationId: string;
  jobId: string | null;
  error: { code: string | null; message: string | null };
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface AgentLimits {
  maxSteps: number;
  maxSimulations: number;
  timeoutMs: number;
  contextMaxBytes: number;
}

export interface GroqToolCall {
  id: string;
  name: AgentToolName | string;
  arguments: string;
}

export interface GroqChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

export interface GroqChatRequest {
  model: string;
  messages: GroqChatMessage[];
  tools: unknown[];
  tool_choice?: "auto" | "none" | "required";
  temperature?: number;
  max_completion_tokens?: number;
}

export interface GroqChatResult {
  content: string | null;
  toolCalls: GroqToolCall[];
}

export interface GroqClient {
  chat(request: GroqChatRequest): Promise<GroqChatResult>;
}

export interface SimulationPort {
  runScenario(input: {
    networkId: string;
    horizonStart: string;
    interventions: unknown[];
    sampleTimeSeconds?: number;
    scenarioRunId?: string;
  }): Promise<ScenarioResult>;
}
