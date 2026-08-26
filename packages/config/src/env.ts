import { z } from "zod";

const nodeEnvSchema = z.enum(["development", "test", "production"]).default("development");

const csvList = z
  .string()
  .default("http://localhost:3000")
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );

const optionalSecret = z
  .string()
  .optional()
  .transform((value) => value?.trim() ?? "");

export const apiEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  PORT: z.coerce.number().int().positive().default(3001),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  CORS_ORIGINS: csvList,
  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().min(1).default("veinguard"),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),
  SIMULATION_SERVICE_BASE_URL: z.string().url().default("http://localhost:8000"),
  SIMULATION_SERVICE_TOKEN: z.string().min(16),
  FORTYGUARD_API_BASE_URL: z.string().url().default("https://api.fortyguard.com"),
  FORTYGUARD_API_KEY: optionalSecret,
  FORTYGUARD_POLL_INITIAL_MS: z.coerce.number().int().positive().default(2000),
  FORTYGUARD_POLL_MAX_MS: z.coerce.number().int().positive().default(15000),
  FORTYGUARD_ACTIVITY_TIMEOUT_MS: z.coerce.number().int().positive().default(600000),
  FORTYGUARD_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  FORTYGUARD_MAX_AOI_SQ_MI: z.coerce.number().positive().default(10),
  GEMINI_API_KEY_1: optionalSecret,
  GEMINI_API_KEY_2: optionalSecret,
  GEMINI_API_KEY_3: optionalSecret,
  GEMINI_API_KEY_4: optionalSecret,
  GEMINI_MODEL: z.string().min(1).default("gemini-3.6-flash"),
  GEMINI_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  AGENT_MAX_STEPS: z.coerce.number().int().positive().default(8),
  AGENT_MAX_SIMULATIONS: z.coerce.number().int().positive().default(5),
  AGENT_TIMEOUT_MS: z.coerce.number().int().positive().default(180000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export const workerEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  WORKER_HEALTH_PORT: z.coerce.number().int().positive().default(3002),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().min(1).default("veinguard"),
  REDIS_URL: z.string().min(1),
  SIMULATION_SERVICE_BASE_URL: z.string().url().default("http://localhost:8000"),
  SIMULATION_SERVICE_TOKEN: z.string().min(16),
  FORTYGUARD_API_BASE_URL: z.string().url().default("https://api.fortyguard.com"),
  FORTYGUARD_API_KEY: optionalSecret,
  GEMINI_API_KEY_1: optionalSecret,
  GEMINI_API_KEY_2: optionalSecret,
  GEMINI_API_KEY_3: optionalSecret,
  GEMINI_API_KEY_4: optionalSecret,
  GEMINI_MODEL: z.string().min(1).default("gemini-3.6-flash"),
  GEMINI_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  FORTYGUARD_POLL_INITIAL_MS: z.coerce.number().int().positive().default(2000),
  FORTYGUARD_POLL_MAX_MS: z.coerce.number().int().positive().default(15000),
  FORTYGUARD_ACTIVITY_TIMEOUT_MS: z.coerce.number().int().positive().default(600000),
  FORTYGUARD_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  FORTYGUARD_MAX_AOI_SQ_MI: z.coerce.number().positive().default(10),
  SIMULATION_QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(1),
  FORTYGUARD_QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(2),
  AGENT_QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(1),
  RESILIENCE_QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(1),
  AGENT_MAX_STEPS: z.coerce.number().int().positive().default(8),
  AGENT_MAX_SIMULATIONS: z.coerce.number().int().positive().default(5),
  AGENT_TIMEOUT_MS: z.coerce.number().int().positive().default(180000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;

function formatZodError(error: z.ZodError): string {
  return JSON.stringify(error.flatten().fieldErrors);
}

export function parseApiEnv(source: Record<string, string | undefined> = process.env): ApiEnv {
  const parsed = apiEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid API environment: ${formatZodError(parsed.error)}`);
  }
  return parsed.data;
}

export function parseWorkerEnv(
  source: Record<string, string | undefined> = process.env,
): WorkerEnv {
  const parsed = workerEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid worker environment: ${formatZodError(parsed.error)}`);
  }
  return parsed.data;
}

export function geminiApiKeys(
  env: Pick<
    ApiEnv,
    "GEMINI_API_KEY_1" | "GEMINI_API_KEY_2" | "GEMINI_API_KEY_3" | "GEMINI_API_KEY_4"
  >,
): string[] {
  return [
    env.GEMINI_API_KEY_1,
    env.GEMINI_API_KEY_2,
    env.GEMINI_API_KEY_3,
    env.GEMINI_API_KEY_4,
  ].filter((key) => key.length > 0);
}

export function providerAvailability(
  env: Pick<
    ApiEnv,
    | "FORTYGUARD_API_KEY"
    | "GEMINI_API_KEY_1"
    | "GEMINI_API_KEY_2"
    | "GEMINI_API_KEY_3"
    | "GEMINI_API_KEY_4"
  >,
): {
  fortyGuardConfigured: boolean;
  geminiConfigured: boolean;
} {
  return {
    fortyGuardConfigured: env.FORTYGUARD_API_KEY.length > 0,
    geminiConfigured: geminiApiKeys(env).length > 0,
  };
}
