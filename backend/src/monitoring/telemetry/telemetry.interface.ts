/**
 * Telemetry Abstraction Layer for Future OpenTelemetry Migration.
 *
 * Business logic and middleware interact strictly with this interface.
 * Upgrading to OpenTelemetry SDK / OTel Collector / Loki / Tempo simply involves
 * swapping the underlying TelemetryProvider implementation, requiring zero changes
 * to application routes or services.
 */

export interface TelemetrySpanOptions {
  attributes?: Record<string, string | number | boolean>;
}

export interface ITelemetrySpan {
  setAttribute(key: string, value: string | number | boolean): void;
  end(): void;
}

export interface ITelemetryProvider {
  /**
   * Record a metric counter or gauge increment
   */
  recordMetric(name: string, value: number, labels?: Record<string, string>): void;

  /**
   * Record execution duration (in seconds or milliseconds)
   */
  recordDuration(name: string, durationSec: number, labels?: Record<string, string>): void;

  /**
   * Start a telemetry span for tracing operations
   */
  startSpan(name: string, options?: TelemetrySpanOptions): ITelemetrySpan;

  /**
   * Capture an exception or runtime error
   */
  recordError(error: Error, labels?: Record<string, string>): void;
}
