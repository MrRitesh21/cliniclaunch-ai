# Alerting & Notification Rules Reference

Prometheus continuously evaluates metrics against rules defined in `monitoring/prometheus/alert.rules.yml`. Triggered alerts are dispatched via Alertmanager to Discord, Telegram, and Email.

---

## 🚨 Configured Alert Rules

| Alert Name                 | Condition / Expression                   | Severity   | Description                          |
| :------------------------- | :--------------------------------------- | :--------- | :----------------------------------- |
| **`ApiDown`**              | `up{job="backend"} == 0` for 1m          | `critical` | Backend API container is unreachable |
| **`HighMemoryUsage`**      | `RSS / 512MB > 0.80` for 3m              | `warning`  | Memory usage exceeded 80% (410 MB)   |
| **`HighCpuUsage`**         | `rate(process_cpu_seconds_total) > 0.85` | `warning`  | CPU usage > 85% for 3 minutes        |
| **`HighLatency`**          | `P95 Latency > 1.0s` for 2m              | `warning`  | 95% of requests taking >1000ms       |
| **`HighErrorRate5xx`**     | `5xx Errors > 5%` for 3m                 | `critical` | Server error rate exceeded 5%        |
| **`RedisDown`**            | `redis_up == 0` for 1m                   | `critical` | Redis cache status check failed      |
| **`DatabaseDown`**         | `database_up == 0` for 1m                | `critical` | Supabase DB status check failed      |
| **`NoRequests10m`**        | `Rate(http_requests_total[10m]) == 0`    | `warning`  | Zero incoming traffic for 10 minutes |
| **`ApplicationRestarted`** | `changes(start_time[10m]) > 0`           | `info`     | Process restarted in last 10 minutes |

---

## 🔔 Receiver Channels

- **Discord Webhook**: Receives all `critical` and `warning` alerts.
- **Telegram Bot**: Receives `critical` and `warning` alerts formatted as HTML messages.
- **Email (SMTP)**: Sends email notifications for `critical` alerts.
