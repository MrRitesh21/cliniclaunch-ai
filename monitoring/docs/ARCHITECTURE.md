# System Architecture & Resource Allocation Plan

## 🏗️ Architecture Overview

```text
                                +----------------------------------+
                                |      External Cron Monitors      |
                                |  (UptimeRobot, Render, Cron-Job) |
                                +----------------------------------+
                                                 |
                                                 | GET /ping (<5ms)
                                                 v
+-----------------------------------------------------------------------------------+
| Node.js Express Backend Service                                                   |
|                                                                                   |
|  [ Ping Middleware ] -----> Bypasses Heavy Middlewares & DB/Redis                 |
|  [ Metrics Middleware ] ---> Records HTTP Duration, Errors, Size to prom-client   |
|  [ Pino Logger ] ----------> Async Stream to logs/access.log, error.log           |
|  [ Telemetry Abstraction ] -> ITelemetryProvider Interface                        |
|                                                                                   |
|  Endpoints: GET /health | GET /ready | GET /live | GET /ping | GET /metrics       |
+-----------------------------------------------------------------------------------+
                                                 |
                                                 | GET /metrics (30s Scrape)
                                                 v
+-----------------------------------------------------------------------------------+
| Render Monitoring Server (Docker Stack under ~300 MB RAM)                        |
|                                                                                   |
|   +-----------------------+     +------------------------+     +----------------+ |
|   |      Prometheus       | --> |      Alertmanager      | --> |  Discord / TG  | |
|   |  (Ret: 7d, Mem: 150M) |     |  (Mem: 30M, Routing)   |     |  Email Alerts  | |
|   +-----------------------+     +------------------------+     +----------------+ |
|               |                                                                   |
|               v                                                                   |
|   +-----------------------+                                                       |
|   |        Grafana        | (5 Auto-Provisioned Dashboards, Mem: 120M)            |
|   +-----------------------+                                                       |
+-----------------------------------------------------------------------------------+
```

---

## ⚡ Memory Footprint & Constraints Budget

| Component | Target Memory | Hard Limit | Optimization Rationale |
| :--- | :--- | :--- | :--- |
| **Node Backend Monitoring** | ~15-25 MB | 30 MB | `prom-client` in-memory counters + Pino async buffer |
| **Prometheus TSDB** | ~100-140 MB | 150 MB | Retention capped at 7 days / 2GB, 30s scrape interval |
| **Grafana Server** | ~90-110 MB | 120 MB | Default plugins only, disabled telemetry & reporting |
| **Alertmanager** | ~15-25 MB | 30 MB | Minimal route tree, ephemeral memory buffer |
| **Total Monitoring Stack** | **~255-300 MB** | **350 MB** | **Fits comfortably within 512 MB Render Free limit** |

---

## 🔮 Telemetry Abstraction Layer Design

To prevent future refactoring when transitioning to OpenTelemetry:

```typescript
export interface ITelemetryProvider {
  recordMetric(name: string, value: number, labels?: Record<string, string>): void;
  recordDuration(name: string, durationSec: number, labels?: Record<string, string>): void;
  startSpan(name: string, options?: TelemetrySpanOptions): ITelemetrySpan;
  recordError(error: Error, labels?: Record<string, string>): void;
}
```

Business handlers call `telemetryProvider.startSpan()`, which currently records in-memory span durations and warns on slow operations (>500ms). When upgrading to OpenTelemetry SDK, `PrometheusTelemetryProvider` is swapped for `OTelTelemetryProvider` with zero changes to business handlers.
