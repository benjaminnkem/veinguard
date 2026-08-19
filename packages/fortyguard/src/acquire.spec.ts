import { runAcquisitionSlice, summarizeAcquisition } from "./acquire";
import type { FortyGuardClient } from "./client";
import { HEATMAP_PATH } from "./docs";
import { productRequest } from "./fixtures";
import { planFortyGuardRequests } from "./planner";
import { MemoryThermalStore, newAcquisitionId } from "./store";
import type { CachedCompleted, ThermalAcquisition } from "./types";

describe("runAcquisitionSlice", () => {
  const now = new Date("2026-08-19T18:00:00Z");

  function makeAcquisition(): ThermalAcquisition {
    const plan = planFortyGuardRequests(productRequest(), { now });
    const created = new Date().toISOString();
    return {
      id: newAcquisitionId(),
      status: "QUEUED",
      mode: "HISTORICAL",
      productRequest: productRequest(),
      slices: plan.slices.map((slice) => ({
        requestHash: slice.requestHash,
        providerRequest: slice.providerRequest,
        freshness: slice.freshness,
        observationOrForecastTime: slice.observationOrForecastTime,
      })),
      includeSolarIrradiance: false,
      correlationId: "cid",
      createdAt: created,
      updatedAt: created,
    };
  }

  it("serves a completed cache hit without posting", async () => {
    const acquisition = makeAcquisition();
    const store = new MemoryThermalStore();
    const slice = acquisition.slices[0]!;
    const cached: CachedCompleted = {
      requestHash: slice.requestHash,
      endpoint: HEATMAP_PATH,
      providerRequest: slice.providerRequest,
      activityId: "cached-act",
      fetchedAt: "2026-08-01T00:00:00.000Z",
      observationOrForecastTime: slice.observationOrForecastTime,
      originalFreshness: "HISTORICAL",
      rawResponse: { cached: true },
      mapGeoJson: { type: "FeatureCollection", features: [] },
      stats: { units: "°C", min: 20, max: 30, mean: 25 },
      normalizationVersion: "fortyguard-heatmap-v1",
    };
    await store.putCache(cached);
    const client = {
      submitHeatmap: jest.fn(),
      getStatus: jest.fn(),
    } as unknown as FortyGuardClient;

    const result = await runAcquisitionSlice({
      acquisition,
      sliceIndex: 0,
      client,
      store,
      poll: { initialDelayMs: 1, maxDelayMs: 1, timeoutMs: 10, sleep: async () => undefined },
    });
    expect(client.submitHeatmap).not.toHaveBeenCalled();
    expect(result.slices[0]?.snapshot?.activityId).toBe("cached-act");
  });

  it("posts once, persists activity_id, then records completed result", async () => {
    const acquisition = makeAcquisition();
    const store = new MemoryThermalStore();
    await store.createAcquisition(acquisition);
    const map = { type: "FeatureCollection", features: [] };
    const client = {
      submitHeatmap: jest.fn().mockResolvedValue({
        error: false,
        status_code: 200,
        message: "Heatmap Submitted Successfully",
        data: { activity_id: "act-9" },
      }),
      getStatus: jest.fn().mockResolvedValue({
        error: false,
        status_code: 200,
        message: "Completed",
        data: {
          activity_id: "act-9",
          status: "Completed",
          result: {
            map_data: map,
            stats_data: { Temperature_stats: { Minimum: 21, Maximum: 33, Mean: 27 } },
          },
        },
      }),
      completedMapData: jest.fn().mockReturnValue(map),
    } as unknown as FortyGuardClient;

    const result = summarizeAcquisition(
      await runAcquisitionSlice({
        acquisition,
        sliceIndex: 0,
        client,
        store,
        poll: { initialDelayMs: 1, maxDelayMs: 1, timeoutMs: 50, sleep: async () => undefined },
      }),
    );
    expect(client.submitHeatmap).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("SUCCEEDED");
    expect(result.slices[0]?.activityId).toBe("act-9");
    const cached = await store.getCache(result.slices[0]!.requestHash);
    expect(cached?.stats.min).toBe(21);
    expect(cached?.rawResponse).toBeDefined();
  });
});
