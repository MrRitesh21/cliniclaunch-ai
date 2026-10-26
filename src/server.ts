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

  // No process-global captured exception: it may belong to another request.
  const err = new Error("SSR request failed");
  console.error(err);
  return new Response(renderErrorPage(err), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
  });
}

let envChecked = false;

function mergeSecurityCsp(existing: string): string {
  const directives = existing.split(";").map((v) => v.trim()).filter(Boolean);
  for (const directive of ["frame-ancestors 'self'", "base-uri 'self'", "object-src 'none'"]) {
    const name = directive.split(" ")[0];
    if (!directives.some((v) => v.split(/\s+/)[0].toLowerCase() === name)) directives.push(directive);
  }
  return directives.join("; ") + ";";
}

function applySecurityHeaders(res: Response, durationMs = 0, isEmbeddable = false): Response {
  const headers = new Headers(res.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  if (isEmbeddable) {
    // Custom website booking widget: allow embedding in external iframes
    headers.delete("X-Frame-Options");
    headers.set(
      "Content-Security-Policy",
      "frame-ancestors *; base-uri 'self'; object-src 'none';",
    );
    headers.set("Access-Control-Allow-Origin", "*");
  } else {
    // Same-origin website-builder previews; no wildcard third-party tenants.
    headers.set("X-Frame-Options", "SAMEORIGIN");
    headers.set(
      "Content-Security-Policy",
      res.headers.get("Content-Security-Policy")
        ? mergeSecurityCsp(res.headers.get("Content-Security-Policy")!)
        : "frame-ancestors 'self'; base-uri 'self'; object-src 'none';",
    );
  }
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  headers.set("X-XSS-Protection", "0");
  headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(self)");
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
    let isEmbeddable = false;

    try {
      const url = new URL(request.url);
      isEmbeddable =
        url.pathname.includes("/book") ||
        url.searchParams.get("embed") === "true" ||
        url.searchParams.get("embed") === "1" ||
        url.pathname === "/widget.js";

      const scale = await import("./lib/scale.server");
      if (scale.isBlockedFilePath(url.pathname)) {
        return applySecurityHeaders(new Response("Not Found", {
          status: 404, headers: { "cache-control": "private, no-store" },
        }), 0, isEmbeddable);
      }

      // 1. Return favicon immediately to prevent browser 500 error logs
      if (url.pathname === "/favicon.ico") {
        const isPersonalized = request.headers.has("cookie") || request.headers.has("authorization") || Boolean(url.search);
        return applySecurityHeaders(
          new Response(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20"/></svg>`,
            {
              status: 200,
              headers: {
                "content-type": "image/svg+xml",
                "cache-control": isPersonalized ? "private, no-store" : "public, max-age=86400",
              },
            },
          ),
          performance.now() - startTime,
          isEmbeddable,
        );
      }

      const infra = scale.isInfraPath(url.pathname) &&
        !request.headers.has("authorization") && !request.headers.has("cookie") && !url.search;

      // 2. Redis-backed budgets when available; per-instance fail-soft fallback.
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
            isEmbeddable,
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
            isEmbeddable,
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

      // Request policy is necessary, not sufficient: never promote a private
      // handler response (including Set-Cookie or identity-sensitive Vary).
      const headers = new Headers(normalized.headers);
      const controls = ["cache-control", "cdn-cache-control", "cloudflare-cdn-cache-control", "vercel-cdn-cache-control"];
      const responsePrivate = headers.has("set-cookie") ||
        controls.some((name) => /(?:^|,)\s*(?:private|no-store|no-cache)(?:\s|,|=|$)/i.test(headers.get(name) ?? "")) ||
        (headers.get("vary") ?? "").split(",").some((v) => /^(?:\*|cookie|authorization)$/i.test(v.trim()));
      const policy = scale.edgeCachePolicy(request, url);
      if (responsePrivate || normalized.status >= 400 || !policy || policy.cacheControl.includes("private")) {
        headers.set("cache-control", "private, no-store");
        for (const name of controls.slice(1)) headers.set(name, "no-store");
      } else {
        // Respect an explicit upstream lifetime; use defaults only if absent.
        if (!headers.has("cache-control")) headers.set("cache-control", policy.cacheControl);
        if (!normalized.headers.has("cache-control") && policy.cdnCacheControl) {
          for (const name of controls.slice(1)) if (!headers.has(name)) headers.set(name, policy.cdnCacheControl);
        }
        if (policy.vary) {
          for (const value of policy.vary.split(",")) headers.append("vary", value.trim());
        }
      }
      return applySecurityHeaders(new Response(normalized.body, {
        status: normalized.status, statusText: normalized.statusText, headers,
      }), durationMs, isEmbeddable);
    } catch (error) {
      console.error(error);
      return applySecurityHeaders(
        new Response(renderErrorPage(error), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        }),
        performance.now() - startTime,
        isEmbeddable,
      );
    } finally {
      if (release && !released) {
        released = true;
        release();
      }
    }
  },
};
