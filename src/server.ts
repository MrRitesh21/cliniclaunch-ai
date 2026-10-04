import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

if (typeof process !== "undefined" && process.env.NODE_ENV !== "test" && Boolean(process.env.REDIS_URL)) {
  import("./lib/queue/worker").then((m) => m.startWorkers()).catch(console.error);
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  const err = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  console.error(err);
  return new Response(renderErrorPage(err), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

let envChecked = false;

function applySecurityHeaders(res: Response, durationMs = 0, pathname = ""): Response {
  const headers = new Headers(res.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  // Allow same-origin and platform iframe previews
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://*.digiwil.com https://*.vercel.app;",
  );
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  headers.set("X-XSS-Protection", "1; mode=block");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (durationMs > 0) {
    headers.set("Server-Timing", `ssr;dur=${durationMs.toFixed(2)}`);
  }

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const startTime = performance.now();
    let released = false;
    let release: (() => void) | null = null;

    try {
      const url = new URL(request.url);

      // 1. Return favicon immediately to prevent browser 500 error logs
      if (url.pathname === "/favicon.ico") {
        return applySecurityHeaders(
          new Response(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20"/></svg>`,
            {
              status: 200,
              headers: {
                "content-type": "image/svg+xml",
                "cache-control": "public, max-age=86400",
              },
            },
          ),
          performance.now() - startTime,
        );
      }

      const scale = await import("./lib/scale.server");
      const infra = scale.isInfraPath(url.pathname);

      // 2. Distributed (Redis-backed) tiered rate limiting.
      //    Shared across every isolate/container, unlike the old per-process map.
      if (!infra) {
        const verdict = await scale.checkRequestLimit(request, url.pathname);
        if (!verdict.allowed) {
          return applySecurityHeaders(
            new Response(
              JSON.stringify({ error: "Too many requests. Please try again shortly." }),
              {
                status: 429,
                headers: {
                  "content-type": "application/json",
                  "retry-after": String(verdict.retryAfter),
                  "x-ratelimit-limit": String(verdict.limit),
                  "x-ratelimit-remaining": String(verdict.remaining),
                  "cache-control": "no-store",
                },
              },
            ),
            performance.now() - startTime,
          );
        }

        // 3. Load shedding: refuse work past the per-instance concurrency
        //    ceiling instead of OOM-killing the container.
        if (!scale.beginRequest()) {
          return applySecurityHeaders(
            new Response(
              JSON.stringify({ error: "Server is at capacity. Please retry in a moment." }),
              {
                status: 503,
                headers: {
                  "content-type": "application/json",
                  "retry-after": "2",
                  "cache-control": "no-store",
                },
              },
            ),
            performance.now() - startTime,
          );
        }
        release = scale.endRequest;
      }

      // 4. Validate server env safely on initial request
      if (!envChecked) {
        try {
          const { validateServerEnv } = await import("./lib/env.server");
          validateServerEnv();
        } catch (e) {
          console.warn("[server] Environment configuration warning:", e);
        }
        envChecked = true;
      }

      const handler = await getServerEntry();
      const rawResponse = await handler.fetch(request, env, ctx);
      const durationMs = performance.now() - startTime;

      const normalized = await normalizeCatastrophicSsrResponse(rawResponse);

      // 5. Edge cache policy — lets Cloudflare absorb public traffic so
      //    Supabase only ever sees cache misses.
      const policy =
        normalized.status < 400 || normalized.status === 404
          ? scale.edgeCachePolicy(request, url)
          : null;

      if (policy) {
        const headers = new Headers(normalized.headers);
        headers.set("cache-control", policy.cacheControl);
        if (policy.cdnCacheControl) {
          headers.set("cdn-cache-control", policy.cdnCacheControl);
          headers.set("cloudflare-cdn-cache-control", policy.cdnCacheControl);
        }
        if (policy.vary) headers.set("vary", policy.vary);
        return applySecurityHeaders(
          new Response(normalized.body, {
            status: normalized.status,
            statusText: normalized.statusText,
            headers,
          }),
          durationMs,
        );
      }

      return applySecurityHeaders(normalized, durationMs);
    } catch (error) {
      console.error(error);
      return applySecurityHeaders(
        new Response(renderErrorPage(error), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        }),
        performance.now() - startTime,
      );
    } finally {
      if (release && !released) {
        released = true;
        release();
      }
    }
  },
};
