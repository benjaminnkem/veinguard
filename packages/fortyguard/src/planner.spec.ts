import { FortyGuardError } from "./errors";
import { NYC_BLOCK, productRequest } from "./fixtures";
import { planFortyGuardRequests } from "./planner";

describe("planFortyGuardRequests", () => {
  const now = new Date("2026-08-19T18:00:00Z");

  it("maps a single hour to filter_type 1", () => {
    const plan = planFortyGuardRequests(productRequest(), { now });
    expect(plan.slices).toHaveLength(1);
    expect(plan.slices[0]?.providerRequest.date_time).toEqual({
      start_date: "2024-07-15",
      filter_type: 1,
      start_time: "14:00",
    });
    expect(plan.slices[0]?.providerRequest.granularity).toBe(100);
    expect(plan.slices[0]?.providerRequest.analytic_type).toBe("tcm");
    expect(plan.slices[0]?.freshness).toBe("HISTORICAL");
  });

  it("maps a same-day hour range to filter_type 2", () => {
    const plan = planFortyGuardRequests(
      productRequest({
        time: {
          start: "2024-07-15T06:00:00-04:00",
          end: "2024-07-15T18:00:00-04:00",
        },
      }),
      { now },
    );
    expect(plan.slices).toHaveLength(1);
    expect(plan.slices[0]?.providerRequest.date_time).toEqual({
      start_date: "2024-07-15",
      filter_type: 2,
      start_time: "06:00",
      end_time: "18:00",
    });
  });

  it("maps a full local day to filter_type 3", () => {
    const plan = planFortyGuardRequests(
      productRequest({
        time: {
          start: "2024-07-15T00:00:00-04:00",
          end: "2024-07-16T00:00:00-04:00",
        },
      }),
      { now },
    );
    expect(plan.slices).toHaveLength(1);
    expect(plan.slices[0]?.providerRequest.date_time).toEqual({
      start_date: "2024-07-15",
      filter_type: 3,
    });
  });

  it("splits a cross-midnight window into same-day requests", () => {
    const plan = planFortyGuardRequests(
      productRequest({
        time: {
          start: "2024-07-15T22:00:00-04:00",
          end: "2024-07-16T02:00:00-04:00",
        },
      }),
      { now },
    );
    const filters = plan.slices.map((slice) => slice.providerRequest.date_time);
    expect(filters).toEqual([
      {
        start_date: "2024-07-15",
        filter_type: 2,
        start_time: "22:00",
        end_time: "23:00",
      },
      { start_date: "2024-07-15", filter_type: 1, start_time: "23:00" },
      {
        start_date: "2024-07-16",
        filter_type: 2,
        start_time: "00:00",
        end_time: "02:00",
      },
    ]);
    expect(filters.every((item) => item.filter_type !== 4)).toBe(true);
  });

  it("rejects times before 2019-01-01", () => {
    expect(() =>
      planFortyGuardRequests(
        productRequest({
          time: {
            start: "2018-12-31T23:00:00-05:00",
            end: "2019-01-01T00:00:00-05:00",
          },
        }),
        { now },
      ),
    ).toThrow(FortyGuardError);
  });

  it("rejects forecast more than 12 hours ahead", () => {
    expect(() =>
      planFortyGuardRequests(
        productRequest({
          mode: "FORECAST",
          time: {
            start: "2026-08-20T12:00:00Z",
            end: "2026-08-20T13:00:00Z",
          },
        }),
        { now },
      ),
    ).toThrow(/12h/);
  });

  it("rejects invalid granularity", () => {
    expect(() =>
      planFortyGuardRequests(
        productRequest({ granularityMeters: 50 as 60 }),
        { now },
      ),
    ).toThrow(/60, 80, or 100/);
  });

  it("rejects a non-US AOI", () => {
    expect(() =>
      planFortyGuardRequests(
        productRequest({
          aoi: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "Polygon",
                  coordinates: [
                    [
                      [2.29, 48.85],
                      [2.3, 48.85],
                      [2.3, 48.86],
                      [2.29, 48.86],
                      [2.29, 48.85],
                    ],
                  ],
                },
              },
            ],
          },
        }),
        { now },
      ),
    ).toThrow(/United States/);
  });

  it("rejects an unclosed polygon", () => {
    const aoi = structuredClone(NYC_BLOCK);
    aoi.features[0]?.geometry.coordinates[0]?.pop();
    expect(() => planFortyGuardRequests(productRequest({ aoi }), { now })).toThrow(/closed/);
  });

  it("requires threshold for exceedance", () => {
    expect(() =>
      planFortyGuardRequests(productRequest({ analytics: ["EXCEEDANCE"] }), { now }),
    ).toThrow(/thresholdC/);
  });

  it("does not emit filter_type 4", () => {
    const plan = planFortyGuardRequests(
      productRequest({
        time: {
          start: "2024-07-15T00:00:00-04:00",
          end: "2024-07-17T00:00:00-04:00",
        },
      }),
      { now },
    );
    expect(plan.slices.every((slice) => slice.providerRequest.date_time.filter_type !== 4)).toBe(
      true,
    );
    expect(plan.slices).toHaveLength(2);
  });
});
