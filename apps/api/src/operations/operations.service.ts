import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import {
  aoiPath,
  fortyGuardFixturePath,
  operationsSnapshotPath,
} from './operations.paths';
import { LAYER_IDS, projectLayer } from './operations.layers';
import {
  buildTwinGraph,
  scenarioPreviewUnavailable,
  traceTwin,
  type TraceDirection,
} from './operations.twin';
import type {
  ChemistryId,
  FeatureCollection,
  OperationsLayer,
  OperationsLink,
  OperationsNode,
  OperationsSnapshot,
} from './operations.types';

@Injectable()
export class OperationsService {
  private snapshotCache: OperationsSnapshot | null = null;
  private thermalCache: FeatureCollection | null = null;

  context() {
    const snapshot = this.snapshot();
    const thermal = this.thermalGeoJson();
    const nodes = snapshot.nodes;
    const residuals = nodes
      .map((node) => node.residualMgL)
      .filter((value): value is number => value != null);
    const ages = nodes
      .map((node) => node.waterAgeHours)
      .filter((value): value is number => value != null);
    const temps = nodes
      .map((node) => node.modeledWaterTemperatureC)
      .filter((value): value is number => value != null);
    const pressures = nodes
      .map((node) => node.pressureM)
      .filter((value): value is number => value != null);
    const breachIds = nodes
      .filter((node) => node.projectedTargetBreach)
      .map((node) => node.id);
    const aoi = JSON.parse(readFileSync(aoiPath(), 'utf8')) as {
      eligibility?: string;
      geoReferenceType?: string;
    };
    return {
      snapshotId: snapshot.snapshotId,
      network: {
        id: snapshot.networkId,
        name: snapshot.name,
        sourceType: snapshot.sourceType,
        sha256: snapshot.sha256,
        geoReferenceType: snapshot.geoReferenceType,
        disclosure: aoi.eligibility,
      },
      chemistryProfiles: [
        { id: 'FREE_CHLORINE', status: 'ACTIVE', label: 'Free Chlorine' },
        { id: 'MONOCHLORAMINE', status: 'ACTIVE', label: 'Monochloramine' },
        {
          id: 'CHLORINE_DIOXIDE',
          status: 'COMING_SOON',
          label: 'Chlorine Dioxide',
        },
        {
          id: 'ADVANCED_MULTI_SPECIES',
          status: 'COMING_SOON',
          label: 'Advanced Multi-Species',
        },
      ],
      thermal: {
        freshness: snapshot.freshness,
        observationTime: snapshot.observationTime,
        fixtureId: snapshot.fixtureId,
        featureCount: thermal.features.length,
        meanAssociatedAirTemperatureC: snapshot.meanAssociatedAirTemperatureC,
      },
      simulation: {
        status: snapshot.hydraulics.converged ? 'READY' : 'FAILED',
        sampleTimeSeconds: snapshot.sampleTimeSeconds,
        hydraulicsConverged: snapshot.hydraulics.converged,
      },
      availableTimes: snapshot.availableTimes,
      layers: LAYER_IDS,
      cards: {
        projectedTargetBreachAssetCount: breachIds.length,
        projectedTargetBreachAssetIds: breachIds,
        earliestProjectedTargetBreach: breachIds.length
          ? {
              sampleTimeSeconds: snapshot.sampleTimeSeconds,
              observationTime: snapshot.observationTime,
              note: 'Only the selected sample time is modeled in this snapshot. No earlier clock time is invented.',
            }
          : null,
        minimumModeledResidualMgL: residuals.length
          ? Math.min(...residuals)
          : null,
        maximumWaterAgeHours: ages.length ? Math.max(...ages) : null,
        minimumSamplePressureM: pressures.length
          ? Math.min(...pressures)
          : null,
        maximumModeledWaterTemperatureC: temps.length
          ? Math.max(...temps)
          : null,
        operationalTargetMgL: snapshot.operationalTargetMgL,
        monochloramineOperationalTargetMgL:
          snapshot.monochloramineOperationalTargetMgL ?? null,
      },
      states: {
        thermal: snapshot.freshness,
        simulation: snapshot.hydraulics.converged ? 'READY' : 'FAILED',
        coverage: 'COVERED',
      },
    };
  }

