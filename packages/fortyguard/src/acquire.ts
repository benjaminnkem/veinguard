import type { FortyGuardClient } from "./client";
import { HEATMAP_NORMALIZATION_VERSION, HEATMAP_PATH } from "./docs";
import { FortyGuardError } from "./errors";
import { pollUntilTerminal, type PollOptions } from "./poll";
import { normalizeStats } from "./stats";
import type { ThermalStore } from "./store";
import type { CachedCompleted, ThermalAcquisition } from "./types";

export async function runAcquisitionSlice(input: {
  acquisition: ThermalAcquisition;
  sliceIndex: number;
  client: FortyGuardClient;
  store: ThermalStore;
  poll: PollOptions;
}): Promise<ThermalAcquisition> {
  const { client, store, poll } = input;
  const acquisition = structuredClone(input.acquisition);
  const slice = acquisition.slices[input.sliceIndex];
  if (!slice) {
    throw new FortyGuardError("REQUEST_INVALID", "Unknown acquisition slice.");
  }

  const cached = await store.getCache(slice.requestHash);
  if (cached) {
    slice.snapshot = cached;
    slice.activityId = cached.activityId;
    await store.replaceAcquisition(stamp(acquisition));
    return acquisition;
  }

  if (!slice.activityId) {
    const submitted = await client.submitHeatmap(slice.providerRequest);
    slice.activityId = submitted.data.activity_id;
    acquisition.status = "RUNNING";
    await store.replaceAcquisition(stamp(acquisition));
  }

  const status = await pollUntilTerminal(client, slice.activityId, poll);
  const mapGeoJson = client.completedMapData(status);
  const completed: CachedCompleted = {
    requestHash: slice.requestHash,
    endpoint: HEATMAP_PATH,
    providerRequest: slice.providerRequest,
    activityId: status.data.activity_id,
    fetchedAt: new Date().toISOString(),
    observationOrForecastTime: slice.observationOrForecastTime,
    originalFreshness: slice.freshness,
    rawResponse: status,
    mapGeoJson,
    stats: normalizeStats(status.data.result?.stats_data, slice.providerRequest.analytic_type),
    normalizationVersion: HEATMAP_NORMALIZATION_VERSION,
  };
  await store.putCache(completed);
  slice.snapshot = completed;
  await store.replaceAcquisition(stamp(acquisition));
  return acquisition;
}

export async function maybeFetchSolar(input: {
  acquisition: ThermalAcquisition;
  client: FortyGuardClient;
  store: ThermalStore;
  poll: PollOptions;
}): Promise<ThermalAcquisition> {
  const acquisition = structuredClone(input.acquisition);
  if (!acquisition.includeSolarIrradiance || acquisition.solar || !acquisition.centroid) {
    return acquisition;
  }
  const slice = acquisition.slices.find((item) => item.snapshot);
  const temperature = slice?.snapshot?.stats.mean;
  if (slice?.snapshot === undefined || temperature === undefined || !slice.providerRequest.date_time) {
    return acquisition;
  }
  const submitted = await input.client.submitEnvParams({
    latitude: acquisition.centroid.latitude,
    longitude: acquisition.centroid.longitude,
    temperature,
    date_time: slice.providerRequest.date_time,
    analysis: ["solar_irradiance"],
  });
  const status = await pollUntilTerminal(input.client, submitted.data.activity_id, input.poll);
  acquisition.solar = status.data.result ?? status;
  await input.store.replaceAcquisition(stamp(acquisition));
  return acquisition;
}

export function summarizeAcquisition(acquisition: ThermalAcquisition): ThermalAcquisition {
  const next = structuredClone(acquisition);
  const total = next.slices.length;
  const done = next.slices.filter((slice) => slice.snapshot).length;
  const failed = next.slices.filter((slice) => slice.error).length;
  if (failed > 0 && done > 0) {
    next.status = "PARTIAL";
  } else if (failed > 0) {
    next.status = "FAILED";
  } else if (done === total) {
    next.status = "SUCCEEDED";
  } else if (next.slices.some((slice) => slice.activityId)) {
    next.status = "RUNNING";
  }
  return stamp(next);
}

function stamp(acquisition: ThermalAcquisition): ThermalAcquisition {
  return { ...acquisition, updatedAt: new Date().toISOString() };
}
