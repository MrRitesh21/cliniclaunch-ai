# Prometheus — single scrape job against the ClinicX telemetry service.
# 30s interval, 7d retention, minimal series: tuned for a 512 MB box.
global:
  scrape_interval: 30s
  scrape_timeout: 10s
  evaluation_interval: 30s
  external_labels:
    stack: clinicx
    env: production

rule_files:
  - /etc/prometheus/rules/*.yml

alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]
      timeout: 10s

scrape_configs:
  # The backend telemetry service (Express + prom-client). It also holds the
  # metrics pushed by the Cloudflare Workers runtime, so this single job covers
  # the whole application surface.
  - job_name: clinicx-backend
    metrics_path: /metrics
    scheme: https
    static_configs:
      - targets: ["${BACKEND_METRICS_HOST}"]
        labels:
          component: backend
    authorization:
      # Prometheus sends this as `Authorization: Bearer <token>`; the service
      # also accepts X-Metrics-Token. Use whichever your edge allows.
      type: Bearer
      credentials_file: /etc/prometheus/metrics_token
    # Only keep the series the dashboards and alerts actually use. Everything
    # else is dropped before it reaches the TSDB — this is the single biggest
    # memory lever available.
    metric_relabel_configs:
      - source_labels: [__name__]
        regex: "clinicx_(http_.*|errors_total|redis_.*|database_.*|supabase_up|uptime_seconds|process_restarts_total|build_info|ingest_.*|process_cpu_.*|process_resident_memory_bytes|nodejs_heap_size_(total|used)_bytes|nodejs_eventloop_lag_(seconds|p95_seconds|p99_seconds)|nodejs_active_(handles|requests)_total|nodejs_gc_duration_seconds.*)"
        action: keep

  # Self-monitoring: Prometheus must be able to alert on its own health.
  - job_name: prometheus
    metrics_path: /metrics
    static_configs:
      - targets: ["localhost:9090"]
    metric_relabel_configs:
      - source_labels: [__name__]
        regex: "prometheus_(tsdb_head_series|target_scrapes_exceeded_sample_limit_total|rule_evaluation_failures_total|notifications_dropped_total)|up|scrape_duration_seconds|process_resident_memory_bytes"
        action: keep

  - job_name: alertmanager
    static_configs:
      - targets: ["alertmanager:9093"]
    metric_relabel_configs:
      - source_labels: [__name__]
        regex: "alertmanager_notifications(_failed)?_total|up"
        action: keep
