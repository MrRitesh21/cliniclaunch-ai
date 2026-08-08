# Troubleshooting & Operations Guide

## 🛠️ Common Issues & Remediation

### 1. High Memory Usage on Render Free (OOM Risk)
- **Symptom**: Render instance restarts with error code `OOM-Killed`.
- **Diagnosis**: Check `/metrics` memory gauges or Grafana System Health dashboard.
- **Fix**:
  1. Verify `pino` stream buffers are flushed (`sync: false`).
  2. Reduce `prom-client` histogram bucket count in `httpMetrics.ts`.
  3. Ensure no memory leak in long-lived variables.

### 2. Prometheus Target Shows `DOWN`
- **Symptom**: `up{job="backend"} == 0`.
- **Fix**:
  1. Verify backend port `3000` is exposed.
  2. Ensure `monitoring/prometheus/prometheus.yml` contains the correct host IP or `host.docker.internal:3000`.
  3. Curl `http://localhost:3000/metrics` directly to verify metrics endpoint response.

### 3. Alertmanager Notifications Not Delivering
- **Symptom**: Alerts firing in Prometheus but no Telegram/Discord message received.
- **Fix**:
  1. Check Alertmanager container logs: `docker logs saas_alertmanager`.
  2. Validate `DISCORD_WEBHOOK_URL` and `TELEGRAM_BOT_TOKEN` in `monitoring/.env`.
  3. Ensure `repeat_interval` and `group_wait` settings match expectations.
