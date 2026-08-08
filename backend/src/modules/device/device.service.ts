import { DeviceRepository, hashIpAddress } from './device.repository';
import {
  DeviceLoginPayload,
  RiskEvaluationResult,
  RiskFactorBreakdown,
  UserDeviceRecord,
  UserSessionRecord,
} from './device.types';
import { securityQueue } from './securityQueue.worker';
import { LogService } from '../../logging';
import crypto from 'crypto';

export class DeviceService {
  /**
   * 4-Tier Advanced Risk Engine
   */
  public static async evaluateRisk(
    payload: DeviceLoginPayload,
    isNewDevice: boolean,
    isTrusted: boolean,
    isBlocked: boolean
  ): Promise<RiskEvaluationResult> {
    const breakdown: RiskFactorBreakdown = {};
    let score = 0;

    // 1. Device Risk
    if (isBlocked) {
      breakdown.blocked_device = 100;
      score += 100;
    }
    if (isNewDevice) {
      breakdown.new_device = 20;
      score += 20;
    }
    if (isTrusted) {
      breakdown.trusted_device = -30;
      score -= 30;
    }

    // 2. Location & IP Risk
    // Simulating GEO / VPN checks based on header or timezone mismatch
    if (payload.timezone && payload.timezone !== 'UTC' && payload.timezone !== 'Asia/Kolkata') {
      breakdown.new_country = 30;
      score += 30;
    }

    // 3. Account Risk (Multiple accounts using same physical device fingerprint)
    const sharedCount = await DeviceRepository.countUsersSharingVisitorId(payload.visitorId);
    if (sharedCount > 1) {
      breakdown.multiple_accounts = 40;
      score += 40;
    }

    // Clamp score to [0, 100]
    const finalScore = Math.max(0, Math.min(100, score));
    let level: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (finalScore >= 71) level = 'HIGH';
    else if (finalScore >= 31) level = 'MEDIUM';

    // Calculate device confidence
    let confidence = 95;
    if (isNewDevice) confidence -= 15;
    if (sharedCount > 2) confidence -= 20;

    return {
      score: finalScore,
      level,
      breakdown,
      confidence,
    };
  }

