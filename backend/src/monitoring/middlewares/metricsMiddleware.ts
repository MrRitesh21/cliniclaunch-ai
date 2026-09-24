import { Request, Response, NextFunction } from "express";
import {
  httpRequestsTotal,
  httpRequestDurationSeconds,
  httpResponseSizeBytes,
  httpConcurrentRequests,
  httpSlowRequestsTotal,
  httpErrorsTotal,
} from "../metrics/httpMetrics";
import { config } from "../../config";

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Exclude /metrics and /ping endpoints from regular metrics collection to prevent pollution
  if (req.path === "/metrics" || req.path === "/ping") {
    return next();
  }

  const startTime = process.hrtime();
  httpConcurrentRequests.inc();

  // Normalize route path for metrics labeling to avoid high cardinality
  const route = req.route ? req.route.path : req.path || "unmatched";

  res.on("finish", () => {
    httpConcurrentRequests.dec();

    const diff = process.hrtime(startTime);
    const durationSec = diff[0] + diff[1] / 1e9;
    const durationMs = durationSec * 1000;

    const status = res.statusCode.toString();
    const statusClass = `${status.charAt(0)}xx`;

    // 1. Record HTTP Request Count
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status,
      status_class: statusClass,
    });

    // 2. Record HTTP Request Duration
    httpRequestDurationSeconds.observe(
      {
        method: req.method,
        route,
        status,
      },
      durationSec,
    );

    // 3. Record Response Size
    const contentLength = res.getHeader("content-length");
    if (contentLength) {
      const sizeBytes = parseInt(String(contentLength), 10);
      if (!isNaN(sizeBytes)) {
        httpResponseSizeBytes.observe({ method: req.method, route }, sizeBytes);
      }
    }

    // 4. Record Slow Requests (>500ms)
    if (durationMs > config.slowRequestThresholdMs) {
      httpSlowRequestsTotal.inc({
        method: req.method,
        route,
      });
    }

    // 5. Record Errors (4xx, 5xx)
    if (res.statusCode >= 400) {
      const errorType = res.statusCode >= 500 ? "5xx" : "4xx";
      httpErrorsTotal.inc({
        method: req.method,
        route,
        error_type: errorType,
      });
    }
  });

  next();
}
