/**
 * Production Rate Limiter Utility for SaaS Scalability
 *
 * Implements sliding-window token bucket algorithm to protect public API endpoints,
 * lead capture, booking requests, and auth routes against abuse, DDoS, and spam.
 */

type RateLimitOptions = {
  windowMs?: number; // Time window in milliseconds (default: 60000ms = 1 min)
  maxRequests?: number; // Max requests allowed per window (default: 60)
};

type RateLimitRecord = {
  tokens: number;
  lastReset: number;
};

const storage = new Map<string, RateLimitRecord>();

// Cleanup stale entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of storage.entries()) {
      if (now - record.lastReset > 300000) {
        storage.delete(key);
      }
    }
  }, 300000);
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {},
): { allowed: boolean; remaining: number; resetMs: number } {
  const windowMs = options.windowMs || 60000;
  const maxRequests = options.maxRequests || 60;
  const now = Date.now();

  let record = storage.get(identifier);

  if (!record || now - record.lastReset >= windowMs) {
    record = { tokens: maxRequests, lastReset: now };
    storage.set(identifier, record);
  }

  if (record.tokens > 0) {
    record.tokens -= 1;
    return {
      allowed: true,
      remaining: record.tokens,
      resetMs: windowMs - (now - record.lastReset),
    };
  }

  return {
    allowed: false,
    remaining: 0,
    resetMs: windowMs - (now - record.lastReset),
  };
}

/**
 * Express / TanStack Server Route Middleware helper
 */
export function rateLimitMiddleware(reqIdentifier: string, maxRequests = 60, windowMs = 60000) {
  const result = checkRateLimit(reqIdentifier, { maxRequests, windowMs });
  if (!result.allowed) {
    throw new Error(
      `Rate limit exceeded. Too many requests from ${reqIdentifier}. Try again in ${Math.ceil(result.resetMs / 1000)}s.`,
    );
  }
  return result;
}