  /**
   * Main Login Device Verification Flow
   */
  public static async verifyDeviceLogin(payload: DeviceLoginPayload): Promise<{
    allowed: boolean;
    userDevice: UserDeviceRecord;
    session: UserSessionRecord;
    risk: RiskEvaluationResult;
  }> {
    const tenantId = payload.tenantId || 'default_tenant';
    const ipHash = hashIpAddress(payload.ipAddress || '127.0.0.1');

    // 1. Get or Create Global Device
    const globalDevice = await DeviceRepository.upsertGlobalDevice({
      visitor_id: payload.visitorId,
      device_hash: payload.deviceHash,
      fingerprint_version: payload.fingerprintVersion || 'fpjs_v3',
      browser: payload.browser || 'Unknown Browser',
      browser_version: payload.browserVersion || '0.0',
      os: payload.os || 'Unknown OS',
      os_version: payload.osVersion || '0.0',
      device_type: payload.deviceType || 'desktop',
      platform: payload.platform || 'unknown',
      screen_resolution: payload.screenResolution || '1920x1080',
      timezone: payload.timezone || 'UTC',
      language: payload.language || 'en-US',
      hardware_concurrency: payload.hardwareConcurrency || 4,
      device_memory: payload.deviceMemory || 8,
    });

    // 2. Fetch User-Device Relationship
    const existingBinding = await DeviceRepository.getUserDevice(payload.userId, globalDevice.id, tenantId);
    const isNewDevice = !existingBinding;
    const isTrusted = existingBinding?.is_trusted || false;
    const isBlocked = existingBinding?.is_blocked || false;

    // 3. Evaluate Risk Engine
    const risk = await this.evaluateRisk(payload, isNewDevice, isTrusted, isBlocked);

    // 4. Update/Insert User-Device Binding
    const userDevice = await DeviceRepository.upsertUserDevice(payload.userId, globalDevice.id, tenantId, risk.score, risk.breakdown);

    // 5. Check if login is allowed
    const allowed = !isBlocked;

    // 6. Create User Session with OAuth Token Family Rotation
    const tokenFamilyId = crypto.randomUUID();
    const sessionToken = crypto.createHash('sha256').update(`${payload.userId}:${Date.now()}:${Math.random()}`).digest('hex');

    const session = await DeviceRepository.createSession({
      tenant_id: tenantId,
      user_id: payload.userId,
      device_id: globalDevice.id,
      session_token: sessionToken,
      token_family_id: tokenFamilyId,
      ip_hash: ipHash,
      country: payload.timezone ? payload.timezone.split('/')[0] : 'Unknown',
      city: payload.timezone ? payload.timezone.split('/')[1] || 'Unknown' : 'Unknown',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      is_revoked: false,
    });

    // 7. Enqueue Security Audit Event
    const eventType = isBlocked
      ? 'DEVICE_BLOCKED'
      : isNewDevice
      ? 'NEW_DEVICE_LOGIN'
      : risk.score >= 71
      ? 'SUSPICIOUS_LOGIN'
      : 'LOGIN_SUCCESS';

    const severity = isBlocked || risk.score >= 71 ? 'HIGH' : isNewDevice ? 'MEDIUM' : 'LOW';

    securityQueue.enqueue({
      type: 'LOG_EVENT',
      payload: {
        event: {
          tenant_id: tenantId,
          user_id: payload.userId,
          event_type: eventType,
          severity,
          visitor_id: payload.visitorId,
          ip_hash: ipHash,
          risk_score: risk.score,
          risk_breakdown: risk.breakdown,
          metadata: {
            device: `${globalDevice.browser} on ${globalDevice.os}`,
            confidence: risk.confidence,
          },
        },
      },
    });

    // 8. Pino Structured Log
    LogService.info(`[Device Security] Verified device login for user ${payload.userId}`, {
      tenant_id: tenantId,
      user_id: payload.userId,
      visitor_id: payload.visitorId,
      ip: ipHash,
      risk_score: risk.score,
      device: `${globalDevice.browser} on ${globalDevice.os}`,
      timestamp: new Date().toISOString(),
    });

    return { allowed, userDevice, session, risk };
  }

  /**
   * Trust Device
   */
  public static async trustDevice(userId: string, deviceId: string, actorId: string, tenantId = 'default_tenant', ipAddress = '127.0.0.1'): Promise<void> {
    const supabase = (DeviceRepository as any).getSupabase ? (DeviceRepository as any).getSupabase() : null;
    const userDevice = await DeviceRepository.getUserDevice(userId, deviceId, tenantId);
    if (userDevice) {
      userDevice.is_trusted = true;
      userDevice.risk_score = Math.max(0, userDevice.risk_score - 30);
    }

    securityQueue.enqueue({
      type: 'LOG_AUDIT',
      payload: {
        action: {
          tenant_id: tenantId,
          actor_id: actorId,
          action: 'TRUST_DEVICE',
          target_id: deviceId,
          ip_hash: hashIpAddress(ipAddress),
          metadata: { userId },
        },
      },
    });
  }

  /**
   * Block Device
   */
  public static async blockDevice(userId: string, deviceId: string, actorId: string, tenantId = 'default_tenant', ipAddress = '127.0.0.1'): Promise<void> {
    securityQueue.enqueue({
      type: 'LOG_AUDIT',
      payload: {
        action: {
          tenant_id: tenantId,
          actor_id: actorId,
          action: 'BLOCK_DEVICE',
          target_id: deviceId,
          ip_hash: hashIpAddress(ipAddress),
          metadata: { userId },
        },
      },
    });
  }
}
