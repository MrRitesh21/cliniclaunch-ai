import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { DeviceFingerprintPayload, CachedFingerprintData } from "./fingerprint.types";

const CACHE_KEY = "fingerprint_cache_v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours
const FINGERPRINT_VERSION = "fpjs_v3";

/**
 * Utility to generate SHA-256 hash using Web Crypto API
 */
async function generateSha256(input: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Fallback simple hash for older environments
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    return `fb_${Math.abs(hash).toString(16)}`;
  }
}

/**
 * Parses user agent string into browser and OS metadata
 */
function parseUserAgent(): {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
} {
  const ua = navigator.userAgent;
  let browser = "Unknown Browser";
  let browserVersion = "0.0";
  let os = "Unknown OS";
  let osVersion = "0.0";
  let deviceType: "desktop" | "mobile" | "tablet" | "unknown" = "desktop";

  // Device type detection
  if (/mobile/i.test(ua)) deviceType = "mobile";
  else if (/ipad|tablet/i.test(ua)) deviceType = "tablet";

  // Browser detection
  if (ua.includes("Firefox/")) {
    browser = "Firefox";
    browserVersion = ua.split("Firefox/")[1]?.split(" ")[0] || "0.0";
  } else if (ua.includes("Chrome/")) {
    browser = "Chrome";
    browserVersion = ua.split("Chrome/")[1]?.split(" ")[0] || "0.0";
  } else if (ua.includes("Safari/") && !ua.includes("Chrome")) {
    browser = "Safari";
    browserVersion = ua.split("Version/")[1]?.split(" ")[0] || "0.0";
  } else if (ua.includes("Edg/")) {
    browser = "Edge";
    browserVersion = ua.split("Edg/")[1]?.split(" ")[0] || "0.0";
  }

  // OS detection
  if (ua.includes("Win")) os = "Windows";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return { browser, browserVersion, os, osVersion, deviceType };
}

class FingerprintService {
  private fpPromise: Promise<any> | null = null;

  constructor() {
    // Lazy-load FingerprintJS agent asynchronously without blocking window onload
    if (typeof window !== "undefined") {
      this.initFingerprintJS();
    }
  }

  private async initFingerprintJS() {
    try {
      this.fpPromise = FingerprintJS.load();
    } catch {
      // Fail silently to guarantee rendering performance
    }
  }

  /**
   * Generates or retrieves cached device fingerprint payload
   */
  public async getFingerprint(forceRefresh = false): Promise<DeviceFingerprintPayload> {
    if (typeof window === "undefined") {
      return this.getFallbackPayload("server_side");
    }

    // Check localStorage cache first
    if (!forceRefresh) {
      try {
        const cachedRaw = localStorage.getItem(CACHE_KEY);
        if (cachedRaw) {
          const cached: CachedFingerprintData = JSON.parse(cachedRaw);
          if (cached.expiresAt > Date.now()) {
            return cached.payload;
          }
        }
      } catch {
        // Fallthrough on localStorage access errors
      }
    }

    try {
      if (!this.fpPromise) {
        this.fpPromise = FingerprintJS.load();
      }
      const fp = await this.fpPromise;
      const result = await fp.get();

      const visitorId = result.visitorId || `anon_${Math.random().toString(36).substring(2)}`;
      const { browser, browserVersion, os, osVersion, deviceType } = parseUserAgent();
      const screenResolution = `${window.screen.width}x${window.screen.height}`;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const language = navigator.language || "en-US";
      const platform = navigator.platform || "unknown";

      // Compute stable SHA256 device hash
      const hashInput = `${visitorId}:${browser}:${os}:${screenResolution}`;
      const deviceHash = await generateSha256(hashInput);

      const payload: DeviceFingerprintPayload = {
        visitorId,
        deviceHash,
        fingerprintVersion: FINGERPRINT_VERSION,
        browser,
        browserVersion,
        os,
        osVersion,
        deviceType,
        platform,
        screenResolution,
        timezone,
        language,
        colorDepth: window.screen.colorDepth,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: (navigator as any).deviceMemory,
        timestamp: new Date().toISOString(),
      };

      // Store in localStorage cache
      try {
        const cacheObj: CachedFingerprintData = {
          payload,
          expiresAt: Date.now() + CACHE_TTL_MS,
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObj));
      } catch {
        // Silent failure if localStorage full or blocked
      }

      return payload;
    } catch {
      return this.getFallbackPayload("fp_error");
    }
  }

  private getFallbackPayload(reason: string): DeviceFingerprintPayload {
    const { browser, browserVersion, os, osVersion, deviceType } = parseUserAgent();
    return {
      visitorId: `fallback_${reason}_${Math.random().toString(36).substring(2)}`,
      deviceHash: `hash_${reason}`,
      fingerprintVersion: FINGERPRINT_VERSION,
      browser,
      browserVersion,
      os,
      osVersion,
      deviceType,
      platform: "unknown",
      screenResolution: "1920x1080",
      timezone: "UTC",
      language: "en-US",
      timestamp: new Date().toISOString(),
    };
  }
}

export const fingerprintService = new FingerprintService();
