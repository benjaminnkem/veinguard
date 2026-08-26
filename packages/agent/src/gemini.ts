import {
  DEFAULT_GEMINI_HTTP_TIMEOUT_MS,
  DEFAULT_GEMINI_MAX_OUTPUT_TOKENS,
  DEFAULT_GEMINI_RATE_LIMIT_COOLDOWN_MS,
  GEMINI_API_HOST,
  GEMINI_API_VERSION,
} from "./docs";
import { AgentError } from "./errors";
import type {
  GeminiChatMessage,
  GeminiChatRequest,
  GeminiChatResult,
  GeminiClient,
  GeminiToolCall,
} from "./types";

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

type GeminiPart =
  | { text: string }
  | {
      functionCall: { id?: string; name: string; args: Record<string, unknown> };
      thoughtSignature?: string;
    }
  | { functionResponse: { id?: string; name: string; response: Record<string, unknown> } };

interface GeminiResponsePayload {
  candidates?: Array<{
    content?: { parts?: unknown[] };
  }>;
  error?: {
    status?: unknown;
    message?: unknown;
    details?: unknown;
  };
}

export interface GeminiHttpClientOptions {
  apiKeys: string[];
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  rateLimitCooldownMs?: number;
}

/**
 * REST client for Gemini client-side function calling.
 *
 * A chat turn is attempted at most once per configured key. Only quota/rate
 * limit responses rotate to another key; malformed requests and auth failures
 * fail immediately because retrying them with a different credential would
 * hide a real configuration or contract error.
 */
export class GeminiHttpClient implements GeminiClient {
  private readonly apiKeys: string[];
  readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly rateLimitCooldownMs: number;
  private readonly rateLimitedUntil = new Map<number, number>();
  private nextKeyIndex = 0;

  constructor(options: GeminiHttpClientOptions) {
    this.apiKeys = [...new Set(options.apiKeys.map((key) => key.trim()).filter(Boolean))];
    this.model = options.model.trim();
    this.timeoutMs = options.timeoutMs ?? DEFAULT_GEMINI_HTTP_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = (options.baseUrl ?? GEMINI_API_HOST).replace(/\/$/, "");
    this.rateLimitCooldownMs = options.rateLimitCooldownMs ?? DEFAULT_GEMINI_RATE_LIMIT_COOLDOWN_MS;
  }

  get configuredKeyCount(): number {
    return this.apiKeys.length;
  }

  assertConfigured(): void {
    if (this.apiKeys.length === 0) {
      throw new AgentError(
        "UNAVAILABLE",
        "Gemini is not configured. The operations agent is unavailable.",
      );
    }
    if (!this.model) {
      throw new AgentError(
        "UNAVAILABLE",
        "GEMINI_MODEL is not configured. The operations agent is unavailable.",
      );
    }
  }

  async chat(request: GeminiChatRequest): Promise<GeminiChatResult> {
    this.assertConfigured();
    const indexes = this.keyIndexesForAttempt();
    let lastRateLimit: AgentError | null = null;

    for (const keyIndex of indexes) {
      try {
        const result = await this.chatWithKey(request, keyIndex);
        this.nextKeyIndex = (keyIndex + 1) % this.apiKeys.length;
        return result;
      } catch (error) {
        if (error instanceof AgentError && error.kind === "RATE_LIMIT") {
          lastRateLimit = error;
          this.rateLimitedUntil.set(
            keyIndex,
            Math.max(
              this.rateLimitedUntil.get(keyIndex) ?? 0,
              Date.now() + this.rateLimitCooldownMs,
            ),
          );
          continue;
        }
        throw error;
      }
    }

    throw (
      lastRateLimit ??
      new AgentError("RATE_LIMIT", "All configured Gemini API keys are rate-limited.", {
        providerStatus: 429,
      })
    );
  }

  private async chatWithKey(
    request: GeminiChatRequest,
    keyIndex: number,
  ): Promise<GeminiChatResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const endpoint = new URL(
        `${this.baseUrl}/${GEMINI_API_VERSION}/models/${encodeURIComponent(request.model)}:generateContent`,
      );
      endpoint.searchParams.set("key", this.apiKeys[keyIndex]!);
      const response = await this.fetchImpl(endpoint.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toGeminiRequest(request)),
        signal: controller.signal,
      });
      const text = await response.text();
      let payload: unknown;
      try {
        payload = JSON.parse(text) as unknown;
      } catch (error) {
        if (response.status === 429) {
          throw new AgentError("RATE_LIMIT", "Gemini rate-limited the request.", {
            providerStatus: response.status,
          });
        }
        throw new AgentError("RESPONSE_INVALID", "Gemini returned non-JSON.", { cause: error });
      }

      if (isRateLimited(response.status, payload)) {
        this.rateLimitedUntil.set(
          keyIndex,
          Date.now() + retryAfterMs(response.headers, this.rateLimitCooldownMs),
        );
        throw new AgentError("RATE_LIMIT", "Gemini rate-limited the request.", {
          providerStatus: response.status,
        });
      }
      if (!response.ok) {
        throw new AgentError("RESPONSE_INVALID", geminiHttpMessage(response.status), {
          providerStatus: response.status,
        });
      }
      return parseGeminiResult(payload);
    } catch (error) {
      if (error instanceof AgentError) {
        throw error;
      }
      if (isAbort(error)) {
        throw new AgentError("TIMEOUT", "Gemini request timed out.", { cause: error });
      }
      throw new AgentError("UNAVAILABLE", "Gemini request failed.", { cause: error });
    } finally {
      clearTimeout(timer);
    }
  }

  private keyIndexesForAttempt(): number[] {
    const now = Date.now();
    const startIndex = this.nextKeyIndex;
    this.nextKeyIndex = (startIndex + 1) % this.apiKeys.length;
    const indexes: number[] = [];
    for (let offset = 0; offset < this.apiKeys.length; offset += 1) {
      const index = (startIndex + offset) % this.apiKeys.length;
      const cooldownUntil = this.rateLimitedUntil.get(index) ?? 0;
      if (cooldownUntil <= now) {
        indexes.push(index);
      }
    }
    if (indexes.length > 0) {
      return indexes;
    }
    // Do not spin or sleep inside a queue processor. Make one bounded probe;
    // the provider's error is returned if every key remains exhausted.
    return [startIndex];
  }
}

