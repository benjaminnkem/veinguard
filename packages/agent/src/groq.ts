import { GROQ_API_HOST, GROQ_CHAT_PATH, RETIRED_GROQ_MODELS } from "./docs";
import { AgentError } from "./errors";
import type { GroqChatRequest, GroqChatResult, GroqClient, GroqToolCall } from "./types";

export interface GroqHttpClientOptions {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export class GroqHttpClient implements GroqClient {
  private readonly apiKey: string;
  readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(options: GroqHttpClientOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = (options.baseUrl ?? GROQ_API_HOST).replace(/\/$/, "");
  }

  assertConfigured(): void {
    if (!this.apiKey) {
      throw new AgentError("UNAVAILABLE", "Groq is not configured. The operations agent is unavailable.");
    }
    if (RETIRED_GROQ_MODELS.has(this.model)) {
      throw new AgentError(
        "UNAVAILABLE",
        `GROQ_MODEL '${this.model}' is retired. Configure a current Groq model.`,
      );
    }
  }

  async chat(request: GroqChatRequest): Promise<GroqChatResult> {
    this.assertConfigured();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${GROQ_CHAT_PATH}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          tools: request.tools,
          tool_choice: request.tool_choice ?? "auto",
          temperature: request.temperature ?? 0.2,
          max_completion_tokens: request.max_completion_tokens ?? 2048,
        }),
        signal: controller.signal,
      });
      const text = await response.text();
      if (response.status === 429) {
        throw new AgentError("RATE_LIMIT", "Groq rate-limited the request.", {
          providerStatus: 429,
        });
      }
      if (!response.ok) {
        throw new AgentError("RESPONSE_INVALID", groqHttpMessage(response.status), {
          providerStatus: response.status,
        });
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch (error) {
        throw new AgentError("RESPONSE_INVALID", "Groq returned non-JSON.", { cause: error });
      }
      return parseChatResult(parsed);
    } catch (error) {
      if (error instanceof AgentError) {
        throw error;
      }
      if (isAbort(error)) {
        throw new AgentError("TIMEOUT", "Groq request timed out.", { cause: error });
      }
      throw new AgentError("UNAVAILABLE", "Groq request failed.", { cause: error });
    } finally {
      clearTimeout(timer);
    }
  }
}

function parseChatResult(payload: unknown): GroqChatResult {
  if (!payload || typeof payload !== "object") {
    throw new AgentError("RESPONSE_INVALID", "Groq chat response was empty.");
  }
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new AgentError("RESPONSE_INVALID", "Groq chat response had no choices.");
  }
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== "object") {
    throw new AgentError("RESPONSE_INVALID", "Groq chat response had no message.");
  }
  const contentRaw = (message as { content?: unknown }).content;
  const content = typeof contentRaw === "string" ? contentRaw : null;
  const rawCalls = (message as { tool_calls?: unknown }).tool_calls;
  const toolCalls: GroqToolCall[] = [];
  if (Array.isArray(rawCalls)) {
    for (const item of rawCalls) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const id = String((item as { id?: unknown }).id ?? "");
      const fn = (item as { function?: { name?: unknown; arguments?: unknown } }).function;
      const name = String(fn?.name ?? "");
      if (!id || !name) {
        continue;
      }
      toolCalls.push({
        id,
        name,
        arguments: typeof fn?.arguments === "string" ? fn.arguments : "{}",
      });
    }
  }
  return { content, toolCalls };
}

function groqHttpMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "Groq rejected the API key.";
  }
  if (status >= 500) {
    return "Groq is unavailable.";
  }
  return `Groq returned HTTP ${status}.`;
}

function isAbort(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof error === "object" && error !== null && (error as { name?: string }).name === "AbortError")
  );
}
