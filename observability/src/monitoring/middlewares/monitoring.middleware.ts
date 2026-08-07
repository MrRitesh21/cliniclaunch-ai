/**
 * The monitoring middleware: one `res.on('finish')` hook that produces both the
 * structured access log record and every HTTP Prometheus series.
 *
 * Cost per request: one hrtime pair, one gauge inc/dec, three metric updates and
 * one JSON log line written asynchronously. No awaits, no cloning of bodies,
 * nothing that can slow a handler.
 */
import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env.js";
import { accessLogger } from "../../logging/logger.js";
import { responseBytes, routeTemplate } from "../../utils/http.js";
import { startTimer } from "../../utils/timing.js";
import { currentContext } from "../context/request-context.js";
import { telemetry } from "../telemetry/prometheus-telemetry.js";

export interface MonitoringOptions {
  /** Label identifying which runtime produced the sample. */
  source?: string;
  /** Paths excluded from metrics + access logs (e.g. /ping, /metrics). */
  ignorePaths?: readonly string[];
  /** Paths that get a minimal access log line and no metrics (e.g. /ping). */
  minimalPaths?: readonly string[];
}

export function monitoringMiddleware(options: MonitoringOptions = {}) {
  const source = options.source ?? env.SERVICE_NAME;
  const ignore = new Set(options.ignorePaths ?? []);
  const minimal = new Set(options.minimalPaths ?? []);

  return (req: Request, res: Response, next: NextFunction): void => {
    const path = req.path;
    if (ignore.has(path)) {
      next();
      return;
    }

    if (minimal.has(path)) {
      // Cheapest possible path: one log line, no metrics, no gauges.
      res.on("finish", () => {
        accessLogger.info(
          { method: req.method, url: path, status: res.statusCode, minimal: true },
          "access",
        );
      });
      next();
      return;
    }

    const stop = startTimer();
    telemetry.incrementInFlight(source);

    res.on("finish", () => {
      const durationMs = stop();
      telemetry.decrementInFlight(source);

      const route = routeTemplate(req);
      const slow = durationMs >= env.SLOW_REQUEST_MS;
      const bytes = responseBytes(res.getHeader("content-length"));

      telemetry.recordHttpRequest({
        method: req.method,
        route,
        status: res.statusCode,
        durationMs,
        responseBytes: bytes,
        slow,
        source,
      });

      const ctx = currentContext();
      const record = {
        request_id: ctx?.requestId,
        method: req.method,
        url: ctx?.url ?? req.originalUrl,
        route,
        status: res.statusCode,
        duration: Math.round(durationMs * 100) / 100,
        bytes,
        ip: ctx?.ip,
        user_agent: ctx?.userAgent,
        tenant_id: ctx?.tenantId,
        user_id: ctx?.userId,
        slow,
      };

      if (res.statusCode >= 500) accessLogger.error(record, "request failed");
      else if (slow || res.statusCode >= 400) accessLogger.warn(record, "access");
      else accessLogger.info(record, "access");
    });

    // A client abort never fires 'finish'; release the concurrency gauge so it
    // cannot drift upward forever and trip a false saturation alert.
    res.on("close", () => {
      if (!res.writableEnded) {
        telemetry.decrementInFlight(source);
        telemetry.recordError("client_abort", routeTemplate(req), source);
      }
    });

    next();
  };
}
