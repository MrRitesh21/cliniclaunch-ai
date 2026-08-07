/**
 * Structured logging. One Pino instance, three destinations:
 *
 *   logs/application.log — everything at LOG_LEVEL and above
 *   logs/access.log      — HTTP access records (see http-logger.ts)
 *   logs/error.log       — warn/error/fatal only, for fast incident triage
 *
 * Production writes are asynchronous (`pino.transport` runs the file writers on
 * a worker thread), so request handlers never block on disk I/O. On Render Free
 * the disk is ephemeral, so LOG_TO_FILE defaults to false and logs go to stdout
 * where the platform collects them; the file targets exist for Docker/VPS
 * deployments that mount a volume.
 *
 * `console.log` is banned across this project — this module is the only logging
 * surface.
 */
import pino, { type Logger, type LoggerOptions } from "pino";
import { env, isProduction } from "../config/env.js";

export type LogChannel = "app" | "access" | "error";

const redactPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["x-telemetry-token"]',
  'req.headers["x-metrics-token"]',
  "req.headers.apikey",
  "*.password",
  "*.token",
  "*.secret",
  "*.access_token",
  "*.refresh_token",
];

const baseOptions: LoggerOptions = {
  level: env.LOG_LEVEL,
  base: {
    service: env.SERVICE_NAME,
    version: env.SERVICE_VERSION,
    build: env.BUILD_NUMBER,
    env: env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: { paths: redactPaths, censor: "[redacted]" },
};

function fileTarget(file: string, level: string) {
  return {
    target: "pino-roll",
    level,
    options: {
      file: `${env.LOG_DIR}/${file}`,
      frequency: env.LOG_ROTATION_FREQUENCY,
      size: env.LOG_ROTATION_SIZE,
      limit: { count: env.LOG_ROTATION_MAX_FILES },
      mkdir: true,
      extension: ".log",
    },
  };
}

function buildLogger(): Logger {
  if (!env.LOG_TO_FILE) {
    // stdout only. In production this stays raw JSON (no pretty transport, no
    // extra worker thread, no extra RAM).
    return pino(
      baseOptions,
      isProduction ? pino.destination({ sync: false }) : pino.destination({ sync: true }),
    );
  }

  const transport = pino.transport({
    targets: [
      { target: "pino/file", level: env.LOG_LEVEL, options: { destination: 1 } },
      fileTarget("application", env.LOG_LEVEL),
      fileTarget("error", "warn"),
    ],
  });
  return pino(baseOptions, transport);
}

export const logger: Logger = buildLogger();

/**
 * Access log stream. Kept separate so `logs/access.log` contains only request
 * records and stays cheap to grep/ship.
 */
export const accessLogger: Logger = env.LOG_TO_FILE
  ? pino(
      { ...baseOptions, level: "info" },
      pino.transport({
        targets: [
          { target: "pino/file", level: "info", options: { destination: 1 } },
          fileTarget("access", "info"),
        ],
      }),
    )
  : logger.child({ channel: "access" });

export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}

/** Flush pending async writes before the process exits. */
export function flushLogs(): void {
  logger.flush?.();
  accessLogger.flush?.();
}
