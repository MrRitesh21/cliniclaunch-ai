/**
 * POST /internal/ingest — telemetry intake for runtimes that cannot expose a
 * scrape endpoint.
 *
 * The ClinicX web app runs on Cloudflare Workers: isolates are created and
 * destroyed per request, so an in-process /metrics endpoint would return a
 * near-empty registry. Instead the Workers runtime batches samples through the
 * same `Telemetry` port and POSTs them here; this Node service holds the
 * aggregate state that Prometheus scrapes.
 *
 * Security: shared-secret header compared in constant time, hard body-size cap,
 * strict schema, and label values are clamped so a malicious client cannot blow
 * up Prometheus cardinality.
 */
import { Router, json } from "express";
import { z } from "zod";
import { HTTP_STATUS, Header, Label, Route } from "../../config/constants.js";
import { env } from "../../config/env.js";
import { logger } from "../../logging/logger.js";
import { timingSafeEqualStr } from "../../utils/crypto.js";
import { ingestBatchesTotal, ingestRejectedTotal } from "../metrics/registry.js";
import { telemetry } from "../telemetry/prometheus-telemetry.js";

const MAX_LABEL = 96;
const MAX_SAMPLES = 500;

const label = z.string().min(1).max(MAX_LABEL);

const httpSample = z.object({
  type: z.literal("http"),
  method: label,
  route: label,
  status: z.number().int().min(100).max(599),
  duration_ms: z.number().min(0).max(600_000),
  bytes: z.number().min(0).max(1_073_741_824).optional(),
});

const errorSample = z.object({
  type: z.literal("error"),
  kind: label,
  route: label.optional(),
});

const dbSample = z.object({
  type: z.literal("db"),
  kind: label,
  duration_ms: z.number().min(0).max(600_000),
});

const spanSample = z.object({
  type: z.literal("span"),
  name: label,
  duration_ms: z.number().min(0).max(600_000),
});

const batchSchema = z.object({
  source: label,
  samples: z.array(z.discriminatedUnion("type", [httpSample, errorSample, dbSample, spanSample]))
    .min(1)
    .max(MAX_SAMPLES),
});

export function ingestRouter(): Router {
  const router = Router();

  router.post(
    Route.ingest,
    json({ limit: env.INGEST_MAX_BODY_BYTES }),
    (req, res) => {
      const header = req.headers[Header.ingestToken];
      const provided = Array.isArray(header) ? header[0] : header;
      if (!provided || !timingSafeEqualStr(provided, env.TELEMETRY_INGEST_TOKEN)) {
        ingestRejectedTotal.inc({ [Label.reason]: "unauthorized" });
        res.status(HTTP_STATUS.unauthorized).json({ error: "unauthorized" });
        return;
      }

      const parsed = batchSchema.safeParse(req.body);
      if (!parsed.success) {
        ingestRejectedTotal.inc({ [Label.reason]: "invalid_payload" });
        res.status(HTTP_STATUS.badRequest).json({ error: "invalid_payload" });
        return;
      }

      const { source, samples } = parsed.data;
      for (const sample of samples) {
        switch (sample.type) {
          case "http":
            telemetry.recordHttpRequest({
              method: sample.method,
              route: sample.route,
              status: sample.status,
              durationMs: sample.duration_ms,
              responseBytes: sample.bytes ?? 0,
              slow: sample.duration_ms >= env.SLOW_REQUEST_MS,
              source,
            });
            break;
          case "error":
            telemetry.recordError(sample.kind, sample.route ?? "unknown", source);
            break;
          case "db":
            telemetry.recordDbQuery({ kind: sample.kind, durationMs: sample.duration_ms, source });
            break;
          case "span":
            telemetry.recordSpan({ name: sample.name, durationMs: sample.duration_ms });
            break;
        }
      }

      ingestBatchesTotal.inc({ [Label.source]: source });
      logger.debug({ source, count: samples.length }, "telemetry batch accepted");
      res.status(HTTP_STATUS.noContent).end();
    },
  );

  return router;
}
