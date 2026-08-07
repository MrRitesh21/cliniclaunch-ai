/**
 * GET /metrics — Prometheus scrape target.
 *
 * Optionally protected by a shared token and/or an IP allow list. On Render the
 * service is publicly reachable, and an open /metrics leaks route names, traffic
 * volume and version info, so METRICS_TOKEN should always be set in production.
 */
import { Router } from "express";
import { HTTP_STATUS, Header, Route } from "../../config/constants.js";
import { env, metricsAllowedIps } from "../../config/env.js";
import { clientIp } from "../../utils/http.js";
import { metricsContentType, renderMetrics } from "../metrics/registry.js";
import { timingSafeEqualStr } from "../../utils/crypto.js";

export function metricsRouter(): Router {
  const router = Router();

  router.get(Route.metrics, async (req, res, next) => {
    if (metricsAllowedIps.size > 0 && !metricsAllowedIps.has(clientIp(req))) {
      res.status(HTTP_STATUS.unauthorized).end();
      return;
    }

    if (env.METRICS_TOKEN) {
      // Accept either X-Metrics-Token or `Authorization: Bearer <token>`
      // (Prometheus's `authorization` block sends the latter).
      const header = req.headers[Header.metricsToken];
      const raw = Array.isArray(header) ? header[0] : header;
      const bearer = req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice("Bearer ".length)
        : undefined;
      const provided = raw ?? bearer;
      if (!provided || !timingSafeEqualStr(provided, env.METRICS_TOKEN)) {
        res.status(HTTP_STATUS.unauthorized).end();
        return;
      }
    }

    try {
      const body = await renderMetrics();
      res.setHeader("Content-Type", metricsContentType);
      res.setHeader("Cache-Control", "no-store");
      res.status(HTTP_STATUS.ok).send(body);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
