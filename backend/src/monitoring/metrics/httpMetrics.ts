import { Counter, Histogram, Gauge, Summary } from 'prom-client';
import { registry } from './registry';

// 1. HTTP Request Total Counter
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'route', 'status', 'status_class'],
  registers: [registry],
});

// 2. HTTP Request Duration Histogram (P50, P95, P99 calculation in Grafana/PromQL)
export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], // Optimized bucket distribution
  registers: [registry],
});

// 3. HTTP Response Size Summary
export const httpResponseSizeBytes = new Summary({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route'],
  percentiles: [0.5, 0.9, 0.99],
  registers: [registry],
});

// 4. Concurrent Active HTTP Requests
export const httpConcurrentRequests = new Gauge({
  name: 'http_concurrent_requests',
  help: 'Current number of active HTTP requests being processed',
  registers: [registry],
});

// 5. Slow Requests Counter (>500ms)
export const httpSlowRequestsTotal = new Counter({
  name: 'http_slow_requests_total',
  help: 'Total count of slow requests exceeding 500ms threshold',
  labelNames: ['method', 'route'],
  registers: [registry],
});

// 6. HTTP Error Rate Counter (4xx and 5xx)
export const httpErrorsTotal = new Counter({
  name: 'http_errors_total',
  help: 'Total count of HTTP request errors',
  labelNames: ['method', 'route', 'error_type'],
  registers: [registry],
});
