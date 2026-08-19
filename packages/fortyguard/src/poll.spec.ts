import { FortyGuardClient } from "./client";
import { pollUntilTerminal } from "./poll";

describe("pollUntilTerminal", () => {
  it("returns when status is Completed", async () => {
    const client = {
      getStatus: jest
        .fn()
        .mockResolvedValueOnce({
          error: false,
          status_code: 200,
          message: "Processing",
          data: { activity_id: "a", status: "Processing" },
        })
        .mockResolvedValueOnce({
          error: false,
          status_code: 200,
          message: "Completed",
          data: {
            activity_id: "a",
            status: "Completed",
            result: { map_data: { type: "FeatureCollection", features: [] } },
          },
        }),
    } as unknown as FortyGuardClient;

    const result = await pollUntilTerminal(client, "a", {
      initialDelayMs: 1,
      maxDelayMs: 2,
      timeoutMs: 1000,
      sleep: async () => undefined,
    });
    expect(result.data.status).toBe("Completed");
    expect(client.getStatus).toHaveBeenCalledTimes(2);
  });

  it("throws on Failed", async () => {
    const client = {
      getStatus: jest.fn().mockResolvedValue({
        error: false,
        status_code: 200,
        message: "Failed",
        data: { activity_id: "a", status: "Failed" },
      }),
    } as unknown as FortyGuardClient;

    await expect(
      pollUntilTerminal(client, "a", {
        initialDelayMs: 1,
        maxDelayMs: 1,
        timeoutMs: 1000,
        sleep: async () => undefined,
      }),
    ).rejects.toMatchObject({ kind: "ACTIVITY_FAILED" });
  });

  it("times out while Processing", async () => {
    let t = 0;
    const client = {
      getStatus: jest.fn().mockResolvedValue({
        error: false,
        status_code: 200,
        message: "Processing",
        data: { activity_id: "a", status: "Processing" },
      }),
    } as unknown as FortyGuardClient;

    await expect(
      pollUntilTerminal(client, "a", {
        initialDelayMs: 5,
        maxDelayMs: 5,
        timeoutMs: 10,
        now: () => {
          t += 6;
          return t;
        },
        sleep: async () => undefined,
      }),
    ).rejects.toMatchObject({ kind: "TIMEOUT" });
  });
});
