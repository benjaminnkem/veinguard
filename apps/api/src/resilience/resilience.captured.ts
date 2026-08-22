import { readFileSync } from 'node:fs';
import {
  fortyGuardFixturePath,
  operationsSnapshotPath,
} from '../operations/operations.paths';
import type { OperationsSnapshot } from '../operations/operations.types';
import { HIGH_HEAT_C } from './resilience.aggregate';

export const CAPTURED_EVENT_HOUR = '2024-07-15T14:00:00.000Z';
export const CAPTURED_FIXTURE_ID = 'heatmap-2024-07-15T14-demo-aoi-v1';

export function isCapturedHour(iso: string): boolean {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) {
    return false;
  }
  const utc = new Date(iso).toISOString();
  if (utc === CAPTURED_EVENT_HOUR) {
    return true;
  }
  // Fixture product window is 14:00-04:00 = 18:00Z on the same calendar hour label.
  return utc === '2024-07-15T18:00:00.000Z';
}

export function capturedEventResult() {
  const snapshot = JSON.parse(
    readFileSync(operationsSnapshotPath(), 'utf8'),
  ) as OperationsSnapshot;
  const fixture = JSON.parse(readFileSync(fortyGuardFixturePath(), 'utf8')) as {
    provenance?: {
      activityId?: string;
      requestHash?: string;
      fetchedAt?: string;
    };
    rawResponse?: {
      data?: {
        result?: { stats_data?: { temperature_stats?: { mean?: number } } };
      };
    };
  };
  const highHeatAssetIds = snapshot.nodes
    .filter(
      (node) =>
        node.associatedAirTemperatureC != null &&
        node.associatedAirTemperatureC >= HIGH_HEAT_C,
    )
    .map((node) => node.id);
  const targetBreachAssetIds = snapshot.nodes
    .filter((node) => node.projectedTargetBreach)
    .map((node) => node.id);
  const temps = snapshot.nodes
    .map((node) => node.associatedAirTemperatureC)
    .filter((value): value is number => value != null);
  return {
    freshness: 'CACHED_REAL' as const,
    cached: true,
    fixtureId: CAPTURED_FIXTURE_ID,
    activityId: fixture.provenance?.activityId ?? null,
    requestHash: fixture.provenance?.requestHash ?? null,
    fetchedAt: fixture.provenance?.fetchedAt ?? null,
    meanAirTemperatureC:
      temps.length > 0
        ? temps.reduce((sum, value) => sum + value, 0) / temps.length
        : (snapshot.meanAssociatedAirTemperatureC ?? null),
    statsMeanC:
      fixture.rawResponse?.data?.result?.stats_data?.temperature_stats?.mean ??
      null,
    highHeatAssetIds,
    targetBreachAssetIds,
    chemistryStatus: 'SUCCEEDED',
    persistenceAvailable: false,
    exceedanceAvailable: false,
    persistenceAssetIds: [] as string[],
    exceedanceAssetIds: [] as string[],
  };
}
