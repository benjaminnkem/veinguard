import type { FortyGuardClient } from "./client";
import { FortyGuardError } from "./errors";
import type { FortyGuardStatusResponse } from "./types";

export interface PollOptions {
  initialDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export async function pollUntilTerminal(
  client: FortyGuardClient,
  activityId: string,
  options: PollOptions,
): Promise<FortyGuardStatusResponse> {
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const deadline = now() + options.timeoutMs;
  let delay = options.initialDelayMs;

  while (now() < deadline) {
    const status = await client.getStatus(activityId);
    if (status.data.status === "Completed") {
      return status;
    }
    if (status.data.status === "Failed") {
      throw new FortyGuardError("ACTIVITY_FAILED", "FortyGuard activity Failed.");
    }
    const remaining = deadline - now();
    if (remaining <= 0) {
      break;
    }
    await sleep(Math.min(delay, remaining, options.maxDelayMs));
    delay = Math.min(delay * 2, options.maxDelayMs);
  }

  throw new FortyGuardError("TIMEOUT", "FortyGuard activity polling timed out.");
}
