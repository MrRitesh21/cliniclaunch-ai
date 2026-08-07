import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison for shared secrets. Hashing first makes the
 * two buffers equal length, so `timingSafeEqual` never throws on a
 * length mismatch (and length itself does not leak).
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
