import { FortyGuardClient } from "./client";
import { FortyGuardError } from "./errors";
import { productRequest } from "./fixtures";
import { planFortyGuardRequests } from "./planner";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("FortyGuardClient", () => {
  const request = planFortyGuardRequests(productRequest(), {
    now: new Date("2026-08-19T18:00:00Z"),
  }).slices[0]!.providerRequest;

  it("sends api-key and posts to /v1/heatmap", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        error: false,
        status_code: 200,
        message: "Heatmap Submitted Successfully",
        data: { activity_id: "act-1" },
      }),
    );
    const client = new FortyGuardClient({
      baseUrl: "https://api.fortyguard.com",
      apiKey: "secret-key",
      fetchImpl,
    });
    const submitted = await client.submitHeatmap(request);
    expect(submitted.data.activity_id).toBe("act-1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.fortyguard.com/v1/heatmap");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("secret-key");
    expect(init.method).toBe("POST");
  });

  it("polls GET /v1/status/{id}", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        error: false,
        status_code: 200,
        message: "Processing",
        data: { activity_id: "act-1", status: "Processing" },
      }),
    );
    const client = new FortyGuardClient({
      baseUrl: "https://api.fortyguard.com",
      apiKey: "secret-key",
      fetchImpl,
    });
    const status = await client.getStatus("act-1");
    expect(status.data.status).toBe("Processing");
    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toBe("https://api.fortyguard.com/v1/status/act-1");
  });

  it("does not retry an aborted POST", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    const fetchImpl = jest.fn().mockRejectedValue(abort);
    const client = new FortyGuardClient({
      baseUrl: "https://api.fortyguard.com",
      apiKey: "secret-key",
      fetchImpl,
    });
    await expect(client.submitHeatmap(request)).rejects.toMatchObject({
      kind: "AMBIGUOUS_POST",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects a missing API key without calling the network", async () => {
    const fetchImpl = jest.fn();
    const client = new FortyGuardClient({
      baseUrl: "https://api.fortyguard.com",
      apiKey: "",
      fetchImpl,
    });
    await expect(client.submitHeatmap(request)).rejects.toBeInstanceOf(FortyGuardError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
