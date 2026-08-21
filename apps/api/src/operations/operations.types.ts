export type ChemistryId = 'FREE_CHLORINE' | 'MONOCHLORAMINE';

export interface FeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    id?: string | number;
    properties: Record<string, unknown>;
    geometry:
      | { type: 'Point'; coordinates: number[] }
      | { type: 'LineString'; coordinates: number[][] }
      | { type: 'Polygon'; coordinates: number[][][] };
  }>;
}

export type OperationsLayer =
  | 'tcm'
  | 'network'
  | 'assets'
  | 'pressure'
  | 'flow'
  | 'water-age'
  | 'water-temperature'
  | 'residual'
  | 'target'
  | 'nitrification';

export interface OperationsNode {
  id: string;
  sourceId: string;
  type: string;
  longitude: number | null;
  latitude: number | null;
  cellId?: string | null;
  associatedAirTemperatureC?: number | null;
  modeledWaterTemperatureC?: number | null;
  residualMgL?: number | null;
  projectedTargetBreach?: boolean;
  pressureM?: number | null;
  waterAgeHours?: number | null;
  flags?: string[];
  monochloramineResidualMgL?: number | null;
  monochloramineTargetBreach?: boolean;
  freeAmmoniaMgNL?: number | null;
  nitrificationLevel?: string | null;
  nitrificationDrivers?: string[];
  nitrificationLabel?: string | null;
}

export interface OperationsLink {
  id: string;
  sourceId: string;
  type: string;
  fromNodeId: string;
  toNodeId: string;
  flowM3s?: number | null;
  velocityMs?: number | null;
  coordinates?: number[][] | null;
}

export interface OperationsSnapshot {
  snapshotId: string;
  networkId: string;
  name: string;
  sourceType: string;
  sha256: string;
  geoReferenceType: string;
  geoReference: Record<string, unknown>;
  sampleTimeSeconds: number;
  observationTime: string;
  fixtureId: string;
  freshness: string;
  summary: Record<string, unknown>;
  hydraulics: { converged: boolean; summary?: Record<string, number | null> };
  operationalTargetMgL: number;
  monochloramineOperationalTargetMgL?: number;
  meanAssociatedAirTemperatureC: number | null;
  provenance: Record<string, unknown>;
  availableTimes: Array<{
    seconds: number;
    observationTime: string;
    label: string;
  }>;
  nodes: OperationsNode[];
  links: OperationsLink[];
}
