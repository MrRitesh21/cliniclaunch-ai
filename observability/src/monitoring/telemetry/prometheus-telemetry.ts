/**
 * prom-client implementation of the Telemetry port.
 *
 * All calls are synchronous, allocation-light counter/histogram updates — no
 * I/O, no awaits — which is what keeps monitoring overhead under the 1% CPU
 * target. Spans are only logged (Prometheus is not a tracing backend); when
 * Tempo arrives, this method becomes a real span export.
 */
import { Label } from "../../config/constants.js";
import { env } from "../../config/env.js";
import { logger } from "../../logging/logger.js";
import {
  databaseConnections,
  databaseQueryDuration,
  databaseUp,
  errorsTotal,
  httpRequestDuration,
  httpRequestsInFlight,
  httpRequestsTotal,
  httpResponseSize,
  httpSlowRequestsTotal,
  redisLatency,
  redisUp,
  supabaseUp,
} from "../metrics/registry.js";
import {
  statusClassOf,
  type DbQuerySample,
  type DependencySample,
  type HttpRequestSample,
  type SpanSample,
  type Telemetry,
} from "./telemetry.js";

export class PrometheusTelemetry implements Telemetry {
  recordHttpRequest(sample: HttpRequestSample): void {
    const statusClass = statusClassOf(sample.status);
    const base = {
      [Label.method]: sample.method,
      [Label.route]: sample.route,
      [Label.source]: sample.source,
    };

    httpRequestsTotal.inc({
      ...base,
      [Label.status]: String(sample.status),
      [Label.statusClass]: statusClass,
    });
    httpRequestDuration.observe(
      { ...base, [Label.statusClass]: statusClass },
      sample.durationMs / 1_000,
    );
    if (sample.responseBytes > 0) {
      httpResponseSize.observe(base, sample.responseBytes);
    }
    if (sample.slow) {
      httpSlowRequestsTotal.inc(base);
    }
    if (statusClass === "5xx") {
      errorsTotal.inc({
        [Label.kind]: "http_5xx",
        [Label.route]: sample.route,
        [Label.source]: sample.source,
      });
    }
  }

  recordError(kind: string, route: string, source: string): void {
    errorsTotal.inc({ [Label.kind]: kind, [Label.route]: route, [Label.source]: source });
  }

  recordDependency(sample: DependencySample): void {
    const up = sample.up ? 1 : 0;
    switch (sample.name) {
      case "redis":
        redisUp.set(up);
        if (sample.latencyMs !== null) redisLatency.set(sample.latencyMs / 1_000);
        break;
      case "database":
        databaseUp.set(up);
        if (sample.latencyMs !== null) {
          databaseQueryDuration.observe(
            { [Label.kind]: "readiness_probe", [Label.source]: env.SERVICE_NAME },
            sample.latencyMs / 1_000,
          );
        }
        break;
      case "supabase":
        supabaseUp.set(up);
        break;
    }
  }

  recordDbQuery(sample: DbQuerySample): void {
    databaseQueryDuration.observe(
      { [Label.kind]: sample.kind, [Label.source]: sample.source },
      sample.durationMs / 1_000,
    );
  }

  recordDbConnections(state: "active" | "idle" | "max", value: number): void {
    databaseConnections.set({ [Label.state]: state }, value);
  }

  recordSpan(sample: SpanSample): void {
    if (sample.durationMs >= env.SLOW_REQUEST_MS) {
      logger.warn(
        { span: sample.name, duration_ms: Math.round(sample.durationMs), ...sample.attributes },
        "slow operation",
      );
    } else {
      logger.debug(
        { span: sample.name, duration_ms: Math.round(sample.durationMs), ...sample.attributes },
        "span",
      );
    }
  }

  incrementInFlight(source: string): void {
    httpRequestsInFlight.inc({ [Label.source]: source });
  }

  decrementInFlight(source: string): void {
    httpRequestsInFlight.dec({ [Label.source]: source });
  }
}

/**
 * The single instance the app uses. Swap this one line to migrate the whole
 * codebase to another backend.
 */
export const telemetry: Telemetry = new PrometheusTelemetry();