  layer(layer: OperationsLayer, chemistry: ChemistryId) {
    if (layer === 'tcm') {
      return {
        layer,
        chemistry,
        freshness: this.snapshot().freshness,
        geojson: this.thermalGeoJson(),
      };
    }
    if (layer === 'nitrification' && chemistry !== 'MONOCHLORAMINE') {
      return {
        layer,
        chemistry,
        modeled: false,
        message:
          'Nitrification conditions are modeled only for Monochloramine.',
        geojson: emptyCollection(),
      };
    }
    return {
      layer,
      chemistry,
      modeled: true,
      geojson: projectLayer(this.snapshot(), layer, chemistry),
    };
  }

  asset(id: string, chemistry: ChemistryId) {
    const snapshot = this.snapshot();
    const node = snapshot.nodes.find(
      (item) => item.id === id || item.sourceId === id,
    );
    const link = snapshot.links.find(
      (item) => item.id === id || item.sourceId === id,
    );
    if (node) {
      return presentNode(node, snapshot, chemistry);
    }
    if (link) {
      return presentLink(link, snapshot);
    }
    return null;
  }

  twin(chemistry: ChemistryId) {
    const snapshot = this.snapshot();
    const graph = buildTwinGraph(snapshot, chemistry);
    const aoi = JSON.parse(readFileSync(aoiPath(), 'utf8')) as {
      eligibility?: string;
    };
    return {
      ...graph,
      snapshotId: snapshot.snapshotId,
      geoReferenceType: snapshot.geoReferenceType,
      freshness: snapshot.freshness,
      availableTimes: snapshot.availableTimes,
      hydraulicsConverged: snapshot.hydraulics.converged,
      scenario: scenarioPreviewUnavailable(),
      counts: {
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        junctions: graph.nodes.filter((node) => node.type === 'JUNCTION')
          .length,
        tanks: graph.nodes.filter((node) => node.type === 'TANK').length,
        reservoirs: graph.nodes.filter((node) => node.type === 'RESERVOIR')
          .length,
        pumps: graph.nodes.filter((node) => node.type === 'PUMP').length,
        valves: graph.nodes.filter((node) => node.type === 'VALVE').length,
      },
      language: 'modeled/projected/configured-target',
      disclosure:
        aoi.eligibility ??
        'EPA Net3 is an EPA_BENCHMARK network with SYNTHETIC_GEOREFERENCING. Apply is digital-twin only.',
      editing: {
        topologyEditable: false,
        notice:
          'Digital Twin is view-only. CAD/network editing is not permitted.',
      },
    };
  }

  twinTrace(assetId: string, direction: TraceDirection) {
    const graph = buildTwinGraph(this.snapshot(), 'FREE_CHLORINE');
    return traceTwin(graph, assetId, direction);
  }

  provenance() {
    const snapshot = this.snapshot();
    const fixture = JSON.parse(
      readFileSync(fortyGuardFixturePath(), 'utf8'),
    ) as { provenance?: Record<string, unknown> };
    return {
      snapshotId: snapshot.snapshotId,
      observationTime: snapshot.observationTime,
      network: snapshot.provenance,
      fortyGuardFixture: fixture.provenance ?? null,
      notice:
        'EPA Net3 is an EPA_BENCHMARK network with SYNTHETIC_GEOREFERENCING into the FortyGuard demo AOI. Apply is digital-twin only.',
    };
  }

  private snapshot(): OperationsSnapshot {
    if (!this.snapshotCache) {
      this.snapshotCache = JSON.parse(
        readFileSync(operationsSnapshotPath(), 'utf8'),
      ) as OperationsSnapshot;
    }
    return this.snapshotCache;
  }

