/**
 * Health probes. Four endpoints with deliberately different costs:
 *
 *   /ping   — no auth, no deps, no middleware, sub-millisecond. Cron monitors.
 *   /live   — process liveness only. Container restart signal.
 *   /health — static shape, no dependency I/O. Render health check.
 *   /ready  — database + Supabase + Redis. Load-balancer drain signal.
 */
import { Router } from "express";
import { HTTP_STATUS, Route } from "../config/constants.js";
import { env } from "../config/env.js";
import { readiness } from "./health.service.js";

const NO_STORE = "no-store, max-age=0";

export function healthRouter(): Router {
  const router = Router();

  // Registered first and answered with a pre-serialised body: zero JSON work,
  // zero property lookups beyond the timestamp.
  router.get(Route.ping, (_req, res) => {
    res
      .status(HTTP_STATUS.ok)
      .type("application/json")
      .set("Cache-Control", NO_STORE)
      .send(`{"success":true,"timestamp":"${new Date().toISOString()}"}`);
  });

  router.get(Route.live, (_req, res) => {
    res.status(HTTP_STATUS.ok).set("Cache-Control", NO_STORE).json({
      status: "alive",
      pid: process.pid,
      uptime_s: Math.round(process.uptime()),
    });
  });

  router.get(Route.health, (_req, res) => {
    res.status(HTTP_STATUS.ok).set("Cache-Control", NO_STORE).json({
      status: "healthy",
      time: new Date().toISOString(),
    });
  });

  router.get(Route.ready, async (_req, res, next) => {
    try {
      const report = await readiness();
      res
        .status(report.ready ? HTTP_STATUS.ok : HTTP_STATUS.serviceUnavailable)
        .set("Cache-Control", NO_STORE)
        .json({
          status: report.ready ? "ready" : "not_ready",
          time: new Date().toISOString(),
          version: env.SERVICE_VERSION,
          build: env.BUILD_NUMBER,
          checks: report.checks,
        });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
