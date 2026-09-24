/**
 * Frontend FingerprintJS Device Intelligence Type Contracts
 */

export interface DeviceFingerprintPayload {
  visitorId: string;
  deviceHash: string;
  fingerprintVersion: string;
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
  platform: string;
  screenResolution: string;
  timezone: string;
  language: string;
  colorDepth?: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  timestamp: string;
}

export interface CachedFingerprintData {
  payload: DeviceFingerprintPayload;
  expiresAt: number;
}
