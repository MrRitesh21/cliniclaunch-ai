/**
 * Validated, typed environment. Parsed exactly once at boot: a missing or
 * malformed variable must crash the process immediately rather than surface as
 * a mysterious runtime failure while a monitor reports "healthy".
 */
import { z } from "zod";

const booleanish = z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8081),
  HOST: z.string().min(1).default("0.0.0.0"),

  SERVICE_NAME: z.string().min(1).default("clinicx-observability"),
  SERVICE_VERSION: z.string().min(1).default("0.0.0"),
  BUILD_NUMBER: z.string().min(1).default("local"),
  GIT_COMMIT: z.string().min(1).default("unknown"),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  LOG_DIR: z.string().min(1).default("logs"),
  LOG_TO_FILE: booleanish.default("false"),
  LOG_ROTATION_FREQUENCY: z.enum(["hourly", "daily"]).default("daily"),
  LOG_ROTATION_MAX_FILES: z.coerce.number().int().min(1).max(90).default(7),
  LOG_ROTATION_SIZE: z
    .string()
    .regex(/^\d+[kmg]$/i)
    .default("20m"),

  /** Bearer-equivalent shared secret required to POST telemetry batches. */
  TELEMETRY_INGEST_TOKEN: z.string().min(24),
  /** Optional shared secret required to scrape /metrics. */
  METRICS_TOKEN: z.string().min(16).optional(),
  /** Comma-separated CIDR-free allow list of Prometheus source IPs (optional). */
  METRICS_ALLOWED_IPS: z.string().optional(),

  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  /** Table used for the readiness query. Must be cheap and always present. */
  READINESS_TABLE: z.string().min(1).default("plans"),

  REDIS_URL: z.string().min(1).optional(),

  /** Requests slower than this (ms) are counted as slow and logged at warn. */
  SLOW_REQUEST_MS: z.coerce.number().int().min(50).max(10_000).default(500),
  /** Dependency probe timeout (ms). */
  PROBE_TIMEOUT_MS: z.coerce.number().int().min(200).max(10_000).default(2_500),
  /** How long a dependency probe result is reused (ms). Keeps /ready cheap. */
  PROBE_CACHE_MS: z.coerce.number().int().min(0).max(120_000).default(10_000),
  /** Max accepted telemetry batch body size in bytes. */
  INGEST_MAX_BODY_BYTES: z.coerce.number().int().min(1_024).max(1_048_576).default(131_072),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    // Pre-logger failure: stderr is the only channel that exists this early.
    process.stderr.write(`Invalid observability environment:\n${issues}\n`);
    process.exit(1);
  }
  return parsed.data;
}

export const env: Env = load();

export const isProduction = env.NODE_ENV === "production";

export const metricsAllowedIps: ReadonlySet<string> = new Set(
  (env.METRICS_ALLOWED_IPS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);