  private thermalGeoJson(): FeatureCollection {
    if (!this.thermalCache) {
      const fixture = JSON.parse(
        readFileSync(fortyGuardFixturePath(), 'utf8'),
      ) as {
        rawResponse: {
          data: { result: { map_data: FeatureCollection } };
        };
      };
      this.thermalCache = fixture.rawResponse.data.result.map_data;
    }
    return this.thermalCache;
  }
}

function emptyCollection(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

function presentNode(
  node: OperationsNode,
  snapshot: OperationsSnapshot,
  chemistry: ChemistryId,
) {
  const residual =
    chemistry === 'MONOCHLORAMINE'
      ? node.monochloramineResidualMgL
      : node.residualMgL;
  const breach =
    chemistry === 'MONOCHLORAMINE'
      ? node.monochloramineTargetBreach
      : node.projectedTargetBreach;
  const target =
    chemistry === 'MONOCHLORAMINE'
      ? snapshot.monochloramineOperationalTargetMgL
      : snapshot.operationalTargetMgL;
  const drivers = why(node, residual ?? null, target ?? null, chemistry);
  return {
    kind: 'NODE',
    id: node.id,
    sourceId: node.sourceId,
    type: node.type,
    chemistry,
    hydraulics: {
      pressureM: node.pressureM ?? null,
      waterAgeHours: node.waterAgeHours ?? null,
    },
    thermal: {
      fortyGuardCellId: node.cellId ?? null,
      associatedAirTemperatureC: node.associatedAirTemperatureC ?? null,
      modeledWaterTemperatureC: node.modeledWaterTemperatureC ?? null,
    },
    chemistryState: {
      residualMgL: residual ?? null,
      operationalTargetMgL: target ?? null,
      projectedTargetBreach: breach ?? false,
      freeAmmoniaMgNL:
        chemistry === 'MONOCHLORAMINE' ? (node.freeAmmoniaMgNL ?? null) : null,
      nitrificationLevel:
        chemistry === 'MONOCHLORAMINE'
          ? (node.nitrificationLevel ?? null)
          : null,
      nitrificationDrivers:
        chemistry === 'MONOCHLORAMINE' ? (node.nitrificationDrivers ?? []) : [],
      nitrificationLabel:
        chemistry === 'MONOCHLORAMINE'
          ? (node.nitrificationLabel ?? null)
          : null,
    },
    flags: node.flags ?? [],
    why: drivers,
    language: 'modeled/projected/configured-target',
  };
}

function presentLink(link: OperationsLink, snapshot: OperationsSnapshot) {
  return {
    kind: 'LINK',
    id: link.id,
    sourceId: link.sourceId,
    type: link.type,
    fromNodeId: link.fromNodeId,
    toNodeId: link.toNodeId,
    hydraulics: {
      flowM3s: link.flowM3s ?? null,
      velocityMs: link.velocityMs ?? null,
    },
    network: {
      id: snapshot.networkId,
      sourceType: snapshot.sourceType,
    },
    why: [],
  };
}

function why(
  node: OperationsNode,
  residual: number | null,
  target: number | null,
  chemistry: ChemistryId,
): string[] {
  const drivers: string[] = [];
  if ((node.flags ?? []).includes('NO_THERMAL_COVERAGE')) {
    drivers.push('No FortyGuard thermal coverage at this asset.');
  }
  if (node.waterAgeHours != null && node.waterAgeHours >= 48) {
    drivers.push('High modeled water age (≥ 48 h, configured horizon).');
  }
  if (
    node.modeledWaterTemperatureC != null &&
    node.modeledWaterTemperatureC >= 15
  ) {
    drivers.push('Elevated modeled water temperature (≥ 15 °C).');
  }
  if (residual != null && target != null && residual < target) {
    drivers.push(
      `Modeled residual is below the configured operational target (${target} mg/L).`,
    );
  }
  if (chemistry === 'MONOCHLORAMINE') {
    for (const item of node.nitrificationDrivers ?? []) {
      drivers.push(item.replaceAll('_', ' ').toLowerCase());
    }
  }
  return [...new Set(drivers)];
}
