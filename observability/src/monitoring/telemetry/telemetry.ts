/**
 * The telemetry abstraction layer.
 *
 * Business logic depends ONLY on this interface. Today it is backed by
 * prom-client (`PrometheusTelemetry`). Tomorrow an OpenTelemetry-backed
 * implementation can be dropped in — see docs/UPGRADE-OPENTELEMETRY.md — and no
 * caller changes, because callers never import prom-client.
 */

export type StatusClass = "1xx" | "2xx" | "3xx" | "4xx" | "5xx";

export interface HttpRequestSample {
  method: string;
  /** Route template (`/clinics/:id`), never a raw URL — cardinality guard. */
  route: string;
  status: number;
  durationMs: number;
  responseBytes: number;
  slow: boolean;
  source: string;
}

export interface DependencySample {
  name: "redis" | "database" | "supabase";
  up: boolean;
  latencyMs: number | null;
}

export interface DbQuerySample {
  kind: string;
  durationMs: number;
  source: string;
}

export interface SpanSample {
  name: string;
  durationMs: number;
  attributes?: Record<string, string | number | boolean>;
}

export interface Telemetry {
  recordHttpRequest(sample: HttpRequestSample): void;
  recordError(kind: string, route: string, source: string): void;
  recordDependency(sample: DependencySample): void;
  recordDbQuery(sample: DbQuerySample): void;
  recordDbConnections(state: "active" | "idle" | "max", value: number): void;
  recordSpan(sample: SpanSample): void;
  incrementInFlight(source: string): void;
  decrementInFlight(source: string): void;
}

export function statusClassOf(status: number): StatusClass {
  const bucket = Math.floor(status / 100);
  switch (bucket) {
    case 1:
      return "1xx";
    case 2:
      return "2xx";
    case 3:
      return "3xx";
    case 4:
      return "4xx";
    default:
      return "5xx";
  }
}

/** Used in tests and when telemetry is intentionally disabled. */
export class NoopTelemetry implements Telemetry {
  recordHttpRequest(): void {}
  recordError(): void {}
  recordDependency(): void {}
  recordDbQuery(): void {}
  recordDbConnections(): void {}
  recordSpan(): void {}
  incrementInFlight(): void {}
  decrementInFlight(): void {}
}
