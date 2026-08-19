import { ENV_PARAMS_PATH, HEATMAP_PATH, STATUS_PATH } from "./docs";
import { FortyGuardError, safeProviderMessage } from "./errors";
import { geoJsonFeatureCollectionSchema, statusResponseSchema, submitResponseSchema } from "./schemas";
import type {
  FortyGuardEnvParamsRequest,
  FortyGuardHeatmapRequest,
  FortyGuardStatusResponse,
  FortyGuardSubmitResponse,
  GeoJsonFeatureCollection,
} from "./types";

export interface FortyGuardClientOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class FortyGuardClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: FortyGuardClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async submitHeatmap(body: FortyGuardHeatmapRequest): Promise<FortyGuardSubmitResponse> {
    if (!this.apiKey) {
      throw new FortyGuardError("UNAVAILABLE", "FortyGuard API key is not configured.");
    }
    const json = await this.request("POST", HEATMAP_PATH, body, { ambiguousOnAbort: true });
    const parsed = submitResponseSchema.safeParse(json);
    if (!parsed.success || parsed.data.error) {
      throw new FortyGuardError("RESPONSE_INVALID", "FortyGuard submit response was invalid.");
    }
    return parsed.data;
  }

  async getStatus(activityId: string): Promise<FortyGuardStatusResponse> {
    if (!this.apiKey) {
      throw new FortyGuardError("UNAVAILABLE", "FortyGuard API key is not configured.");
    }
    const json = await this.request("GET", `${STATUS_PATH}/${encodeURIComponent(activityId)}`);
    const parsed = statusResponseSchema.safeParse(json);
    if (!parsed.success || parsed.data.error) {
      throw new FortyGuardError("RESPONSE_INVALID", "FortyGuard status response was invalid.");
    }
    return parsed.data;
  }

  async submitEnvParams(body: FortyGuardEnvParamsRequest): Promise<FortyGuardSubmitResponse> {
    if (!this.apiKey) {
      throw new FortyGuardError("UNAVAILABLE", "FortyGuard API key is not configured.");
    }
    const json = await this.request("POST", ENV_PARAMS_PATH, body, { ambiguousOnAbort: true });
    const parsed = submitResponseSchema.safeParse(json);
    if (!parsed.success || parsed.data.error) {
      throw new FortyGuardError("RESPONSE_INVALID", "FortyGuard env-params response was invalid.");
    }
    return parsed.data;
  }

  completedMapData(status: FortyGuardStatusResponse): GeoJsonFeatureCollection {
    const mapData = status.data.result?.map_data;
    const parsed = geoJsonFeatureCollectionSchema.safeParse(mapData);
    if (!parsed.success) {
      throw new FortyGuardError(
        "RESPONSE_INVALID",
        "Completed FortyGuard heatmap did not include GeoJSON map_data.",
      );
    }
    return parsed.data as GeoJsonFeatureCollection;
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    options?: { ambiguousOnAbort?: boolean },
  ): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "api-key": this.apiKey,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          Accept: "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await response.text();
      let json: unknown = undefined;
      if (text.length > 0) {
        try {
          json = JSON.parse(text) as unknown;
        } catch {
          throw new FortyGuardError("RESPONSE_INVALID", "FortyGuard returned non-JSON.");
        }
      }
      if (!response.ok) {
        const kind = response.status === 400 ? "REQUEST_INVALID" : "UNAVAILABLE";
        throw new FortyGuardError(kind, safeProviderMessage(response.status, text), {
          providerStatus: response.status,
        });
      }
      return json;
    } catch (error) {
      if (error instanceof FortyGuardError) {
        throw error;
      }
      if (options?.ambiguousOnAbort && isAbort(error)) {
        throw new FortyGuardError(
          "AMBIGUOUS_POST",
          "FortyGuard POST timed out after the request may have been accepted. Not retried.",
          { cause: error },
        );
      }
      if (isAbort(error)) {
        throw new FortyGuardError("TIMEOUT", "FortyGuard request timed out.", { cause: error });
      }
      throw new FortyGuardError("UNAVAILABLE", "FortyGuard request failed.", { cause: error });
    } finally {
      clearTimeout(timer);
    }
  }
}

function isAbort(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError")
  );
}
