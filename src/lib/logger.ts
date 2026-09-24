/**
 * Enterprise Structured Logger for ClinicX
 * Handles JSON structured logging, log severity filtering, and error trace capture.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private isProd = typeof process !== "undefined" && process.env?.NODE_ENV === "production";

  private format(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    err?: Error,
  ): LogPayload {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(context && { context }),
      ...(err && {
        error: {
          name: err.name,
          message: err.message,
          stack: err.stack,
        },
      }),
    };
  }

  debug(message: string, context?: Record<string, unknown>) {
    if (!this.isProd) {
      console.debug(`[DEBUG] ${message}`, context ?? "");
    }
  }

  info(message: string, context?: Record<string, unknown>) {
    console.info(`[INFO] ${message}`, context ?? "");
  }

  warn(message: string, context?: Record<string, unknown>) {
    console.warn(`[WARN] ${message}`, context ?? "");
  }

  error(message: string, err?: Error, context?: Record<string, unknown>) {
    const payload = this.format("error", message, context, err);
    console.error(`[ERROR] ${message}`, payload);
  }
}

export const logger = new Logger();
