import { api } from "./api";

export type ChemistryId = "FREE_CHLORINE" | "MONOCHLORAMINE";
export type OperationsLayer =
  | "tcm"
  | "network"
  | "assets"
  | "pressure"
  | "flow"
  | "water-age"
  | "water-temperature"
  | "residual"
  | "target"
  | "nitrification";

export interface OperationsContext {
  snapshotId: string;
  network: {
    id: string;
    name: string;
    sourceType: string;
    sha256: string;
    geoReferenceType: string;
    disclosure?: string;
  };
  chemistryProfiles: Array<{ id: string; status: string; label: string }>;
  thermal: {
    freshness: string;
    observationTime: string;
    fixtureId: string;
    featureCount: number;
    meanAssociatedAirTemperatureC: number | null;
  };
  simulation: {
    status: string;
    sampleTimeSeconds: number;
    hydraulicsConverged: boolean;
  };
  availableTimes: Array<{
    seconds: number;
    observationTime: string;
    label: string;
  }>;
  cards: {
    projectedTargetBreachAssetCount: number;
    projectedTargetBreachAssetIds: string[];
    earliestProjectedTargetBreach: {
      sampleTimeSeconds: number;
      observationTime: string;
      note: string;
    } | null;
    minimumModeledResidualMgL: number | null;
    maximumWaterAgeHours: number | null;
    operationalTargetMgL: number;
    monochloramineOperationalTargetMgL: number | null;
  };
  states: { thermal: string; simulation: string; coverage: string };
}

export interface LayerResponse {
  layer: string;
  chemistry: string;
  modeled?: boolean;
  message?: string;
  freshness?: string;
  geojson: {
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      id?: string | number;
      properties: Record<string, unknown> | null;
      geometry: {
        type: string;
        coordinates: unknown;
      };
    }>;
  };
}

export interface AssetDetail {
  kind: string;
  id: string;
  sourceId: string;
  type: string;
  chemistry?: string;
  hydraulics?: Record<string, number | null | undefined>;
  thermal?: Record<string, string | number | null | undefined>;
  chemistryState?: {
    residualMgL: number | null;
    operationalTargetMgL: number | null;
    projectedTargetBreach: boolean;
    freeAmmoniaMgNL: number | null;
    nitrificationLevel: string | null;
    nitrificationDrivers: string[];
    nitrificationLabel: string | null;
  };
  flags?: string[];
  why?: string[];
  language?: string;
}

export interface ProvenancePayload {
  snapshotId: string;
  observationTime: string;
  notice: string;
  network: Record<string, unknown>;
  fortyGuardFixture: Record<string, unknown> | null;
}

export interface TwinNode {
  id: string;
  sourceId: string;
  type: string;
  position: { x: number; y: number };
  pressureM: number | null;
  waterAgeHours: number | null;
  residualMgL: number | null;
  modeledWaterTemperatureC: number | null;
  projectedTargetBreach: boolean;
  flowM3s: number | null;
  flags: string[];
  nitrificationLevel: string | null;
  nitrificationLabel: string | null;
}

export interface TwinEdge {
  id: string;
  sourceId: string;
  parentId: string | null;
  type: string;
  source: string;
  target: string;
  flowM3s: number | null;
  velocityMs: number | null;
  derived: boolean;
}

export interface TwinGraph {
  snapshotId: string;
  networkId: string;
  name: string;
  sourceType: string;
  geoReferenceType: string;
  chemistry: ChemistryId;
  operationalTargetMgL: number | null;
  sampleTimeSeconds: number;
  observationTime: string;
  freshness: string;
  availableTimes: OperationsContext["availableTimes"];
  hydraulicsConverged: boolean;
  nodes: TwinNode[];
  edges: TwinEdge[];
  scenario: { afterAvailable: false; notice: string };
  counts: {
    nodes: number;
    edges: number;
    junctions: number;
    tanks: number;
    reservoirs: number;
    pumps: number;
    valves: number;
  };
  language: string;
  disclosure: string;
  editing: { topologyEditable: false; notice: string };
}

export interface TwinTrace {
  startId: string;
  resolvedAssetId: string;
  kind: "NODE" | "EDGE";
  direction: "upstream" | "downstream";
  nodeIds: string[];
  edgeIds: string[];
  supplyAssets: Array<{ id: string; type: string; sourceId: string }>;
  notice: string;
}

export type TwinColorBy =
  | "residual"
  | "pressure"
  | "water-age"
  | "water-temperature"
  | "target";

export const operationsKeys = {
  all: ["operations"] as const,
  context: () => [...operationsKeys.all, "context"] as const,
  layer: (layer: OperationsLayer, chemistry: ChemistryId) =>
    [...operationsKeys.all, "layer", layer, chemistry] as const,
  asset: (id: string, chemistry: ChemistryId) =>
    [...operationsKeys.all, "asset", id, chemistry] as const,
  provenance: () => [...operationsKeys.all, "provenance"] as const,
  twin: (chemistry: ChemistryId) =>
    [...operationsKeys.all, "twin", chemistry] as const,
  twinTrace: (asset: string, direction: "upstream" | "downstream") =>
    [...operationsKeys.all, "twin-trace", asset, direction] as const,
};

export async function fetchContext(): Promise<OperationsContext> {
  const { data } = await api.get<OperationsContext>("/operations/demo");
  return data;
}

export async function fetchLayer(
  layer: OperationsLayer,
  chemistry: ChemistryId,
): Promise<LayerResponse> {
  const { data } = await api.get<LayerResponse>(
    `/operations/demo/layers/${layer}`,
    { params: { chemistry } },
  );
  return data;
}

export async function fetchAsset(
  id: string,
  chemistry: ChemistryId,
): Promise<AssetDetail> {
  const { data } = await api.get<AssetDetail>(
    `/operations/demo/assets/${encodeURIComponent(id)}`,
    { params: { chemistry } },
  );
  return data;
}

export async function fetchProvenance(): Promise<ProvenancePayload> {
  const { data } = await api.get<ProvenancePayload>("/operations/demo/provenance");
  return data;
}

export async function fetchTwin(chemistry: ChemistryId): Promise<TwinGraph> {
  const { data } = await api.get<TwinGraph>("/operations/demo/twin", {
    params: { chemistry },
  });
  return data;
}

export async function fetchTwinTrace(
  asset: string,
  direction: "upstream" | "downstream",
): Promise<TwinTrace> {
  const { data } = await api.get<TwinTrace>("/operations/demo/twin/trace", {
    params: { asset, direction },
  });
  return data;
}

export const LAYER_META: Record<
  OperationsLayer,
  { label: string; group: string; chemistry?: ChemistryId | "BOTH" }
> = {
  tcm: { label: "FortyGuard TCM", group: "Environmental" },
  network: { label: "Pipes & pumps", group: "Network" },
  assets: { label: "Asset markers", group: "Network" },
  pressure: { label: "Pressure", group: "Hydraulic" },
  flow: { label: "Flow", group: "Hydraulic" },
  "water-age": { label: "Water age", group: "Hydraulic" },
  "water-temperature": { label: "Modeled water temperature", group: "Water quality", chemistry: "BOTH" },
  residual: { label: "Modeled residual", group: "Water quality", chemistry: "BOTH" },
  target: { label: "Projected target breach", group: "Water quality", chemistry: "BOTH" },
  nitrification: {
    label: "Nitrification conditions",
    group: "Water quality",
    chemistry: "MONOCHLORAMINE",
  },
};
