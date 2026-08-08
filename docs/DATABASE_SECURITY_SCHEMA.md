# PostgreSQL Database & Security Schema Documentation

## 🗄️ Normalized Schema Architecture (v3)

### 1. `devices` (Global Physical Device Registry)
- Stores physical device identities shared across tenants for cross-tenant fraud detection.
- `id` (UUID PRIMARY KEY)
- `visitor_id` (TEXT UNIQUE)
- `device_hash` (TEXT SHA256)
- `fingerprint_version` (VARCHAR)
- `device_confidence` (INTEGER 0-100)
- `browser`, `browser_version`, `os`, `os_version`, `device_type`, `platform`, `screen_resolution`, `timezone`, `language`

### 2. `user_devices` (Tenant-Scoped User Binding)
- Many-to-many relationship linking users to global physical devices.
- `id`, `tenant_id`, `user_id`, `device_id`, `is_trusted`, `is_blocked`, `login_count`, `risk_score`, `risk_breakdown` (JSONB)

### 3. `user_sessions` (OAuth Refresh Token Family Rotation)
- Tracks active sessions with token family reuse revocation.
- `id`, `tenant_id`, `user_id`, `device_id`, `session_token`, `token_family_id`, `ip_hash` (GDPR SHA256), `country`, `city`, `is_revoked`

### 4. `security_events` & `device_events`
- `security_events`: User security audit trail (`event_type`, `severity`, `risk_score`, `risk_breakdown`).
- `device_events`: Hardware lifecycle events (`DEVICE_CREATED`, `DEVICE_CHANGED`).

### 5. Aggregated Metric Tables
- `security_metrics_realtime`: Active sessions, high-risk 1h, blocked attempts.
- `security_metrics_daily`: Pre-aggregated daily metrics for sub-10ms admin dashboard rendering.
