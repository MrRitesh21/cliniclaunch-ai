# Grafana Dashboards Guide

This monitoring setup provisions 5 pre-configured Grafana dashboards automatically upon startup.

---

## 📊 Provisioned Dashboards Reference

### 1. `01 - Application Overview`
- **Application Status**: Single-stat indicator showing `ONLINE` (1) or `OFFLINE` (0).
- **Uptime**: Live app uptime in hours.
- **Request Rate**: Real-time HTTP request throughput per second (`sum(rate(http_requests_total[5m]))`).
- **5xx Error Rate**: Percentage of HTTP server errors over total requests.
- **P95 Latency**: 95th percentile response latency in milliseconds.

### 2. `02 - Request Performance & Latency`
- **Latency Percentiles**: P50, P95, and P99 response time trends.
- **Slow Requests Counter**: Total count of requests exceeding `500ms`.
- **Latency Heatmap**: Visual distribution of request duration buckets over time.

### 3. `03 - System Health & Process`
- **Memory Footprint**: Node.js Heap Used vs Resident Set Size (RSS) in MB.
- **CPU Utilization**: CPU percent usage derived from `process_cpu_seconds_total`.
- **Event Loop Lag**: Node.js event loop delay in seconds.
- **Active Requests**: Current count of concurrent HTTP requests.

### 4. `04 - Redis & Database Health`
- **Redis Health Status**: `HEALTHY` (1) or `DOWN` (0) status derived from `/ready` probe.
- **Supabase DB Status**: `HEALTHY` (1) or `DOWN` (0) status.
- **Redis & DB Latency**: P95 query execution latency graphs.

### 5. `05 - HTTP Status Codes Breakdown`
- **Status Distribution**: Pie chart breaking down 2xx, 3xx, 4xx, and 5xx responses.
- **Status Codes Over Time**: Time-series graph of specific status codes (200, 400, 401, 404, 500, 503).
