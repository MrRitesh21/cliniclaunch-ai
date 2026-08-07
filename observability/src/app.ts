/**
 * Express application assembly. Order is intentional:
 *
 *   1. /ping is mounted BEFORE any middleware so it stays a sub-millisecond,
 *      zero-dependency endpoint for external cron monitors.
 *   2. request context (correlation id)
 *   3. monitoring middleware (metrics + access log)
 *   4. feature routers
 *   5. 404 + error handler last
 */
import express, { type Express } from "express";
import { HTTP_STATUS, Route } from "./config/constants.js";
import { env } from "./config/env.js";
import { healthRouter } from "./health/health.routes.js";
import { errorHandler, notFoundHandler } from "./monitoring/middlewares/error.middleware.js";
import { monitoringMiddleware } from "./monitoring/middlewares/monitoring.middleware.js";
import { requestContextMiddleware } from "./monitoring/middlewares/request-context.middleware.js";
import { ingestRouter } from "./monitoring/routes/ingest.routes.js";
import { metricsRouter } from "./monitoring/routes/metrics.routes.js";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("etag", false);
  // Render/Cloudflare terminate TLS; trust one proxy hop so req.ip and
  // X-Forwarded-For are meaningful without accepting spoofed chains.
  app.set("trust proxy", 1);

  // (1) Fast path — before context, metrics and logging middleware.
  app.get(Route.ping, (_req, res) => {
    res
      .status(HTTP_STATUS.ok)
      .type("application/json")
      .set("Cache-Control", "no-store, max-age=0")
      .send(`{"success":true,"timestamp":"${new Date().toISOString()}"}`);
  });

  // (2) + (3)
  app.use(requestContextMiddleware());
  app.use(
    monitoringMiddleware({
      source: env.SERVICE_NAME,
      // Scraping and liveness traffic must not distort latency/traffic panels.
      ignorePaths: [Route.metrics, Route.live],
      minimalPaths: [Route.ping],
    }),
  );

  // (4)
  app.use(metricsRouter());
  app.use(healthRouter());
  app.use(ingestRouter());

  app.get("/", (_req, res) => {
    res.status(HTTP_STATUS.ok).json({
      service: env.SERVICE_NAME,
      version: env.SERVICE_VERSION,
      build: env.BUILD_NUMBER,
      endpoints: [Route.metrics, Route.health, Route.ready, Route.live, Route.ping],
    });
  });

  // (5)
  app.use(notFoundHandler());
  app.use(errorHandler());

  return app;
}
