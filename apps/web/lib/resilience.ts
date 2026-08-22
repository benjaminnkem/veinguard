import { api } from "./api";

export interface ResilienceContext {
  networkId: string;
  aoiProfileId: string;
  historicalStart: string;
  maxEvents: number;
  capturedEvent: { hour: string; fixtureId: string; label: string };
  notices: { sample: string; causation: string; captured: string };
  disclosure: string;
}

export interface ResilienceEvent {
  hour: string;
  status: string;
  freshness: string | null;
  cached: boolean;
  fixtureId: string | null;
  meanAirTemperatureC?: number | null;
  highHeatAssetIds: string[];
  targetBreachAssetIds: string[];
  chemistryStatus: string | null;
  error: { code: string | null; message: string | null } | null;
}

export interface RecurrenceRow {
  id: string;
  count: number;
  sampleSize: number;
  recurring: boolean;
}

export interface ResilienceStudy {
  id: string;
  name: string;
  status: string;
  eventHours: string[];
  events: ResilienceEvent[];
  aggregation: {
    requested: number;
    succeeded: number;
    failed: number;
    cachedReal: number;
    chemistrySucceeded: number;
    sampleSize: number;
    recurringHighHeatAssets: RecurrenceRow[];
    recurringTargetBreachAssets: RecurrenceRow[];
    persistenceAssociation: {
      available: boolean;
      sampleSize: number;
      notice: string;
    };
    exceedanceAssociation: {
      available: boolean;
      sampleSize: number;
      notice: string;
    };
    language: { recurrence: string; targetBreach: string; association: string };
  };
  notices: Record<string, string>;
  recurrenceGeoJson?: {
    type: "FeatureCollection";
    features: Array<{
      id?: string;
      properties: Record<string, unknown>;
      geometry: { type: string; coordinates: number[] };
    }>;
  };
}

export const resilienceKeys = {
  all: ["resilience"] as const,
  context: () => [...resilienceKeys.all, "context"] as const,
  list: () => [...resilienceKeys.all, "list"] as const,
  study: (id: string) => [...resilienceKeys.all, "study", id] as const,
};

export async function fetchResilienceContext(): Promise<ResilienceContext> {
  const { data } = await api.get<ResilienceContext>("/resilience/demo");
  return data;
}

export async function fetchStudies(): Promise<ResilienceStudy[]> {
  const { data } = await api.get<ResilienceStudy[]>("/resilience/studies");
  return data;
}

export async function createStudy(body: {
  name: string;
  eventHours: string[];
  runChemistry?: boolean;
}): Promise<ResilienceStudy> {
  const { data } = await api.post<ResilienceStudy>("/resilience/studies", body);
  return data;
}

export async function fetchStudy(id: string): Promise<ResilienceStudy> {
  const { data } = await api.get<ResilienceStudy>(`/resilience/studies/${id}`);
  return data;
}
