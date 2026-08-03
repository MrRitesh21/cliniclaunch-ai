/**
 * Lightweight & Scalable Sliding-Window Rate Limiter
 * Protects public booking, auth OTP, and AI API endpoints against brute-force and resource abuse.
 */

type RateLimitRecord = {
  tokens: number;
  lastRefill: number;
};

class RateLimiter {
  private limits = new Map<string, RateLimitRecord>();

  /**
   * Check if a request identifier (e.g. IP, user ID, or session token) is allowed.
   * @param identifier Unique request key
   * @param maxRequests Capacity (e.g., 20 requests)
   * @param windowMs Window duration in milliseconds (e.g., 60000ms / 1 min)
   */
  check(identifier: string, maxRequests = 30, windowMs = 60000): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    let record = this.limits.get(identifier);

    if (!record) {
      record = { tokens: maxRequests - 1, lastRefill: now };
      this.limits.set(identifier, record);
      return { allowed: true, remaining: record.tokens, resetMs: windowMs };
    }

    const elapsed = now - record.lastRefill;
    const refillRate = maxRequests / windowMs;
    const refilledTokens = Math.floor(elapsed * refillRate);

    if (refilledTokens > 0) {
      record.tokens = Math.min(maxRequests, record.tokens + refilledTokens);
      record.lastRefill = now;
    }

    if (record.tokens > 0) {
      record.tokens -= 1;
      return { allowed: true, remaining: record.tokens, resetMs: Math.max(0, windowMs - elapsed) };
    }

    return { allowed: false, remaining: 0, resetMs: Math.max(0, windowMs - elapsed) };
  }

  /** Periodic cleanup of stale rate-limit records every 10 minutes */
  cleanup(): void {
    const now = Date.now();
    for (const [id, record] of this.limits.entries()) {
      if (now - record.lastRefill > 600000) {
        this.limits.delete(id);
      }
    }
  }
}

export const rateLimiter = new RateLimiter();

// Run periodic cleanup interval in server context
if (typeof window === "undefined") {
  setInterval(() => rateLimiter.cleanup(), 600000);
}
