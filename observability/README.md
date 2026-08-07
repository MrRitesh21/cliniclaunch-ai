# ClinicX Observability

Two independent projects:

```
observability/   Node 20 + Express + TypeScript telemetry service
                 → prom-client /metrics, Pino JSON logs, /health /ready /live /ping
monitoring/      Grafana + Prometheus + Alertmanager ONLY (no Loki/Tempo/OTel yet)
                 → Discord + Telegram + Email alerts
```

```
ClinicX app (Cloudflare Workers)  ──POST /internal/ingest──┐
BullMQ worker (Node/Docker)  ──────────────────────────────┤
                                                           ▼
                                        observability service (Express)
                                        /metrics /health /ready /live /ping
                                                           ▲
                                            scrape every 30s (Bearer token)
                                                           │
                             Prometheus ──▶ Alertmanager ──▶ Discord / Telegram / Email
                                  ▲
                               Grafana (provisioned dashboards)
```

Why the ingest endpoint: the web app runs on the Workers runtime, where isolates
are created per request — an in-process registry would always be empty. The app
batches samples through the same `Telemetry` port and this service holds the
aggregate that Prometheus scrapes. Business logic never imports prom-client.

## Memory budget (Render Free, 512 MB)

| Component | Limit | Typical |
|---|---|---|
| Prometheus (7d, relabel-filtered) | 200 MB | 120–170 MB |
| Grafana OSS (SQLite, alerting off) | 110 MB | 80–95 MB |
| Alertmanager | 48 MB | 25–35 MB |
| **monitoring total** | **358 MB** | **~230–300 MB** |
| observability service (separate host) | 128 MB | 55–70 MB |

Backend overhead: ~20 MB RSS for the registry + Pino, and roughly 0.2–0.5% CPU —
every metric write is a synchronous counter/histogram update with no I/O.

## Deploy

**Telemetry service**
```bash
cd observability
cp .env.example .env      # fill TELEMETRY_INGEST_TOKEN, METRICS_TOKEN, SUPABASE_*, REDIS_URL
docker compose up -d --build
curl -s localhost:8081/ready | jq
```
On Render: Docker service, health check path `/health`, port `8081`.

**Monitoring stack**
```bash
cd monitoring
cp .env.example .env      # Grafana password, BACKEND_METRICS_HOST, METRICS_TOKEN, alert channels
./scripts/render-config.sh   # expands ${VARS} → generated/ (Prometheus/Alertmanager don't)
docker compose up -d
open http://localhost:3000   # Grafana, dashboards already provisioned
```
`METRICS_TOKEN` must be identical in both `.env` files.

## Endpoints

| Endpoint | Deps touched | Use |
|---|---|---|
| `GET /ping` | none (mounted before all middleware) | cron-job.org, UptimeRobot, Better Stack, GitHub Actions |
| `GET /live` | none | container liveness |
| `GET /health` | none | Render health check |
| `GET /ready` | DB + Supabase + Redis (cached 10s) | load-balancer drain |
| `GET /metrics` | none | Prometheus (token-protected) |
| `POST /internal/ingest` | none | Workers runtime batches (token-protected) |

## Dashboards

- **Application Overview** — up/uptime/version/restarts, req/s, p50·p95·p99, 4xx/5xx ratio, memory, CPU, event-loop lag, slow requests, top slow routes, status codes.
- **Redis, Database & Process** — dependency up/down, Redis latency, DB duration percentiles and connections, Node handles/GC, errors by kind, ingest volume.

## Alerts

`ApiDown`, `NoRequests` (10m), `ApplicationRestarted`, `HighMemoryUsage` (>80%),
`HighCpuUsage` (>85%), `EventLoopBlocked`, `HighLatency` (p95 >1s),
`HighErrorRate` (5xx >5%), `SlowRequestSurge`, `RedisDown`, `DatabaseDown`,
`SupabaseAuthDown`, `DatabaseSlow`, plus `PrometheusSeriesGrowth` and
`AlertNotificationsFailing` so the monitoring stack watches itself.

Routing: critical → Discord + Telegram + Email (repeat 1h); warning → chat only
(6h); info → Discord (12h). Inhibit rules stop `ApiDown` from fanning out into
latency/CPU noise.

## Logging

Pino only — `console.log` is banned. Every access record carries `timestamp`,
`level`, `request_id`, `method`, `url`, `status`, `duration`, `ip`,
`user_agent`, and `tenant_id`/`user_id` when present. `request_id` comes from an
`AsyncLocalStorage` context and is echoed in `x-request-id`.

With `LOG_TO_FILE=true` (Docker/VPS with a mounted volume) Pino writes through a
worker thread to `logs/access.log`, `logs/error.log` and `logs/application.log`,
rotated daily at 20 MB with 7 files kept. On Render Free the disk is ephemeral,
so leave it false and read stdout.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Prometheus target `DOWN` 401 | `METRICS_TOKEN` mismatch, or re-run `render-config.sh` after editing `.env` |
| Dashboards empty | Recording rules need ~2 evaluation cycles (60s); check Status → Rules |
| Prometheus OOM-restarts | Series growth. Tighten the `keep` regex in `prometheus.yml.tpl` |
| `/ready` 503, `/health` 200 | A dependency is down by design — read the `checks` object |
| Alerts fire but nothing arrives | `alertmanager_notifications_failed_total` → check webhook/SMTP creds |
| Every log line lost on redeploy | Expected on ephemeral disk; ship stdout or mount a volume |

## Upgrade path (no business-logic changes)

All telemetry goes through `Telemetry` (`src/monitoring/telemetry/telemetry.ts`).
To adopt OpenTelemetry later:

1. Add `@opentelemetry/sdk-node` + OTLP exporters to the Node service.
2. Write `OtelTelemetry implements Telemetry` — counters/histograms become OTel
   instruments, `recordSpan` becomes a real span.
3. Change the single export line in `prometheus-telemetry.ts` to point at it.
4. Add `otel-collector`, then `loki` and `tempo` to `monitoring/docker-compose.yml`
   and provision the datasources; the Prometheus job can stay as-is during the
   transition.

Callers, routes, middleware and dashboards are untouched — only the adapter and
the compose file change. Do this after moving off the free tier: Loki + Tempo
alone need ~250 MB more RAM than a 512 MB instance can spare.

## Review notes

Performance: keep metric labels to method/route-template/status-class (raw URLs
or ids are what kill a small Prometheus); `/ping` bypasses all middleware;
dependency probes run on a 30s scheduler and are cached, never on scrape.

Security: set `METRICS_TOKEN` in production — an open `/metrics` leaks route
names, traffic volume and versions; `TELEMETRY_INGEST_TOKEN` is compared in
constant time with a hard body cap and a strict Zod schema so ingest can't be
used for cardinality abuse; Grafana runs with sign-up, anonymous access and
update checks disabled; Prometheus and Alertmanager bind to `127.0.0.1` — put
Grafana behind TLS and reach the others through it or an SSH tunnel; logs redact
`authorization`, `cookie`, token and password fields.
