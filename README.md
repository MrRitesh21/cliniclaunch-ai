# Lightweight Production-Ready Monitoring Stack for SaaS

An enterprise-grade, memory-optimized monitoring system designed to run within a **Render Free Instance (512 MB RAM)** limit while remaining fully forward-compatible with OpenTelemetry, Loki, Tempo, and Mimir.

---

## 🎯 Architecture Highlights

- **Backend Footprint**: Node.js + Express + TypeScript backend consuming `<30 MB` additional RAM for monitoring.
- **Monitoring Stack Footprint**: Total memory budget `<300 MB` RAM (Prometheus ~150MB, Grafana ~120MB, Alertmanager ~30MB).
- **Asynchronous Pino Logging**: Non-blocking log streams writing structured JSON to `logs/access.log`, `logs/application.log`, and `logs/error.log` with automatic rotation.
- **Prometheus Metrics**: `prom-client` collecting request rates, P50/P95/P99 latency, 4xx/5xx errors, Node event loop delay, heap/RSS memory, Redis status, and DB status.
- **Health & Cron Probes**: 4 isolated health endpoints (`/health`, `/ready`, `/live`, `/ping`).
- **Telemetry Abstraction Layer**: `ITelemetryProvider` interface ensuring zero code changes when migrating to OpenTelemetry.
- **Multi-Channel Alerting**: Pre-configured Alertmanager notifying Discord, Telegram, and Email.

---

## 📁 Repository Structure

```text
├── backend/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── src/
│       ├── app.ts
│       ├── index.ts
│       ├── config/
│       ├── logging/
│       │   ├── logger.ts
│       │   └── index.ts
│       └── monitoring/
│           ├── health/
│           ├── metrics/
│           ├── middlewares/
│           ├── routes/
│           └── telemetry/
│
├── monitoring/
│   ├── docker-compose.yml
│   ├── .env.example
│   ├── prometheus/
│   │   ├── prometheus.yml
│   │   └── alert.rules.yml
│   ├── alertmanager/
│   │   └── alertmanager.yml
│   └── grafana/
│       ├── provisioning/
│       └── dashboards/
│
└── docs/
    ├── ARCHITECTURE.md
    ├── DEPLOYMENT.md
    ├── DASHBOARDS.md
    ├── ALERTS.md
    ├── TROUBLESHOOTING.md
    └── FUTURE_OPENTELEMETRY_MIGRATION.md
```

---

## 🚀 Quick Start Guide

### 1. Launching the Backend Service
```bash
cd backend
npm install
npm run build
npm start
```

### 2. Launching the Monitoring Stack
```bash
cd monitoring
docker-compose up -d
```
Access Grafana at [http://localhost:3001](http://localhost:3001) (User: `admin`, Password: `admin_secure_password_123`).

---

## 🔗 Health Endpoints Summary

| Endpoint | Target Audience | Behavior & SLA | DB / Redis Check? |
| :--- | :--- | :--- | :--- |
| `GET /health` | Render Cloud Probe | Returns `{"status":"healthy","time":"ISO"}` (<1ms) | ❌ No |
| `GET /ready` | Load Balancer | Probes Redis PING & Supabase connection. Returns 200 or 503 |  Yes |
| `GET /live` | Process Supervisor | Checks Node.js runtime process uptime | ❌ No |
| `GET /ping` | External Cron / UptimeRobot | Returns `{"success":true,"timestamp":"ISO"}` (<5ms SLA) | ❌ No |
| `GET /metrics` | Prometheus Scraper | Exposes `prom-client` metric registry | ❌ No |
