import type {
  ChemistryId,
  FeatureCollection,
  OperationsLayer,
  OperationsLink,
  OperationsNode,
  OperationsSnapshot,
} from './operations.types';

export const LAYER_IDS: OperationsLayer[] = [
  'tcm',
  'network',
  'assets',
  'pressure',
  'flow',
  'water-age',
  'water-temperature',
  'residual',
  'target',
  'nitrification',
];

export function projectLayer(
  snapshot: OperationsSnapshot,
  layer: OperationsLayer,
  chemistry: ChemistryId,
): FeatureCollection {
  if (layer === 'tcm') {
    throw new Error('TCM is served from the FortyGuard snapshot.');
  }
  if (layer === 'network' || layer === 'flow') {
    return linkCollection(snapshot.links, layer);
  }
  return nodeCollection(snapshot.nodes, layer, chemistry);
}

function nodeCollection(
  nodes: OperationsNode[],
  layer: OperationsLayer,
  chemistry: ChemistryId,
): FeatureCollection {
  const features: FeatureCollection['features'] = [];
  for (const node of nodes) {
    if (node.longitude == null || node.latitude == null) {
      continue;
    }
    const properties: Record<string, unknown> = {
      id: node.id,
      sourceId: node.sourceId,
      type: node.type,
      flags: node.flags ?? [],
    };
    const metric = nodeMetric(node, layer, chemistry);
    if (metric) {
      properties[metric.key] = metric.value;
      properties.metric = metric.key;
      properties.hasValue = metric.value != null;
    }
    if (layer === 'assets') {
      properties.label = `${node.type} ${node.sourceId}`;
    }
    features.push({
      type: 'Feature',
      id: node.id,
      properties,
      geometry: {
        type: 'Point',
        coordinates: [node.longitude, node.latitude],
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

function linkCollection(
  links: OperationsLink[],
  layer: 'network' | 'flow',
): FeatureCollection {
  const features: FeatureCollection['features'] = [];
  for (const link of links) {
    if (!link.coordinates || link.coordinates.length < 2) {
      continue;
    }
    const properties: Record<string, unknown> = {
      id: link.id,
      sourceId: link.sourceId,
      type: link.type,
      fromNodeId: link.fromNodeId,
      toNodeId: link.toNodeId,
    };
    if (layer === 'flow') {
      properties.flowM3s = link.flowM3s ?? null;
      properties.velocityMs = link.velocityMs ?? null;
      properties.metric = 'flowM3s';
      properties.hasValue = link.flowM3s != null;
    }
    features.push({
      type: 'Feature',
      id: link.id,
      properties,
      geometry: { type: 'LineString', coordinates: link.coordinates },
    });
  }
  return { type: 'FeatureCollection', features };
}

function nodeMetric(
  node: OperationsNode,
  layer: OperationsLayer,
  chemistry: ChemistryId,
): { key: string; value: unknown } | null {
  switch (layer) {
    case 'pressure':
      return { key: 'pressureM', value: node.pressureM ?? null };
    case 'water-age':
      return { key: 'waterAgeHours', value: node.waterAgeHours ?? null };
    case 'water-temperature':
      return {
        key: 'modeledWaterTemperatureC',
        value: node.modeledWaterTemperatureC ?? null,
      };
    case 'residual':
      return {
        key: 'residualMgL',
        value:
          chemistry === 'MONOCHLORAMINE'
            ? (node.monochloramineResidualMgL ?? null)
            : (node.residualMgL ?? null),
      };
    case 'target':
      return {
        key: 'projectedTargetBreach',
        value:
          chemistry === 'MONOCHLORAMINE'
            ? (node.monochloramineTargetBreach ?? false)
            : (node.projectedTargetBreach ?? false),
      };
    case 'nitrification':
      return {
        key: 'nitrificationLevel',
        value: node.nitrificationLevel ?? null,
      };
    default:
      return null;
  }
}
