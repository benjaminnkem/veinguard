import { api } from "./api";
import { publicEnv } from "./public-env";

export interface LabCatalogAsset {
  id: string;
  sourceId: string;
}

export interface LabContext {
  baselineRunId: string;
  network: {
    id: string;
    name: string;
    sourceType: string;
    sha256: string;
    geoReferenceType: string;
  };
  sampleTimeSeconds: number;
  observationTime: string;
  horizonStart: string;
  operationalTargetMgL: number;
  cards: {
    projectedTargetBreachAssetCount: number;
    minimumModeledResidualMgL: number | null;
    minimumSamplePressureM: number | null;
  };
  catalog: {
    pumps: LabCatalogAsset[];
    tanks: LabCatalogAsset[];
    reservoirs: LabCatalogAsset[];
    junctions: LabCatalogAsset[];
    valves: LabCatalogAsset[];
    types: Array<{
      id: string;
      label: string;
      enabled: boolean;
      notice?: string | null;
    }>;
  };
  notices: { actuation: string; heat: string; time: string };
  geminiConfigured: boolean;
  disclosure: string;
}

export interface ScenarioRecord {
  id: string;
  name: string;
  status: string;
  baselineRunId: string;
  interventions: Record<string, unknown>[];
  horizonStart: string;
  sampleTimeSeconds: number;
  feasible: boolean;
  objective: number | null;
  metrics: Record<string, unknown> | null;
  hydraulics: Record<string, unknown> | null;
  constraints: Array<Record<string, unknown>>;
  hardConstraintViolations: Array<{
    id: string;
    message: string;
    assetIds: unknown[];
    observed: unknown;
    limit: unknown;
    units: unknown;
  }>;
  networkState: {
    nodes?: Array<{
      id: string;
      residualMgL?: number | null;
      pressureM?: number | null;
      waterAgeHours?: number | null;
      projectedTargetBreach?: boolean;
    }>;
    links?: Array<{ id: string; flowM3s?: number | null }>;
  } | null;
  appliedToTwin: boolean;
  jobId: string | null;
  error: { code: string | null; message: string | null };
  createdAt: string;
  updatedAt: string;
}

export interface LabList {
  baseline: { id: string; name: string; status: string; feasible: boolean };
  scenarios: ScenarioRecord[];
  appliedScenarioId: string | null;
  notices: { actuation: string; heat: string };
}

export interface ComparisonResult {
  feasible: Array<{ scenarioRunId: string; objective: number; rank: number }>;
  rejected: Array<{
    scenarioRunId: string;
    hardConstraintViolationIds: string[];
  }>;
  objectiveProfileVersion: string;
  heatNotice: string;
  actuationNotice: string;
}

export interface AgentRunView {
  agentRunId: string;
  status: string;
  outcome: string | null;
  goal: string;
  structuredConstraints: Record<string, unknown>;
  selectedScenarioRunId: string | null;
  rationale: string | null;
  scenarioRunIds: string[];
  error: { code: string | null; message: string | null };
}

export interface AgentEventView {
  agentRunId: string;
  sequence: number;
  type: string;
  timestamp: string;
  displayMessage: string;
  toolName: string | null;
  scenarioRunId: string | null;
}

export const labKeys = {
  all: ["lab"] as const,
  context: () => [...labKeys.all, "context"] as const,
  list: () => [...labKeys.all, "list"] as const,
  scenario: (id: string) => [...labKeys.all, "scenario", id] as const,
  applied: () => [...labKeys.all, "applied"] as const,
  agent: (id: string) => [...labKeys.all, "agent", id] as const,
};

export async function fetchLabContext(): Promise<LabContext> {
  const { data } = await api.get<LabContext>("/lab/demo");
  return data;
}

export async function fetchLabList(): Promise<LabList> {
  const { data } = await api.get<LabList>("/lab/scenarios");
  return data;
}

export async function createScenario(body: {
  name: string;
  interventions: Record<string, unknown>[];
}): Promise<ScenarioRecord> {
  const { data } = await api.post<ScenarioRecord>("/lab/scenarios", body);
  return data;
}

export async function runScenario(id: string): Promise<ScenarioRecord> {
  const { data } = await api.post<ScenarioRecord>(`/lab/scenarios/${id}/run`);
  return data;
}

export async function fetchScenario(id: string): Promise<ScenarioRecord> {
  const { data } = await api.get<ScenarioRecord>(`/lab/scenarios/${id}`);
  return data;
}

export async function compareScenarios(scenarioRunIds: string[]): Promise<ComparisonResult> {
  const { data } = await api.post<ComparisonResult>("/lab/scenarios/compare", {
    scenarioRunIds,
  });
  return data;
}

export async function applyScenario(id: string): Promise<{
  appliedScenarioId: string;
  notice: string;
  heatNotice: string;
  scenario: ScenarioRecord;
}> {
  const { data } = await api.post(`/lab/scenarios/${id}/apply`);
  return data;
}

export async function fetchApplied(): Promise<{
  appliedScenarioId: string | null;
  afterAvailable: boolean;
  heatNotice: string;
  scenario: ScenarioRecord | null;
}> {
  const { data } = await api.get("/lab/applied");
  return data;
}

export async function startLabAgent(body: {
  goal: string;
  structuredConstraints?: Record<string, unknown>;
}): Promise<{ agentRunId: string; status: string }> {
  const { data } = await api.post("/lab/agent-runs", body);
  return data;
}

export async function fetchLabAgent(id: string): Promise<AgentRunView> {
  const { data } = await api.get<AgentRunView>(`/lab/agent-runs/${id}`);
  return data;
}

export function labEventStreamUrl(agentRunId: string): string {
  return `${publicEnv.apiBaseUrl}/lab/agent-runs/${agentRunId}/events/stream`;
}
