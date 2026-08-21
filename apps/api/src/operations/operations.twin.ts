import type {
  ChemistryId,
  OperationsNode,
  OperationsSnapshot,
} from './operations.types';

/** Flows smaller than this (m³/s) are treated as no hydraulic direction. */
export const FLOW_DIRECTION_EPSILON_M3S = 1e-6;

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
  nodes: TwinNode[];
  edges: TwinEdge[];
  sampleTimeSeconds: number;
  observationTime: string;
  networkId: string;
  name: string;
  sourceType: string;
  chemistry: ChemistryId;
  operationalTargetMgL: number | null;
}

export type TraceDirection = 'upstream' | 'downstream';

export interface TwinTrace {
  startId: string;
  resolvedAssetId: string;
  kind: 'NODE' | 'EDGE';
  direction: TraceDirection;
  nodeIds: string[];
  edgeIds: string[];
  supplyAssets: Array<{ id: string; type: string; sourceId: string }>;
  notice: string;
}

export function buildTwinGraph(
  snapshot: OperationsSnapshot,
  chemistry: ChemistryId = 'FREE_CHLORINE',
): TwinGraph {
  const positions = projectPositions(snapshot.nodes);
  const nodes: TwinNode[] = [];
  const edges: TwinEdge[] = [];
  const target =
    chemistry === 'MONOCHLORAMINE'
      ? (snapshot.monochloramineOperationalTargetMgL ?? null)
      : snapshot.operationalTargetMgL;

  for (const node of snapshot.nodes) {
    const position = positions.get(node.id);
    if (!position) {
      continue;
    }
    nodes.push(toTwinNode(node, position, chemistry));
  }

  for (const link of snapshot.links) {
    if (!positions.has(link.fromNodeId) || !positions.has(link.toNodeId)) {
      continue;
    }
    if (link.type === 'PIPE') {
      edges.push({
        id: link.id,
        sourceId: link.sourceId,
        parentId: null,
        type: 'PIPE',
        source: link.fromNodeId,
        target: link.toNodeId,
        flowM3s: link.flowM3s ?? null,
        velocityMs: link.velocityMs ?? null,
        derived: false,
      });
      continue;
    }
    if (link.type !== 'PUMP' && link.type !== 'VALVE') {
      continue;
    }
    const from = positions.get(link.fromNodeId)!;
    const to = positions.get(link.toNodeId)!;
    const id = link.id;
    nodes.push({
      id,
      sourceId: link.sourceId,
      type: link.type,
      position: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
      pressureM: null,
      waterAgeHours: null,
      residualMgL: null,
      modeledWaterTemperatureC: null,
      projectedTargetBreach: false,
      flowM3s: link.flowM3s ?? null,
      flags: [],
      nitrificationLevel: null,
      nitrificationLabel: null,
    });
    edges.push({
      id: `${id}-in`,
      sourceId: link.sourceId,
      parentId: id,
      type: 'PIPE',
      source: link.fromNodeId,
      target: id,
      flowM3s: link.flowM3s ?? null,
      velocityMs: link.velocityMs ?? null,
      derived: true,
    });
    edges.push({
      id: `${id}-out`,
      sourceId: link.sourceId,
      parentId: id,
      type: 'PIPE',
      source: id,
      target: link.toNodeId,
      flowM3s: link.flowM3s ?? null,
      velocityMs: link.velocityMs ?? null,
      derived: true,
    });
  }

  return {
    nodes,
    edges,
    sampleTimeSeconds: snapshot.sampleTimeSeconds,
    observationTime: snapshot.observationTime,
    networkId: snapshot.networkId,
    name: snapshot.name,
    sourceType: snapshot.sourceType,
    chemistry,
    operationalTargetMgL: target,
  };
}

export function traceTwin(
  graph: TwinGraph,
  assetId: string,
  direction: TraceDirection,
): TwinTrace | null {
  const resolved = resolveTwinAsset(graph, assetId);
  if (!resolved) {
    return null;
  }

  const adjacency = buildHydraulicAdjacency(graph.edges);
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const queue: string[] = [];

  if (resolved.kind === 'NODE') {
    nodeIds.add(resolved.id);
    queue.push(resolved.id);
  } else {
    edgeIds.add(resolved.id);
    const ends = hydraulicEnds(resolved.edge);
    if (!ends) {
      nodeIds.add(resolved.edge.source);
      nodeIds.add(resolved.edge.target);
      return {
        startId: assetId,
        resolvedAssetId: resolved.inspectId,
        kind: 'EDGE',
        direction,
        nodeIds: [...nodeIds],
        edgeIds: [...edgeIds],
        supplyAssets: supplyAssets(graph, nodeIds),
        notice:
          'No modeled hydraulic direction at this link (|flow| < 1e-6 m³/s). Trace does not invent a path.',
      };
    }
    const start = direction === 'downstream' ? ends.to : ends.from;
    nodeIds.add(start);
    queue.push(start);
  }

  const neighbors = direction === 'downstream' ? adjacency.down : adjacency.up;
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const step of neighbors.get(current) ?? []) {
      if (edgeIds.has(step.edgeId) && nodeIds.has(step.nodeId)) {
        continue;
      }
      edgeIds.add(step.edgeId);
      if (!nodeIds.has(step.nodeId)) {
        nodeIds.add(step.nodeId);
        queue.push(step.nodeId);
      }
    }
  }

  const noFlowStart =
    resolved.kind === 'NODE' && edgeIds.size === 0
      ? 'No modeled hydraulic direction at this asset (|flow| < 1e-6 m³/s). Trace does not invent a path.'
      : 'Trace follows modeled hydraulic flow sign at the selected sample time. Zero/near-zero flow is not treated as a direction.';

  return {
    startId: assetId,
    resolvedAssetId: resolved.inspectId,
    kind: resolved.kind,
    direction,
    nodeIds: [...nodeIds],
    edgeIds: [...edgeIds],
    supplyAssets: supplyAssets(graph, nodeIds),
    notice: noFlowStart,
  };
}

