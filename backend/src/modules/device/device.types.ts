/**
 * Backend Device & Security Module TypeScript Definitions
 */

export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface GlobalDeviceRecord {
  id: string;
  visitor_id: string;
  device_hash: string;
  fingerprint_version: string;
  device_confidence: number;
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
  device_type: string;
  platform: string;
  screen_resolution: string;
  timezone: string;
  language: string;
  hardware_concurrency?: number;
  device_memory?: number;
  first_seen: string;
  last_seen: string;
  created_at: string;
  updated_at: string;
}

export interface RiskFactorBreakdown {
  new_device?: number;
  trusted_device?: number;
  blocked_device?: number;
  new_country?: number;
  vpn_detected?: number;
  tor_detected?: number;
  datacenter_ip?: number;
  impossible_travel?: number;
  failed_login_attempts?: number;
  multiple_accounts?: number;
  [key: string]: number | undefined;
}

export interface UserDeviceRecord {
  id: string;
  tenant_id: string;
  user_id: string;
  device_id: string;
  is_trusted: boolean;
  is_blocked: boolean;
  login_count: number;
  first_seen: string;
  last_seen: string;
  risk_score: number;
  risk_breakdown: RiskFactorBreakdown;
  created_at: string;
  updated_at: string;
  device?: GlobalDeviceRecord;
}

export interface UserSessionRecord {
  id: string;
  tenant_id: string;
  user_id: string;
  device_id: string;
  session_token: string;
  token_family_id: string;
  ip_hash: string;
  country: string;
  city: string;
  created_at: string;
  last_activity: string;
  expires_at: string;
  is_revoked: boolean;
  device?: GlobalDeviceRecord;
}

export interface SecurityEventRecord {
  id: string;
  tenant_id: string;
  user_id?: string;
  event_type: string;
  severity: SecuritySeverity;
  visitor_id?: string;
  ip_hash: string;
  risk_score: number;
  risk_breakdown: RiskFactorBreakdown;
  metadata: Record<string, any>;
  created_at: string;
}

export interface AuditLogRecord {
  id: string;
  tenant_id: string;
  actor_id: string;
  action: string;
  target_id?: string;
  ip_hash: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface RiskEvaluationResult {
  score: number; // 0-100
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  breakdown: RiskFactorBreakdown;
  confidence: number; // 0-100
}

export interface DeviceLoginPayload {
  visitorId: string;
  deviceHash: string;
  fingerprintVersion?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  deviceType?: string;
  platform?: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  userId: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RealtimeSecurityStats {
  tenantId: string;
  totalDevices: number;
  activeSessions: number;
  highRiskLastHour: number;
  blockedAttempts: number;
  averageRiskScore: number;
}
