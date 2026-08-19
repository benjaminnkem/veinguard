import type { DataFreshness } from '@repo/contracts';
import type { ThermalAcquisition } from '@repo/fortyguard';

export function presentAcquisition(acquisition: ThermalAcquisition) {
  const slices = acquisition.slices.map((slice) => {
    const cached = Boolean(slice.snapshot);
    const freshness: DataFreshness = cached ? 'CACHED_REAL' : slice.freshness;
    return {
      requestHash: slice.requestHash,
      activityId: slice.activityId ?? slice.snapshot?.activityId ?? null,
      freshness,
      originalFreshness: slice.snapshot?.originalFreshness ?? slice.freshness,
      observationOrForecastTime: slice.observationOrForecastTime,
      fetchedAt: slice.snapshot?.fetchedAt ?? null,
      stats: slice.snapshot?.stats ?? null,
      endpoint: slice.snapshot?.endpoint ?? '/v1/heatmap',
      hasMapData: Boolean(slice.snapshot?.mapGeoJson),
      error: slice.error ?? null,
    };
  });
  const allCached =
    slices.length > 0 &&
    slices.every((slice) => slice.freshness === 'CACHED_REAL');
  return {
    acquisitionId: acquisition.id,
    status: acquisition.status,
    mode: acquisition.mode,
    freshness: allCached ? 'CACHED_REAL' : slices[0]?.freshness,
    includeSolarIrradiance: acquisition.includeSolarIrradiance,
    slices,
    error: acquisition.error ?? null,
    createdAt: acquisition.createdAt,
    updatedAt: acquisition.updatedAt,
  };
}
