import { AgentError } from "./errors";
import { GeminiHttpClient } from "./gemini";

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("GeminiHttpClient", () => {
  it("posts generateContent with Gemini contents, tools, and function calling config", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [
                { text: "Inspecting the baseline." },
                {
                  functionCall: {
                    id: "call_1",
                    name: "get_baseline_summary",
                    args: { baselineRunId: "b1" },
                  },
                  thoughtSignature: "opaque-signature",
                },
              ],
            },
          },
        ],
      }),
    );
    const client = new GeminiHttpClient({
      apiKeys: ["gemini-key-1"],
      model: "gemini-3.6-flash",
      fetchImpl,
    });
    const result = await client.chat({
      model: "gemini-3.6-flash",
      messages: [
        { role: "system", content: "You are VeinGuard." },
        { role: "user", content: "inspect" },
      ],
      tools: [
        {
          functionDeclarations: [
            {
              name: "get_baseline_summary",
              description: "Read the baseline.",
              parameters: { type: "object" },
            },
          ],
        },
      ],
      tool_choice: "auto",
    });

    expect(result).toEqual({
      content: "Inspecting the baseline.",
      toolCalls: [
        {
          id: "call_1",
          name: "get_baseline_summary",
          arguments: '{"baselineRunId":"b1"}',
          thoughtSignature: "opaque-signature",
        },
      ],
    });
    const [rawUrl, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const url = new URL(rawUrl);
    expect(url.origin + url.pathname).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
    );
    expect(url.searchParams.get("key")).toBe("gemini-key-1");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.systemInstruction).toEqual({ parts: [{ text: "You are VeinGuard." }] });
    expect(body.contents).toEqual([{ role: "user", parts: [{ text: "inspect" }] }]);
    expect(body.generationConfig).toEqual({ temperature: 0.2, maxOutputTokens: 768 });
    expect(body.tools).toEqual([
      {
        functionDeclarations: [
          {
            name: "get_baseline_summary",
            description: "Read the baseline.",
            parameters: { type: "object" },
          },
        ],
      },
    ]);
    expect(body.toolConfig).toEqual({ functionCallingConfig: { mode: "AUTO" } });
  });

  it("falls through to the next key on RESOURCE_EXHAUSTED", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: { status: "RESOURCE_EXHAUSTED" } }, 429, { "Retry-After": "60" }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }),
      );
    const client = new GeminiHttpClient({
      apiKeys: ["key-1", "key-2", "key-3", "key-4"],
      model: "gemini-3.6-flash",
      fetchImpl,
      rateLimitCooldownMs: 60_000,
    });

    await expect(
      client.chat({
        model: "gemini-3.6-flash",
        messages: [{ role: "user", content: "hi" }],
        tools: [],
      }),
    ).resolves.toEqual({ content: "ok", toolCalls: [] });

    const urls = fetchImpl.mock.calls.map(([rawUrl]) =>
      new URL(String(rawUrl)).searchParams.get("key"),
    );
    expect(urls).toEqual(["key-1", "key-2"]);
  });

  it("attempts every key once and returns RATE_LIMIT when all keys are exhausted", async () => {
    const fetchImpl = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(jsonResponse({ error: { status: "RESOURCE_EXHAUSTED" } }, 429)),
      );
    const client = new GeminiHttpClient({
      apiKeys: ["key-1", "key-2", "key-3", "key-4"],
      model: "gemini-3.6-flash",
      fetchImpl,
      rateLimitCooldownMs: 60_000,
    });

    await expect(
      client.chat({ model: "gemini-3.6-flash", messages: [], tools: [] }),
    ).rejects.toMatchObject({ kind: "RATE_LIMIT", providerStatus: 429 });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("does not hide a non-rate-limit provider error behind key rotation", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ error: {} }, 400));
    const client = new GeminiHttpClient({
      apiKeys: ["key-1", "key-2"],
      model: "gemini-3.6-flash",
      fetchImpl,
    });

    await expect(
      client.chat({ model: "gemini-3.6-flash", messages: [], tools: [] }),
    ).rejects.toMatchObject({ kind: "RESPONSE_INVALID", providerStatus: 400 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("maps abort to TIMEOUT", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    const client = new GeminiHttpClient({
      apiKeys: ["key-1"],
      model: "gemini-3.6-flash",
      fetchImpl: jest.fn().mockRejectedValue(abort),
    });

    await expect(
      client.chat({ model: "gemini-3.6-flash", messages: [], tools: [] }),
    ).rejects.toMatchObject({ kind: "TIMEOUT" });
  });

  it("rejects missing keys without calling the network", async () => {
    const fetchImpl = jest.fn();
    const client = new GeminiHttpClient({
      apiKeys: ["", "  "],
      model: "gemini-3.6-flash",
      fetchImpl,
    });

    expect(() => client.assertConfigured()).toThrow(AgentError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
