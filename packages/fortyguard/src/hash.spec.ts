import { productRequest } from "./fixtures";
import { hashHeatmapRequest } from "./hash";
import { planFortyGuardRequests } from "./planner";

describe("hashHeatmapRequest", () => {
  const now = new Date("2026-08-19T18:00:00Z");

  it("is stable across key order", () => {
    const planned = planFortyGuardRequests(productRequest(), { now }).slices[0];
    expect(planned).toBeDefined();
    const a = planned!.providerRequest;
    const b = {
      granularity: a.granularity,
      analytic_type: a.analytic_type,
      date_time: a.date_time,
      polygon_aoi: a.polygon_aoi,
    };
    expect(hashHeatmapRequest(a)).toBe(hashHeatmapRequest(b));
  });

  it("changes when granularity changes", () => {
    const a = planFortyGuardRequests(productRequest({ granularityMeters: 100 }), { now })
      .slices[0]!;
    const b = planFortyGuardRequests(productRequest({ granularityMeters: 60 }), { now })
      .slices[0]!;
    expect(a.requestHash).not.toBe(b.requestHash);
  });
});
