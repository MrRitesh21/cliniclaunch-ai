import { ITelemetryProvider, ITelemetrySpan, TelemetrySpanOptions } from './telemetry.interface';
import { registry } from '../metrics/registry';
import { httpRequestsTotal, httpRequestDurationSeconds } from '../metrics/httpMetrics';
import { LogService } from '../../logging';

class PromTelemetrySpan implements ITelemetrySpan {
  private startTime: number;
  private attributes: Record<string, string | number | boolean> = {};

  constructor(private name: string, options?: TelemetrySpanOptions) {
    this.startTime = Date.now();
    if (options?.attributes) {
      this.attributes = { ...options.attributes };
    }
  }

  public setAttribute(key: string, value: string | number | boolean): void {
    this.attributes[key] = value;
  }

  public end(): void {
    const durationMs = Date.now() - this.startTime;
    if (durationMs > 500) {
      LogService.warn(`[Telemetry Span] Slow operation detected: ${this.name}`, {
        duration: durationMs,
        ...this.attributes,
      });
    }
  }
}

export class PrometheusTelemetryProvider implements ITelemetryProvider {
  public recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    const singleMetric = registry.getSingleMetric(name);
    if (singleMetric && 'inc' in singleMetric) {
      (singleMetric as any).inc(labels, value);
    }
  }

  public recordDuration(name: string, durationSec: number, labels?: Record<string, string>): void {
    if (name === 'http_request_duration_seconds') {
      httpRequestDurationSeconds.observe(labels || {}, durationSec);
    }
  }

  public startSpan(name: string, options?: TelemetrySpanOptions): ITelemetrySpan {
    return new PromTelemetrySpan(name, options);
  }

  public recordError(error: Error, labels?: Record<string, string>): void {
    LogService.error(`[Telemetry Error] ${error.message}`, error, labels);
  }
}

export const telemetryProvider: ITelemetryProvider = new PrometheusTelemetryProvider();
