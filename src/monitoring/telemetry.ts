/**
 * OpenTelemetry & Observability Monitor for ClinicX
 * Collects metrics, slow queries, and crash telemetry.
 */

export interface TelemetrySpan {
  name: string;
  durationMs: number;
  attributes: Record<string, string | number | boolean>;
  timestamp: string;
}

class TelemetryEngine {
  private spans: TelemetrySpan[] = [];

  recordSpan(
    name: string,
    durationMs: number,
    attributes: Record<string, string | number | boolean> = {},
  ) {
    const span: TelemetrySpan = {
      name,
      durationMs: Math.round(durationMs * 100) / 100,
      attributes,
      timestamp: new Date().toISOString(),
    };
    this.spans.push(span);

    if (durationMs > 500) {
      console.warn(
        `[Slow Query/Task Detected] ${name} took ${durationMs.toFixed(1)}ms`,
        attributes,
      );
    }
  }

  getRecentSpans(): TelemetrySpan[] {
    return [...this.spans.slice(-100)];
  }
}

export const telemetry = new TelemetryEngine();
