import { AgentError } from "./errors";
import { GroqHttpClient } from "./groq";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GroqHttpClient", () => {
  it("posts local tool-calling chat completions with the configured model", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              role: "assistant",
              content: "ok",
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: { name: "get_baseline_summary", arguments: "{\"baselineRunId\":\"b1\"}" },
                },
              ],
            },
          },
        ],
      }),
    );
    const client = new GroqHttpClient({
      apiKey: "gsk-test",
      model: "openai/gpt-oss-20b",
      fetchImpl,
    });
    const result = await client.chat({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "user", content: "inspect" }],
      tools: [],
    });
    expect(result.toolCalls[0]?.name).toBe("get_baseline_summary");
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer gsk-test");
    const body = JSON.parse(String(init.body)) as { model: string };
    expect(body.model).toBe("openai/gpt-oss-20b");
  });

  it("maps HTTP 429 to RATE_LIMIT", async () => {
    const client = new GroqHttpClient({
      apiKey: "gsk-test",
      model: "openai/gpt-oss-20b",
      fetchImpl: jest.fn().mockResolvedValue(jsonResponse({ error: { message: "rate" } }, 429)),
    });
    await expect(
      client.chat({ model: "openai/gpt-oss-20b", messages: [], tools: [] }),
    ).rejects.toMatchObject({ kind: "RATE_LIMIT" });
  });

  it("maps abort to TIMEOUT", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    const client = new GroqHttpClient({
      apiKey: "gsk-test",
      model: "openai/gpt-oss-20b",
      fetchImpl: jest.fn().mockRejectedValue(abort),
    });
    await expect(
      client.chat({ model: "openai/gpt-oss-20b", messages: [], tools: [] }),
    ).rejects.toMatchObject({ kind: "TIMEOUT" });
  });

  it("rejects a retired model without calling the network", async () => {
    const fetchImpl = jest.fn();
    const client = new GroqHttpClient({
      apiKey: "gsk-test",
      model: "llama-3.3-70b-versatile",
      fetchImpl,
    });
    expect(() => client.assertConfigured()).toThrow(AgentError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a missing API key without calling the network", async () => {
    const fetchImpl = jest.fn();
    const client = new GroqHttpClient({
      apiKey: "",
      model: "openai/gpt-oss-20b",
      fetchImpl,
    });
    expect(() => client.assertConfigured()).toThrow(AgentError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
