/**
 * Single source of truth for every metric name, label, route path and header
 * used by the telemetry service. Nothing in this project may inline a string
 * that belongs here — that is what keeps dashboards, alert rules and code from
 * drifting apart.
 */

export const METRIC_PREFIX = "clinicx_" as const;

export const Metric = {
  httpRequestsTotal: `${METRIC_PREFIX}http_requests_total`,
  httpRequestDuration: `${METRIC_PREFIX}http_request_duration_seconds`,
  httpResponseSize: `${METRIC_PREFIX}http_response_size_bytes`,
  httpRequestsInFlight: `${METRIC_PREFIX}http_requests_in_flight`,
  httpSlowRequestsTotal: `${METRIC_PREFIX}http_slow_requests_total`,
  errorsTotal: `${METRIC_PREFIX}errors_total`,

  redisUp: `${METRIC_PREFIX}redis_up`,
  redisLatency: `${METRIC_PREFIX}redis_latency_seconds`,

  databaseUp: `${METRIC_PREFIX}database_up`,
  databaseQueryDuration: `${METRIC_PREFIX}database_query_duration_seconds`,
  databaseConnections: `${METRIC_PREFIX}database_connections`,

  supabaseUp: `${METRIC_PREFIX}supabase_up`,

  uptimeSeconds: `${METRIC_PREFIX}uptime_seconds`,
  restartsTotal: `${METRIC_PREFIX}process_restarts_total`,
  buildInfo: `${METRIC_PREFIX}build_info`,

  ingestBatchesTotal: `${METRIC_PREFIX}ingest_batches_total`,
  ingestRejectedTotal: `${METRIC_PREFIX}ingest_rejected_total`,
} as const;

export const Label = {
  method: "method",
  route: "route",
  status: "status",
  statusClass: "status_class",
  source: "source",
  kind: "kind",
  version: "version",
  build: "build",
  commit: "commit",
  runtime: "runtime",
  state: "state",
  reason: "reason",
} as const;

export const Route = {
  metrics: "/metrics",
  health: "/health",
  ready: "/ready",
  live: "/live",
  ping: "/ping",
  ingest: "/internal/ingest",
} as const;

export const Header = {
  requestId: "x-request-id",
  ingestToken: "x-telemetry-token",
  metricsToken: "x-metrics-token",
  forwardedFor: "x-forwarded-for",
  tenantId: "x-tenant-id",
  userId: "x-user-id",
} as const;

/**
 * Histogram buckets in seconds. Deliberately short and few: every extra bucket
 * is one more series per label combination, and series count is what actually
 * eats RAM in a 512 MB Prometheus.
 */
export const DURATION_BUCKETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5] as const;

/** Response size buckets in bytes. */
export const SIZE_BUCKETS = [256, 1_024, 8_192, 65_536, 524_288, 2_097_152] as const;

/** DB query duration buckets in seconds. */
export const DB_BUCKETS = [0.005, 0.025, 0.1, 0.25, 1, 3] as const;

export const HTTP_STATUS = {
  ok: 200,
  noContent: 204,
  badRequest: 400,
  unauthorized: 401,
  payloadTooLarge: 413,
  tooManyRequests: 429,
  serverError: 500,
  serviceUnavailable: 503,
} as const;

/** Redis keys owned by this service. */
export const RedisKey = {
  restartCounter: "clinicx:obs:restarts",
  probe: "clinicx:obs:probe",
} as const;
