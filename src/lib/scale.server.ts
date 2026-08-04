/**
 * Horizontal-scale primitives: distributed rate limiting, edge cache policy,
 * and load shedding. Server-only.
 *
 * Why this file exists: the older in-memory limiters (`rate-limit.ts`,
 * `rate-limiter.ts`) keep state per worker isolate. Cloudflare spins up many
 * isolates and Render restarts containers, so an in-memory "40 req/min" budget
 * is really "40 per isolate" — effectively unlimited under real traffic. These
 * helpers put the counter in Redis so the budget is global, and fall back to a
 * local counter only when Redis is unreachable (fail-soft, never fail-closed).
 */

type Tier = {
  name: string;
  limit: number;
  windowSeconds: number;
};

/**
 * Per-path-class budgets. Tuned for ~15k concurrent users where the majority
 * of traffic is anonymous patients on public clinic sites.
 */
const TIERS: Array<{ test: (path: string) => boolean; tier: Tier }> = [
  // Writes that create rows / send messages — tightest budget.
  {
    test: (p) => p.includes("/book") || p.includes("/walkin") || p.startsWith("/r/") || p.startsWith("/l/"),
    tier: { name: "write", limit: 12, windowSeconds: 60 },
  },
  // Auth surfaces — brute-force protection.
  {
    test: (p) => p.startsWith("/auth") || p.startsWith("/login") || p.startsWith("/register") || p.startsWith("/signup") || p.startsWith("/admin/login"),
    tier: { name: "auth", limit: 10, windowSeconds: 60 },
  },
  // Webhooks and cron are signature/key verified inside the handler; keep a
  // generous ceiling so a legitimate burst from Razorpay is never dropped.
  {
    test: (p) => p.startsWith("/api/public/hooks") || p.includes("/cron"),
    tier: { name: "hook", limit: 600, windowSeconds: 60 },
  },
  // Server functions and general API traffic.
  {
    test: (p) => p.startsWith("/api/") || p.startsWith("/_serverFn"),
    tier: { name: "api", limit: 120, windowSeconds: 60 },
  },
];

const DEFAULT_TIER: Tier = { name: "page", limit: 300, windowSeconds: 60 };

/** Paths that must never be rate limited or shed. */
export function isInfraPath(path: string): boolean {
  return (
    path === "/api/public/healthz" ||
    path.startsWith("/assets/") ||
    path.startsWith("/favicon") ||
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    /\.(png|jpg|jpeg|svg|webp|avif|ico|js|css|woff2?|map|json|txt|xml)$/i.test(path)
  );
}

function tierFor(path: string): Tier {
  for (const { test, tier } of TIERS) {
    if (test(path)) return tier;
  }
  return DEFAULT_TIER;
}

/** Local fallback counter, used only while Redis is down. */
const localWindows = new Map<string, { count: number; resetAt: number }>();

function localRateLimit(key: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const entry = localWindows.get(key);
  if (!entry || now > entry.resetAt) {
    localWindows.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, resetSeconds: windowSeconds };
  }
  entry.count += 1;
  // Opportunistic cleanup so the map can't grow unbounded.
  if (localWindows.size > 20_000) {
    for (const [k, v] of localWindows) {
      if (now > v.resetAt) localWindows.delete(k);
    }
  }
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

function clientKey(request: Request): string {
  const h = request.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anon"
  );
}

export type LimitVerdict = {
  allowed: boolean;
  tier: string;
  limit: number;
  remaining: number;
  retryAfter: number;
};

/**
 * Distributed sliding-window check. Never throws — a Redis outage degrades to
 * the local counter rather than blocking traffic.
 */
export async function checkRequestLimit(request: Request, path: string): Promise<LimitVerdict> {
  const tier = tierFor(path);
  const key = `${tier.name}:${clientKey(request)}`;

  try {
    const { redisCache } = await import("./redis");
    if (redisCache.isReady()) {
      const r = await redisCache.rateLimit(key, tier.limit, tier.windowSeconds);
      return {
        allowed: r.allowed,
        tier: tier.name,
        limit: tier.limit,
        remaining: r.remaining,
        retryAfter: tier.windowSeconds,
      };
    }
  } catch {
    // fall through to local
  }

  const r = localRateLimit(key, tier.limit, tier.windowSeconds);
  return {
    allowed: r.allowed,
    tier: tier.name,
    limit: tier.limit,
    remaining: r.remaining,
    retryAfter: r.resetSeconds,
  };
}

