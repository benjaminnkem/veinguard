/**
 * Opt-in live test. Consumes FortyGuard credits if the activity completes.
 * RUN_LIVE_FORTYGUARD_TESTS=true FORTYGUARD_API_KEY=... pnpm --filter @repo/fortyguard test
 */
/* eslint-disable turbo/no-undeclared-env-vars */
import { FortyGuardClient } from "./client";
import { productRequest } from "./fixtures";
import { planFortyGuardRequests } from "./planner";

const enabled =
  process.env.RUN_LIVE_FORTYGUARD_TESTS === "true" &&
  Boolean(process.env.FORTYGUARD_API_KEY);

const describeLive = enabled ? describe : describe.skip;

describeLive("FortyGuard live", () => {
  it("submits a heatmap and reads status", async () => {
    const client = new FortyGuardClient({
      baseUrl: process.env.FORTYGUARD_API_BASE_URL ?? "https://api.fortyguard.com",
      apiKey: process.env.FORTYGUARD_API_KEY ?? "",
      timeoutMs: 30_000,
    });
    const planned = planFortyGuardRequests(productRequest(), {
      now: new Date(),
    }).slices[0]!;
    const submitted = await client.submitHeatmap(planned.providerRequest);
    expect(submitted.data.activity_id.length).toBeGreaterThan(0);
    const status = await client.getStatus(submitted.data.activity_id);
    expect(["Processing", "Completed", "Failed"]).toContain(status.data.status);
  });
});
