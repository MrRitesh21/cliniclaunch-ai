import { Router } from "express";
import { getHealth, getReady, getLive, getMetrics } from "../health/healthController";
import { pingHandler } from "../middlewares/pingMiddleware";

export const monitoringRouter = Router();

// Render health endpoint
monitoringRouter.get("/health", getHealth);

// Readiness probe for Redis & Supabase
monitoringRouter.get("/ready", getReady);

// Liveness probe for Node.js process
monitoringRouter.get("/live", getLive);

// External cron monitoring endpoint (<5ms, low overhead)
monitoringRouter.get("/ping", pingHandler);

// Prometheus scrape endpoint
monitoringRouter.get("/metrics", getMetrics);