function toGeminiRequest(request: GeminiChatRequest): Record<string, unknown> {
  const systemText = request.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content?.trim())
    .filter((content): content is string => Boolean(content))
    .join("\n\n");
  const contents = request.messages
    .filter((message) => message.role !== "system")
    .map(toGeminiContent)
    .filter((content): content is GeminiContent => content.parts.length > 0);

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: request.temperature ?? 0.2,
      maxOutputTokens: request.max_completion_tokens ?? DEFAULT_GEMINI_MAX_OUTPUT_TOKENS,
    },
  };
  if (systemText) {
    body.systemInstruction = { parts: [{ text: systemText }] };
  }
  if (request.tools.length > 0) {
    body.tools = request.tools;
  }
  if (request.tool_choice) {
    body.toolConfig = {
      functionCallingConfig: {
        mode: {
          auto: "AUTO",
          none: "NONE",
          required: "ANY",
        }[request.tool_choice],
      },
    };
  }
  return body;
}

function toGeminiContent(message: GeminiChatMessage): GeminiContent {
  if (message.role === "tool") {
    return {
      role: "user",
      parts: [
        {
          functionResponse: {
            id: message.tool_call_id,
            name: message.name ?? "veinguard_tool",
            response: asObject(message.content),
          },
        },
      ],
    };
  }
  if (message.role === "assistant") {
    const parts: GeminiPart[] = [];
    if (message.content) {
      parts.push({ text: message.content });
    }
    for (const call of message.tool_calls ?? []) {
      parts.push({
        functionCall: {
          id: call.id,
          name: call.function.name,
          args: asObject(call.function.arguments),
        },
        ...(call.thoughtSignature ? { thoughtSignature: call.thoughtSignature } : {}),
      });
    }
    return { role: "model", parts };
  }
  return {
    role: "user",
    parts: message.content ? [{ text: message.content }] : [],
  };
}

function parseGeminiResult(payload: unknown): GeminiChatResult {
  if (!payload || typeof payload !== "object") {
    throw new AgentError("RESPONSE_INVALID", "Gemini response was empty.");
  }
  const candidates = (payload as GeminiResponsePayload).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new AgentError("RESPONSE_INVALID", "Gemini response had no candidates.");
  }
  const parts = candidates[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    throw new AgentError("RESPONSE_INVALID", "Gemini response had no content parts.");
  }
  const textParts: string[] = [];
  const toolCalls: GeminiToolCall[] = [];
  let callIndex = 0;
  for (const part of parts) {
    if (!part || typeof part !== "object") {
      continue;
    }
    const typed = part as {
      text?: unknown;
      thought?: unknown;
      thoughtSignature?: unknown;
      functionCall?: unknown;
    };
    if (typeof typed.text === "string" && typed.thought !== true) {
      textParts.push(typed.text);
    }
    if (typed.functionCall && typeof typed.functionCall === "object") {
      const call = typed.functionCall as { id?: unknown; name?: unknown; args?: unknown };
      const name = typeof call.name === "string" ? call.name : "";
      if (!name) {
        continue;
      }
      callIndex += 1;
      toolCalls.push({
        id: typeof call.id === "string" && call.id ? call.id : `gemini-call-${callIndex}`,
        name,
        arguments: JSON.stringify(asObject(call.args)),
        ...(typeof typed.thoughtSignature === "string"
          ? { thoughtSignature: typed.thoughtSignature }
          : {}),
      });
    }
  }
  return {
    content: textParts.length > 0 ? textParts.join("\n") : null,
    toolCalls,
  };
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return asObject(JSON.parse(value) as unknown);
    } catch {
      return { output: value };
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { output: value ?? null };
  }
  return value as Record<string, unknown>;
}

function isRateLimited(status: number, payload: unknown): boolean {
  if (status === 429) {
    return true;
  }
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const error = (payload as GeminiResponsePayload).error;
  if (!error || typeof error !== "object") {
    return false;
  }
  const providerStatus = typeof error.status === "string" ? error.status.toUpperCase() : "";
  if (providerStatus === "RESOURCE_EXHAUSTED" || providerStatus === "QUOTA_EXCEEDED") {
    return true;
  }
  return (
    JSON.stringify(error.details ?? "")
      .toLowerCase()
      .match(/ratelimitexceeded|quotaexceeded/) !== null
  );
}

function retryAfterMs(headers: Headers, fallbackMs: number): number {
  const value = headers.get("retry-after");
  if (!value) {
    return fallbackMs;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, 15 * 60_000);
  }
  const timestamp = Date.parse(value);
  if (Number.isFinite(timestamp)) {
    return Math.min(Math.max(0, timestamp - Date.now()), 15 * 60_000);
  }
  return fallbackMs;
}

function geminiHttpMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "Gemini rejected the API key or request.";
  }
  if (status >= 500) {
    return "Gemini is unavailable.";
  }
  return `Gemini returned HTTP ${status}.`;
}

function isAbort(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof error === "object" &&
      error !== null &&
      (error as { name?: string }).name === "AbortError")
  );
}