/**
 * Per-identity limit for expensive server-side work (AI calls, WhatsApp sends,
 * booking inserts). Call this inside a server function with a stable business
 * key such as `booking:${clinicId}:${phone}`.
 */
export async function limitAction(
  identity: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const { redisCache } = await import("./redis");
    if (redisCache.isReady()) {
      const r = await redisCache.rateLimit(`action:${identity}`, limit, windowSeconds);
      return r.allowed;
    }
  } catch {
    // fall through
  }
  return localRateLimit(`action:${identity}`, limit, windowSeconds).allowed;
}

/* ------------------------------------------------------------------ */
/* Edge cache policy                                                   */
/* ------------------------------------------------------------------ */

export type CachePolicy = {
  cacheControl: string;
  cdnCacheControl?: string;
  vary?: string;
};

const IMMUTABLE: CachePolicy = { cacheControl: "public, max-age=31536000, immutable" };

/**
 * Cloudflare-facing cache policy. `s-maxage` lets the edge absorb the request
 * while `stale-while-revalidate` means a cache miss never blocks a visitor on
 * a cold Supabase query — this is what keeps public traffic off the database.
 */
export function edgeCachePolicy(request: Request, url: URL): CachePolicy | null {
  const path = url.pathname;

  // Only GET/HEAD responses are ever shareable.
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  // Hashed build output and static media.
  if (path.startsWith("/assets/") || /\.(png|jpg|jpeg|svg|webp|avif|ico|woff2?|js|css)$/i.test(path)) {
    return IMMUTABLE;
  }

  // Never cache anything personalised or authenticated.
  if (
    path.startsWith("/dashboard") ||
    path.startsWith("/admin") ||
    path.startsWith("/auth") ||
    path.startsWith("/consult") ||
    path.startsWith("/onboarding") ||
    path.startsWith("/invite") ||
    path.startsWith("/api/")
  ) {
    return { cacheControl: "private, no-store" };
  }

  // Preview / live-template renders are per-editor state, not public content.
  if (url.searchParams.has("preview") || url.searchParams.has("tpl") || url.searchParams.has("tc")) {
    return { cacheControl: "private, no-store" };
  }

  // Public clinic websites: the single highest-volume read path.
  if (path.startsWith("/c/")) {
    // Booking/walk-in forms hold live slot availability — cache far shorter.
    const isLive = path.endsWith("/book") || path.endsWith("/walkin");
    return isLive
      ? { cacheControl: "public, max-age=0, s-maxage=15, stale-while-revalidate=30", cdnCacheControl: "max-age=15", vary: "Accept-Encoding" }
      : { cacheControl: "public, max-age=60, s-maxage=600, stale-while-revalidate=86400", cdnCacheControl: "max-age=600", vary: "Accept-Encoding" };
  }

  // Marketing / SEO pages — content changes rarely, cache hard at the edge.
  if (
    path === "/" ||
    path.startsWith("/compare/") ||
    path.startsWith("/clinic-software/") ||
    path.startsWith("/for/") ||
    ["/about", "/features", "/services", "/faq", "/how-it-works", "/contact", "/privacy", "/terms", "/refund-policy", "/shipping-policy"].includes(path)
  ) {
    return { cacheControl: "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400", cdnCacheControl: "max-age=3600", vary: "Accept-Encoding" };
  }

  if (path === "/sitemap.xml" || path === "/robots.txt") {
    return { cacheControl: "public, max-age=3600, s-maxage=21600" };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Load shedding                                                       */
/* ------------------------------------------------------------------ */

let inFlight = 0;

/**
 * Concurrency ceiling per instance. On a 512MB Render container, ~120 in-flight
 * SSR renders is roughly where memory pressure starts causing OOM restarts;
 * shedding excess with a fast 503 + Retry-After is far cheaper than crashing
 * and dropping every in-flight request with it.
 */
const MAX_IN_FLIGHT = Number(process.env.MAX_IN_FLIGHT_REQUESTS ?? 120);

export function beginRequest(): boolean {
  if (inFlight >= MAX_IN_FLIGHT) return false;
  inFlight += 1;
  return true;
}

export function endRequest(): void {
  inFlight = Math.max(0, inFlight - 1);
}

export function currentLoad(): { inFlight: number; max: number } {
  return { inFlight, max: MAX_IN_FLIGHT };
}
