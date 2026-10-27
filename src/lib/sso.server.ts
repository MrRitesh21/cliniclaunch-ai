import crypto from "node:crypto";

export const CLINICX_SSO_SECRET =
  process.env.CLINICX_SSO_SECRET ||
  process.env.AUTH_SECRET ||
  "clinicx_waflow_sso_shared_secret_2026_secure_key";

export interface SsoPayload {
  email: string;
  name?: string;
  phone?: string;
  role?: "doctor" | "admin" | "staff";
  clinicSlug?: string;
  target?: string;
  timestamp: number;
}

/**
 * Validates an HMAC-SHA256 signed SSO token from WAFlow CRM
 */
export function verifySsoToken(data: string, sig: string): { valid: boolean; payload?: SsoPayload; error?: string } {
  try {
    if (!data || !sig) {
      return { valid: false, error: "Missing SSO data token or signature" };
    }

    const expectedSig = crypto
      .createHmac("sha256", CLINICX_SSO_SECRET)
      .update(data)
      .digest("hex");

    if (sig !== expectedSig) {
      return { valid: false, error: "Invalid SSO signature. Token may have been altered." };
    }

    const jsonStr = Buffer.from(data, "base64url").toString("utf8");
    const payload: SsoPayload = JSON.parse(jsonStr);

    // Validate expiration: 20 minutes window to allow slight clock drift
    const now = Date.now();
    const tokenTime = payload.timestamp || 0;
    const diff = Math.abs(now - tokenTime);
    if (diff > 20 * 60 * 1000) {
      return { valid: false, error: "SSO session link has expired. Please launch from WAFlow CRM again." };
    }

    if (!payload.email || typeof payload.email !== "string") {
      return { valid: false, error: "Missing doctor/user email in SSO token" };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: err?.message || "Failed to decode SSO token" };
  }
}

/**
 * Generates deterministic secure password for user created through SSO
 */
export function generateSsoDeterministicPassword(email: string): string {
  const clean = email.trim().toLowerCase();
  return (
    crypto
      .createHmac("sha256", CLINICX_SSO_SECRET)
      .update(`clinicx_sso_pwd_${clean}`)
      .digest("hex")
      .slice(0, 20) + "Aa1!"
  );
}

/**
 * Helper to generate SSO token (used for testing or bi-directional redirects)
 */
export function createSsoToken(payload: Omit<SsoPayload, "timestamp">): { data: string; sig: string; url: string } {
  const fullPayload: SsoPayload = {
    ...payload,
    timestamp: Date.now(),
  };
  const data = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const sig = crypto.createHmac("sha256", CLINICX_SSO_SECRET).update(data).digest("hex");
  const baseUrl = process.env.CLINICLAUNCH_URL || "https://clinicx.digiwil.com";
  const url = `${baseUrl.replace(/\/+$/, "")}/sso?data=${data}&sig=${sig}`;
  return { data, sig, url };
}
