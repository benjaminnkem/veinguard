export const GROQ_CHAT_PATH = "/openai/v1/chat/completions";
export const GROQ_API_HOST = "https://api.groq.com";
export const GROQ_PAGES_CONSULTED = [
  "https://console.groq.com/docs/models",
  "https://console.groq.com/docs/deprecations",
  "https://console.groq.com/docs/tool-use/overview",
  "https://console.groq.com/docs/tool-use/local-tool-calling",
  "https://console.groq.com/docs/structured-outputs",
  "https://console.groq.com/docs/rate-limits",
] as const;

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";

/** Shutdown 2026-08-16 for free/developer tier. Live docs win. */
export const RETIRED_GROQ_MODELS = new Set([
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "llama-3.1-70b-versatile",
  "llama-3.1-70b-specdec",
  "llama3-70b-8192",
  "llama3-8b-8192",
  "llama3-groq-8b-8192-tool-use-preview",
  "llama3-groq-70b-8192-tool-use-preview",
]);

export const DEFAULT_CONTEXT_MAX_BYTES = 24_000;
export const DEFAULT_TOOL_RESULT_MAX_BYTES = 4_000;
export const DEFAULT_RATIONALE_MAX_CHARS = 800;
