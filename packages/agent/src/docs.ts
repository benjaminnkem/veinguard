export const GEMINI_API_HOST = "https://generativelanguage.googleapis.com";
export const GEMINI_API_VERSION = "v1beta";
export const GEMINI_PAGES_CONSULTED = [
  "https://ai.google.dev/api/generate-content",
  "https://ai.google.dev/gemini-api/docs/function-calling",
  "https://ai.google.dev/gemini-api/docs/models",
  "https://ai.google.dev/gemini-api/docs/rate-limits",
  "https://ai.google.dev/gemini-api/docs/deprecations",
] as const;

export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";
export const DEFAULT_GEMINI_RATE_LIMIT_COOLDOWN_MS = 60_000;
export const DEFAULT_GEMINI_HTTP_TIMEOUT_MS = 60_000;
export const DEFAULT_GEMINI_MAX_OUTPUT_TOKENS = 768;

export const DEFAULT_CONTEXT_MAX_BYTES = 24_000;
export const DEFAULT_TOOL_RESULT_MAX_BYTES = 4_000;
export const DEFAULT_RATIONALE_MAX_CHARS = 800;
