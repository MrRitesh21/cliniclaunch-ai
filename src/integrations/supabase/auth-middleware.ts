/**
 * @module auth-middleware
 * @description JWT authentication middleware for TanStack Start server functions.
 *
 * `requireSupabaseAuth` is a TanStack Start middleware that:
 * 1. Extracts the Bearer token from the `Authorization` header.
 * 2. Verifies the token by calling `supabase.auth.getClaims(token)`.
 * 3. Caches verified claims per-token for up to 60 seconds to avoid redundant
 *    Supabase round-trips on hot paths (e.g., polling server functions).
 * 4. Injects `{ supabase, userId, claims }` into the server function context.
 *
 * ## Usage
 * ```ts
 * export const myServerFn = createServerFn({ method: "GET" })
 *   .middleware([requireSupabaseAuth])
 *   .handler(async ({ context }) => {
 *     const { userId, supabase } = context;
 *     // supabase client is scoped to the caller's JWT
 *   });
 * ```
 *
 * ## Security notes
 * - The Supabase client created here uses the caller's Bearer token in its
 *   `Authorization` header, so all queries are subject to Row Level Security.
 * - Service-role escalation must be done explicitly via `client.server.ts` —
 *   never pass the service-role client through this middleware context.
 * - Token caching is bounded at 500 entries and purged on TTL expiry.
 *
 * @see {@link withTenantContext} for subsequent tenant isolation verification
 */
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const verifiedClaimsCache = new Map<string, { claims: Record<string, unknown>; expiresAt: number }>();

function getCachedClaims(token: string) {
  const cached = verifiedClaimsCache.get(token);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.claims;
  }
  if (cached) {
    verifiedClaimsCache.delete(token);
  }
  return null;
}

function setCachedClaims(token: string, claims: Record<string, unknown>) {
  const expSeconds = typeof claims.exp === "number" ? claims.exp : undefined;
  const tokenExpiresAt = expSeconds ? expSeconds * 1000 : Date.now() + 60_000;
  const expiresAt = Math.min(Date.now() + 60_000, tokenExpiresAt);
  verifiedClaimsCache.set(token, { claims, expiresAt });
  if (verifiedClaimsCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of verifiedClaimsCache) {
      if (v.expiresAt <= now) verifiedClaimsCache.delete(k);
    }
  }
}

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY =
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      const missing = [
        ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
        ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
      ];
      const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Connect Supabase in Lovable Cloud.`;
      console.error(`[Supabase] ${message}`);
      throw new Error(message);
    }

    const request = getRequest();

    if (!request?.headers) {
      throw new Error("Unauthorized: No request headers available");
    }

    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      throw new Error("Unauthorized: No authorization header provided");
    }

    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized: Only Bearer tokens are supported");
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      throw new Error("Unauthorized: No token provided");
    }

    const supabase = createClient<Database>(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    let claims = getCachedClaims(token);
    if (!claims) {
      const { data, error } = await supabase.auth.getClaims(token);
      if (error || !data?.claims) {
        throw new Error("Unauthorized: Invalid token");
      }
      claims = data.claims as Record<string, unknown>;
      setCachedClaims(token, claims);
    }

    if (!claims.sub) {
      throw new Error("Unauthorized: No user ID found in token");
    }

    return next({
      context: {
        supabase,
        userId: claims.sub as string,
        claims,
      },
    });
  },
);
