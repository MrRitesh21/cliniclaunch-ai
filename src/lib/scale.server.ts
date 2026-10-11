/**
 * Horizontal-scale primitives: distributed rate limiting, edge cache policy,
 * and load shedding. Server-only.
 *
 * Why this file exists: the older in-memory limiters (`rate-limit.ts`,
 * `rate-limiter.ts`) keep state per worker isolate. Cloudflare spins up many
 * isolates and Render restarts containers, so an in-memory "40 req/min" budget
 * is really "40 per isolate" — effectively unlimited under real traffic. These
 * helpers use a shared counter when Redis is ready, and fall back to a
 * local counter only when Redis is unreachable (fail-soft, never fail-closed).
 */

import { isIP } from "node:net";
import { serverEnv } from "@/lib/env.server";

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
    test: (p) =>
      p.includes("/book") || p.includes("/walkin") || p.startsWith("/r/") || p.startsWith("/l/"),
    tier: { name: "write", limit: 12, windowSeconds: 60 },
  },
  // Auth surfaces — brute-force protection.
  {
    test: (p) =>
      p.startsWith("/auth") ||
      p.startsWith("/login") ||
      p.startsWith("/register") ||
      p.startsWith("/signup") ||
      p.startsWith("/admin/login"),
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

const PUBLIC_FILES = new Set([
  "/favicon.ico", "/favicon.svg", "/icon-192.png", "/icon-512.png",
  "/pwa-192.png", "/pwa-512.png",
  "/logo.png", "/logo.jpg", "/logo-icon.png", "/logo-transparent.png",
  "/manifest.json", "/manifest.webmanifest", "/robots.txt", "/sitemap.xml",
]);

function decodedPath(path: string): string | null {
  try {
    // Also catch double-encoded dotfiles before framework routing.
    for (let i = 0; i < 2; i++) {
      const next = decodeURIComponent(path);
      if (next === path) break;
      path = next;
    }
    return path;
  } catch { return null; }
}

/** Defense in depth; static-host/build exclusions are required as well. */
export function isBlockedFilePath(path: string): boolean {
  const decoded = decodedPath(path);
  if (decoded === null || /[\\\\\u0000]/.test(decoded)) return true;
  const segments = decoded.split("/");
  return segments.some((s) =>
    (s.startsWith(".") && s !== ".well-known") ||
    /^(?:\.env.*|\.git|\.wwebjs_auth|\.wwebjs_cache|sessions?|auth_info_baileys|node_modules)$/i.test(s)
  ) || /\.(?:map|pem|key|sqlite|sqlite3|db|bak)$/i.test(decoded);
}

/** Build-output namespace plus enumerated public files, not arbitrary suffixes. */
function isPublicStaticPath(path: string): boolean {
  if (isBlockedFilePath(path) || decodedPath(path) !== path) return false;
  return PUBLIC_FILES.has(path) ||
    /^\/assets\/[A-Za-z0-9_./-]+\.(?:js|css|png|jpe?g|svg|webp|avif|ico|woff2?)$/.test(path);
}

/** Only explicitly public infrastructure bypasses request budgets. */
export function isInfraPath(path: string): boolean {
  return path === "/api/public/healthz" || isPublicStaticPath(path);
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
  // Vercel overwrites its provider header. All other deployments must opt in
  // only after sealing the origin and configuring a proxy to overwrite it.
  const configured = serverEnv.CLINICX_TRUSTED_PROXY_HEADER?.toLowerCase();
  const allowedHeaders = ["cf-connecting-ip", "x-real-ip", "x-forwarded-for", "x-vercel-forwarded-for"];
  const header = serverEnv.VERCEL === "1" ? "x-vercel-forwarded-for"
    : configured && allowedHeaders.includes(configured) ? configured : null;
  const value = header ? request.headers.get(header)?.trim() : null;
  // Reject chains, zone identifiers and arbitrary attacker-controlled keys.
  if (!value || value.length > 45 || value.includes("%") || !isIP(value)) return "anon";
  // Canonicalize IPv6 spellings so equivalent addresses share a budget.
  return value.includes(":") ? new URL(`http://[${value}]/`).hostname.slice(1, -1) : value;
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
/* Named endpoint policies (Redis-backed, shared across instances)     */
/* ------------------------------------------------------------------ */

/**
 * Every sensitive endpoint declares its budget here instead of hard-coding
 * numbers at the call site, so the limits are auditable in one place.
 * `ip` budgets stop a single host hammering the endpoint; `id` budgets stop a
 * single phone number / email cycling hosts.
 */
export const LIMIT_POLICIES = {
  booking_ip: {
    limit: 20,
    windowSeconds: 900,
    message: "Too many booking attempts from this network. Please try again in a few minutes.",
  },
  booking_phone: {
    limit: 5,
    windowSeconds: 900,
    message: "You've made several booking requests already. Please call the clinic instead.",
  },
  consult_ip: {
    limit: 60,
    windowSeconds: 300,
    message: "Too many consult requests. Please wait a moment and refresh.",
  },
  auth_ip: {
    limit: 15,
    windowSeconds: 600,
    message: "Too many sign-in attempts from this network. Please try again in a few minutes.",
  },
  auth_identity: {
    limit: 8,
    windowSeconds: 600,
    message: "Too many attempts for this account. Please wait 10 minutes or reset your password.",
  },
  lead_ip: {
    limit: 15,
    windowSeconds: 600,
    message: "Too many requests from this network. Please try again shortly.",
  },
  lead_phone: {
    limit: 5,
    windowSeconds: 600,
    message: "Too many request attempts. Please try again in a few minutes.",
  },
} as const;

export type LimitPolicyName = keyof typeof LIMIT_POLICIES;

/** Client IP for the current server-function / route request. */
export async function callerIp(request?: Request): Promise<string> {
  if (request) return clientKey(request);
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    return clientKey(getRequest());
  } catch {
    return "anon";
  }
}

/**
 * Redis-backed check for a named policy. Returns the verdict; never throws.
 */
export async function checkPolicy(
  policy: LimitPolicyName,
  key: string,
): Promise<{ allowed: boolean; remaining: number; message: string }> {
  const p = LIMIT_POLICIES[policy];
  const allowed = await limitAction(`${policy}:${key}`, p.limit, p.windowSeconds);
  return { allowed, remaining: 0, message: p.message };
}

/**
 * Enforce a named policy inside a server function — throws a user-facing error
 * with the policy's message when the budget is exhausted.
 */
export async function enforcePolicy(policy: LimitPolicyName, key: string): Promise<void> {
  const verdict = await checkPolicy(policy, key);
  if (!verdict.allowed) throw new Error(verdict.message);
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

  const privatePolicy: CachePolicy = { cacheControl: "private, no-store", cdnCacheControl: "no-store" };
  // Unknown queries may carry tokens or editor state. Default to non-shareable.
  if (
    (request.method !== "GET" && request.method !== "HEAD") ||
    request.headers.has("authorization") || request.headers.has("cookie") ||
    url.search !== "" || isBlockedFilePath(path) || decodedPath(path) !== path ||
    /^\/(?:dashboard|admin|auth|login|register|signup|consult|onboarding|invite|api|_serverFn|_server|__server|r|l|token|reset-password)(?:[/.]|$)/i.test(path) ||
    /\/(?:book|walkin)(?:[/.]|$)/i.test(path)
  ) return privatePolicy;

  if (isPublicStaticPath(path)) {
    return path.startsWith("/assets/") && /-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|png|jpe?g|svg|webp|avif|ico)$/.test(path)
      ? IMMUTABLE : { cacheControl: "public, max-age=3600" };
  }

  // Public clinic websites: only exact clinic landing page /c/:slug or allowed subroutes (/about, /contact, /services, /book, /walkin)
  const clinicMatch = path.match(/^\/c\/([A-Za-z0-9_-]+)(?:\/([A-Za-z0-9_.-]+))?$/);
  if (clinicMatch) {
    const subroute = clinicMatch[2];
    if (!subroute || subroute === "about" || subroute === "contact" || subroute === "services") {
      return {
        cacheControl: "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
        cdnCacheControl: "max-age=600",
        vary: "Accept-Encoding",
      };
    }
    if (subroute === "book" || subroute === "walkin") {
      return {
        cacheControl: "public, max-age=0, s-maxage=15, stale-while-revalidate=30",
        cdnCacheControl: "max-age=15",
        vary: "Accept-Encoding",
      };
    }
    return privatePolicy;
  }

  // Marketing / SEO pages — fast updates with short edge revalidation
  if (path === "/") {
    return {
      cacheControl: "public, max-age=0, s-maxage=10, must-revalidate",
      cdnCacheControl: "max-age=10",
      vary: "Accept-Encoding",
    };
  }

  if (
    /^\/(?:compare|clinic-software|for)\/[A-Za-z0-9_-]+$/.test(path) ||
    path === "/compare" ||
    path === "/clinic-software" ||
    [
      "/about",
      "/features",
      "/services",
      "/faq",
      "/how-it-works",
      "/contact",
      "/privacy",
      "/terms",
      "/refund-policy",
      "/shipping-policy",
    ].includes(path)
  ) {
    return {
      cacheControl: "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
      cdnCacheControl: "max-age=600",
      vary: "Accept-Encoding",
    };
  }

  if (path === "/sitemap.xml" || path === "/robots.txt") {
    return { cacheControl: "public, max-age=3600, s-maxage=21600" };
  }

  return privatePolicy;
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
const MAX_IN_FLIGHT = Number(serverEnv.MAX_IN_FLIGHT_REQUESTS ?? 120);

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
