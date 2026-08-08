# Future OpenTelemetry Migration Guide

This architecture was designed from day one to support seamless migration to full OpenTelemetry (OTel Collector + Loki + Tempo + Mimir) without modifying your application routes or business logic.

---

## 🛣️ Migration Roadmap

```text
Current State:
  Backend App -> prom-client + Pino -> Prometheus & Grafana

Phase 1 (OTel SDK Integration):
  Backend App -> ITelemetryProvider (OTel SDK) -> OTel Collector -> Grafana

Phase 2 (Distributed Tracing & Logs):
  OTel Collector -> Loki (Logs) + Tempo (Traces) + Prometheus/Mimir (Metrics) -> Grafana
```

---

## 📝 Step-by-Step Code Migration

### Step 1: Implement `OTelTelemetryProvider`
Create a new provider implementing the `ITelemetryProvider` interface:

```typescript
import { trace, metrics } from '@opentelemetry/api';
import { ITelemetryProvider, ITelemetrySpan } from './telemetry.interface';

export class OTelTelemetryProvider implements ITelemetryProvider {
  private tracer = trace.getTracer('saas-backend');
  private meter = metrics.getMeter('saas-backend');

  startSpan(name: string): ITelemetrySpan {
    const otelSpan = this.tracer.startSpan(name);
    return {
      setAttribute: (k, v) => otelSpan.setAttribute(k, v),
      end: () => otelSpan.end(),
    };
  }

  recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    const counter = this.meter.createCounter(name);
    counter.add(value, labels);
  }

  recordDuration(name: string, durationSec: number, labels?: Record<string, string>): void {
    const histogram = this.meter.createHistogram(name);
    histogram.record(durationSec, labels);
  }

  recordError(error: Error, labels?: Record<string, string>): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
    }
  }
}
```

### Step 2: Swap Provider Instance
In `backend/src/monitoring/telemetry/promTelemetryProvider.ts` (or factory):

```typescript
// Replace:
// export const telemetryProvider: ITelemetryProvider = new PrometheusTelemetryProvider();

// With:
export const telemetryProvider: ITelemetryProvider = new OTelTelemetryProvider();
```

Because all application code uses `telemetryProvider.startSpan()` and `LogService`, **zero line changes are required in your route handlers, services, or business components!**
