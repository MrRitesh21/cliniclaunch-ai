/**
 * @module token-crypto.server
 * @description Secure AES-256-GCM encryption and decryption for sensitive tokens (Google refresh tokens).
 *
 * Uses crypto from Node.js stdlib (WebCrypto compatible).
 * If TOKEN_ENCRYPTION_KEY is not explicitly set, derives a consistent key from
 * SUPABASE_SERVICE_ROLE_KEY or an internal deployment secret.
 */

import crypto from "node:crypto";
import { serverEnv } from "./env.server";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard 96-bit IV for AES-GCM
const TAG_LENGTH = 16; // 128-bit authentication tag

/**
 * Returns a 32-byte Buffer key derived using SHA-256.
 */
function getEncryptionKey(): Buffer {
  const explicitKey = serverEnv.TOKEN_ENCRYPTION_KEY || process.env.TOKEN_ENCRYPTION_KEY;
  if (explicitKey && explicitKey.trim().length >= 16) {
    return crypto.createHash("sha256").update(explicitKey.trim()).digest();
  }

  const fallbackSeed =
    serverEnv.SUPABASE_SERVICE_ROLE_KEY ||
    serverEnv.SUPABASE_PUBLISHABLE_KEY ||
    "clinicx-default-secure-token-salt-2026";

  return crypto.createHash("sha256").update(`clinicx-gbp-salt:${fallbackSeed}`).digest();
}

/**
 * Encrypts a plaintext token string into base64url encoded: iv.authTag.cipherText
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

/**
 * Decrypts a base64url encoded token string (iv.authTag.cipherText) back to plaintext.
 * Returns null if tampering or decryption fails.
 */
export function decryptToken(encryptedString: string): string | null {
  if (!encryptedString) return null;
  const parts = encryptedString.split(".");
  if (parts.length !== 3) return null;

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(parts[0], "base64url");
    const tag = Buffer.from(parts[1], "base64url");
    const ciphertext = Buffer.from(parts[2], "base64url");

    if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) return null;

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (err) {
    console.error("[token-crypto] Token decryption failed:", (err as Error).message);
    return null;
  }
}