export function resolveTwinAsset(
  graph: TwinGraph,
  assetId: string,
):
  | { kind: 'NODE'; id: string; inspectId: string }
  | { kind: 'EDGE'; id: string; inspectId: string; edge: TwinEdge }
  | null {
  const nodeExact = graph.nodes.find((node) => node.id === assetId);
  if (nodeExact) {
    return { kind: 'NODE', id: nodeExact.id, inspectId: nodeExact.id };
  }
  const edgeExact = graph.edges.find((edge) => edge.id === assetId);
  if (edgeExact) {
    return {
      kind: 'EDGE',
      id: edgeExact.id,
      inspectId: edgeExact.parentId ?? edgeExact.id,
      edge: edgeExact,
    };
  }
  const nodeSource = graph.nodes.find((node) => node.sourceId === assetId);
  if (nodeSource) {
    return { kind: 'NODE', id: nodeSource.id, inspectId: nodeSource.id };
  }
  const edgeSource = graph.edges.find((edge) => edge.sourceId === assetId);
  if (edgeSource) {
    return {
      kind: 'EDGE',
      id: edgeSource.id,
      inspectId: edgeSource.parentId ?? edgeSource.id,
      edge: edgeSource,
    };
  }
  return null;
}

function toTwinNode(
  node: OperationsNode,
  position: { x: number; y: number },
  chemistry: ChemistryId,
): TwinNode {
  const residual =
    chemistry === 'MONOCHLORAMINE'
      ? (node.monochloramineResidualMgL ?? null)
      : (node.residualMgL ?? null);
  const breach =
    chemistry === 'MONOCHLORAMINE'
      ? Boolean(node.monochloramineTargetBreach)
      : Boolean(node.projectedTargetBreach);
  return {
    id: node.id,
    sourceId: node.sourceId,
    type: node.type,
    position,
    pressureM: node.pressureM ?? null,
    waterAgeHours: node.waterAgeHours ?? null,
    residualMgL: residual,
    modeledWaterTemperatureC: node.modeledWaterTemperatureC ?? null,
    projectedTargetBreach: breach,
    flowM3s: null,
    flags: node.flags ?? [],
    nitrificationLevel:
      chemistry === 'MONOCHLORAMINE' ? (node.nitrificationLevel ?? null) : null,
    nitrificationLabel:
      chemistry === 'MONOCHLORAMINE' ? (node.nitrificationLabel ?? null) : null,
  };
}

function projectPositions(
  nodes: OperationsNode[],
): Map<string, { x: number; y: number }> {
  const coords: Array<{ id: string; lon: number; lat: number }> = [];
  for (const node of nodes) {
    if (node.longitude == null || node.latitude == null) {
      continue;
    }
    coords.push({ id: node.id, lon: node.longitude, lat: node.latitude });
  }
  if (coords.length === 0) {
    return new Map();
  }
  const lons = coords.map((item) => item.lon);
  const lats = coords.map((item) => item.lat);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const spanLon = Math.max(maxLon - minLon, 1e-6);
  const spanLat = Math.max(maxLat - minLat, 1e-6);
  const width = 1600;
  const height = 1100;
  const pad = 48;
  const out = new Map<string, { x: number; y: number }>();
  for (const item of coords) {
    out.set(item.id, {
      x: pad + ((item.lon - minLon) / spanLon) * width,
      y: pad + ((maxLat - item.lat) / spanLat) * height,
    });
  }
  return out;
}

function hydraulicEnds(edge: TwinEdge): { from: string; to: string } | null {
  if (
    edge.flowM3s == null ||
    Math.abs(edge.flowM3s) < FLOW_DIRECTION_EPSILON_M3S
  ) {
    return null;
  }
  if (edge.flowM3s > 0) {
    return { from: edge.source, to: edge.target };
  }
  return { from: edge.target, to: edge.source };
}

function buildHydraulicAdjacency(edges: TwinEdge[]): {
  down: Map<string, Array<{ nodeId: string; edgeId: string }>>;
  up: Map<string, Array<{ nodeId: string; edgeId: string }>>;
} {
  const down = new Map<string, Array<{ nodeId: string; edgeId: string }>>();
  const up = new Map<string, Array<{ nodeId: string; edgeId: string }>>();
  const push = (
    map: Map<string, Array<{ nodeId: string; edgeId: string }>>,
    from: string,
    to: string,
    edgeId: string,
  ) => {
    const list = map.get(from) ?? [];
    list.push({ nodeId: to, edgeId });
    map.set(from, list);
  };
  for (const edge of edges) {
    const ends = hydraulicEnds(edge);
    if (!ends) {
      continue;
    }
    push(down, ends.from, ends.to, edge.id);
    push(up, ends.to, ends.from, edge.id);
  }
  return { down, up };
}

function supplyAssets(
  graph: TwinGraph,
  nodeIds: Set<string>,
): Array<{ id: string; type: string; sourceId: string }> {
  return graph.nodes
    .filter(
      (node) =>
        nodeIds.has(node.id) &&
        (node.type === 'TANK' || node.type === 'RESERVOIR'),
    )
    .map((node) => ({ id: node.id, type: node.type, sourceId: node.sourceId }));
}

export function scenarioPreviewUnavailable(): {
  afterAvailable: false;
  notice: string;
} {
  return {
    afterAvailable: false,
    notice:
      'Scenario after-state is unavailable until a completed scenario simulation exists. VeinGuard does not invent an after-state. Intervention Lab will supply after-metrics from a real run.',
  };
}
