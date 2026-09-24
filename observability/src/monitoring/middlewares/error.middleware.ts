/**
 * Terminal error handler. Records an error metric, logs with full request
 * correlation, and returns a body that never leaks internals in production.
 */
import type { NextFunction, Request, Response } from "express";
import { HTTP_STATUS } from "../../config/constants.js";
import { env, isProduction } from "../../config/env.js";
import { logger } from "../../logging/logger.js";
import { routeTemplate } from "../../utils/http.js";
import { currentContext } from "../context/request-context.js";
import { telemetry } from "../telemetry/prometheus-telemetry.js";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly kind = "http_error",
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function notFoundHandler() {
  return (_req: Request, res: Response): void => {
    res.status(HTTP_STATUS.notFound).json({ error: "not_found" });
  };
}

export function errorHandler() {
  return (err: unknown, req: Request, res: Response, next: NextFunction): void => {
    if (res.headersSent) {
      next(err);
      return;
    }

    const httpError = err instanceof HttpError ? err : null;
    const status = httpError?.status ?? HTTP_STATUS.serverError;
    const kind = httpError?.kind ?? (err instanceof Error ? err.name : "unknown_error");
    const ctx = currentContext();

    telemetry.recordError(kind, routeTemplate(req), env.SERVICE_NAME);

    logger.error(
      {
        request_id: ctx?.requestId,
        method: req.method,
        url: ctx?.url ?? req.originalUrl,
        status,
        kind,
        err:
          err instanceof Error
            ? { message: err.message, stack: err.stack }
            : { value: String(err) },
      },
      "unhandled request error",
    );

    res.status(status).json({
      error: kind,
      message:
        isProduction && status >= 500 ? "internal_error" : ((err as Error)?.message ?? "error"),
      request_id: ctx?.requestId,
    });
  };
}
