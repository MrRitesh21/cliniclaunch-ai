/**
 * Prometheus registry and every metric this service exposes.
 *
 * Design notes that matter for a 512 MB box:
 *  - ONE registry, created once. prom-client keeps all series in memory, so
 *    cardinality is the memory budget: labels are limited to method / route
 *    template / status class, never raw URLs, ids or user agents.
 *  - Default Node metrics (heap, RSS, CPU, event-loop lag, handles, GC) come
 *    from `collectDefaultMetrics` — cheap, and it already covers the
 *    memory/CPU/event-loop asks.
 *  - Nothing here does I/O. Dependency gauges are written by the probe
 *    scheduler, not on scrape, so a slow Redis can never slow a scrape.
 */
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";
import {
  DB_BUCKETS,
  DURATION_BUCKETS,
  Label,
  METRIC_PREFIX,
  Metric,
  SIZE_BUCKETS,
} from "../../config/constants.js";
import { env } from "../../config/env.js";

export const registry = new Registry();

registry.setDefaultLabels({ service: env.SERVICE_NAME });

collectDefaultMetrics({
  register: registry,
  prefix: METRIC_PREFIX,
  eventLoopMonitoringPrecision: 20,
});

export const httpRequestsTotal = new Counter({
  name: Metric.httpRequestsTotal,
  help: "Total HTTP requests handled, by method, route template and status.",
  labelNames: [Label.method, Label.route, Label.status, Label.statusClass, Label.source],
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: Metric.httpRequestDuration,
  help: "HTTP request duration in seconds (source for p50/p95/p99).",
  labelNames: [Label.method, Label.route, Label.statusClass, Label.source],
  buckets: [...DURATION_BUCKETS],
  registers: [registry],
});

export const httpResponseSize = new Histogram({
  name: Metric.httpResponseSize,
  help: "HTTP response body size in bytes.",
  labelNames: [Label.method, Label.route, Label.source],
  buckets: [...SIZE_BUCKETS],
  registers: [registry],
});

export const httpRequestsInFlight = new Gauge({
  name: Metric.httpRequestsInFlight,
  help: "Requests currently being processed (concurrency).",
  labelNames: [Label.source],
  registers: [registry],
});

export const httpSlowRequestsTotal = new Counter({
  name: Metric.httpSlowRequestsTotal,
  help: `Requests slower than the slow-request threshold (${env.SLOW_REQUEST_MS}ms).`,
  labelNames: [Label.method, Label.route, Label.source],
  registers: [registry],
});

export const errorsTotal = new Counter({
  name: Metric.errorsTotal,
  help: "Errors recorded by the application, by kind.",
  labelNames: [Label.kind, Label.route, Label.source],
  registers: [registry],
});

export const redisUp = new Gauge({
  name: Metric.redisUp,
  help: "1 when the last Redis probe succeeded, 0 otherwise.",
  registers: [registry],
});

export const redisLatency = new Gauge({
  name: Metric.redisLatency,
  help: "Latency of the last successful Redis round trip, in seconds.",
  registers: [registry],
});

export const databaseUp = new Gauge({
  name: Metric.databaseUp,
  help: "1 when the last PostgreSQL/Supabase Data API probe succeeded, 0 otherwise.",
  registers: [registry],
});

export const databaseQueryDuration = new Histogram({
  name: Metric.databaseQueryDuration,
  help: "Database query duration in seconds.",
  labelNames: [Label.kind, Label.source],
  buckets: [...DB_BUCKETS],
  registers: [registry],
});

export const databaseConnections = new Gauge({
  name: Metric.databaseConnections,
  help: "Reported database connections, by state (active/idle/max).",
  labelNames: [Label.state],
  registers: [registry],
});

export const supabaseUp = new Gauge({
  name: Metric.supabaseUp,
  help: "1 when the last Supabase Auth health probe succeeded, 0 otherwise.",
  registers: [registry],
});

export const uptimeSeconds = new Gauge({
  name: Metric.uptimeSeconds,
  help: "Process uptime in seconds.",
  registers: [registry],
  collect() {
    this.set(process.uptime());
  },
});

export const restartsTotal = new Gauge({
  name: Metric.restartsTotal,
  help: "Number of times this service has booted (container restart counter, Redis-backed).",
  registers: [registry],
});

export const buildInfo = new Gauge({
  name: Metric.buildInfo,
  help: "Build metadata. Always 1; read the labels.",
  labelNames: [Label.version, Label.build, Label.commit, Label.runtime],
  registers: [registry],
});

export const ingestBatchesTotal = new Counter({
  name: Metric.ingestBatchesTotal,
  help: "Telemetry batches accepted from application runtimes.",
  labelNames: [Label.source],
  registers: [registry],
});

export const ingestRejectedTotal = new Counter({
  name: Metric.ingestRejectedTotal,
  help: "Telemetry batches rejected, by reason.",
  labelNames: [Label.reason],
  registers: [registry],
});

buildInfo
  .labels({
    [Label.version]: env.SERVICE_VERSION,
    [Label.build]: env.BUILD_NUMBER,
    [Label.commit]: env.GIT_COMMIT,
    [Label.runtime]: `node-${process.versions.node}`,
  })
  .set(1);

export async function renderMetrics(): Promise<string> {
  return registry.metrics();
}

export const metricsContentType = registry.contentType;
