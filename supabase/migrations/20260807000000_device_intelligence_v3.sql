-- Migration: Enterprise SaaS Device Intelligence & Security Analytics (v3 Architecture)
-- Target: Supabase / PostgreSQL

-- 1. Security Severity Enum
DO $$ BEGIN
    CREATE TYPE security_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Global Physical Devices Registry (Tenant-Agnostic)
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id TEXT NOT NULL UNIQUE,
    device_hash TEXT NOT NULL,
    fingerprint_version VARCHAR(32) DEFAULT 'fpjs_v3',
    device_confidence INTEGER DEFAULT 90,
    browser TEXT,
    browser_version TEXT,
    os TEXT,
    os_version TEXT,
    device_type TEXT DEFAULT 'desktop',
    platform TEXT,
    screen_resolution TEXT,
    timezone TEXT,
    language TEXT,
    hardware_concurrency INTEGER,
    device_memory INTEGER,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tenant-Scoped User Devices Relationship Table
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
    user_id UUID NOT NULL,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    is_trusted BOOLEAN DEFAULT false,
    is_blocked BOOLEAN DEFAULT false,
    login_count INTEGER DEFAULT 1,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    risk_score INTEGER DEFAULT 0,
    risk_breakdown JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT user_device_unique UNIQUE (user_id, device_id)
);

-- 4. User Active Sessions Table (OAuth Refresh Token Family Rotation)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
    user_id UUID NOT NULL,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    token_family_id UUID NOT NULL DEFAULT gen_random_uuid(),
    ip_hash TEXT NOT NULL,
    country TEXT DEFAULT 'Unknown',
    city TEXT DEFAULT 'Unknown',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN DEFAULT false
);

-- 5. Security Audit Log Events Table
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
    user_id UUID,
    event_type TEXT NOT NULL,
    severity security_severity DEFAULT 'LOW',
    visitor_id TEXT,
    ip_hash TEXT NOT NULL,
    risk_score INTEGER DEFAULT 0,
    risk_breakdown JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Hardware Lifecycle Events Table
CREATE TABLE IF NOT EXISTS device_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Enterprise System Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
    actor_id UUID NOT NULL,
    action TEXT NOT NULL,
    target_id TEXT,
    ip_hash TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Real-time Security Metrics Aggregation Table
CREATE TABLE IF NOT EXISTS security_metrics_realtime (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL UNIQUE DEFAULT 'default_tenant',
    active_sessions INTEGER DEFAULT 0,
    high_risk_last_hour INTEGER DEFAULT 0,
    blocked_attempts INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Daily Aggregated Metrics Table (For Instant Admin Dashboard Reads)
CREATE TABLE IF NOT EXISTS security_metrics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_devices INTEGER DEFAULT 0,
    new_devices INTEGER DEFAULT 0,
    blocked_devices INTEGER DEFAULT 0,
    high_risk_logins INTEGER DEFAULT 0,
    countries JSONB DEFAULT '{}'::jsonb,
    browser_distribution JSONB DEFAULT '{}'::jsonb,
    os_distribution JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT tenant_daily_unique UNIQUE (tenant_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_devices_visitor_id ON devices(visitor_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_hash ON devices(device_hash);
CREATE INDEX IF NOT EXISTS idx_user_devices_tenant_user ON user_devices(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_risk ON user_devices(risk_score);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(tenant_id, user_id, is_revoked);
CREATE INDEX IF NOT EXISTS idx_user_sessions_family ON user_sessions(token_family_id);
CREATE INDEX IF NOT EXISTS idx_security_events_tenant_created ON security_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);

-- Enable Supabase Row Level Security (RLS)
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own devices" ON user_devices
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own active sessions" ON user_sessions
    FOR SELECT USING (auth.uid() = user_id);
