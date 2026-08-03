import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

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

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

let envChecked = false;

function applySecurityHeaders(res: Response, durationMs = 0): Response {
  const headers = new Headers(res.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
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
    try {
      const url = new URL(request.url);

      // 1. Return favicon immediately to prevent browser 500 error logs
      if (url.pathname === "/favicon.ico") {
        return applySecurityHeaders(
          new Response(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20"/></svg>`,
            {
              status: 200,
              headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" },
            }
          ),
          performance.now() - startTime
        );
      }

      // 2. Rate Limit Public API & Booking Routes to protect server capacity & costs
      if (url.pathname.startsWith("/api/") || url.pathname.includes("/book")) {
        const { rateLimiter } = await import("./lib/rate-limiter");
        const clientIp = request.headers.get("x-forwarded-for") ?? "client-anon";
        const limit = rateLimiter.check(clientIp, 40, 60000);
        
        if (!limit.allowed) {
          return applySecurityHeaders(
            new Response(JSON.stringify({ error: "Too many requests. Please try again shortly." }), {
              status: 429,
              headers: {
                "content-type": "application/json",
                "retry-after": Math.ceil(limit.resetMs / 1000).toString(),
              },
            }),
            performance.now() - startTime
          );
        }
      }

      // 3. Validate server env safely on initial request
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

      // 4. Attach optimal edge caching headers for Cloudflare CDN & static builds
      if (url.pathname.startsWith("/assets/") || url.pathname.match(/\.(png|jpg|jpeg|svg|webp|js|css|woff2)$/i)) {
        const headers = new Headers(rawResponse.headers);
        headers.set("cache-control", "public, max-age=31536000, immutable");
        return applySecurityHeaders(new Response(rawResponse.body, { status: rawResponse.status, headers }), durationMs);
      }

      // Public Clinic Landing Pages: Micro-cached at Cloudflare edge to survive extreme traffic spikes
      if (url.pathname.startsWith("/c/")) {
        const headers = new Headers(rawResponse.headers);
        headers.set("cache-control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
        headers.set("cdn-cache-control", "max-age=300");
        headers.set("cloudflare-cdn-cache-control", "max-age=600");
        return applySecurityHeaders(new Response(rawResponse.body, { status: rawResponse.status, headers }), durationMs);
      }

      const normalized = await normalizeCatastrophicSsrResponse(rawResponse);
      return applySecurityHeaders(normalized, durationMs);
    } catch (error) {
      console.error(error);
      return applySecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        performance.now() - startTime
      );
    }
  },
};
