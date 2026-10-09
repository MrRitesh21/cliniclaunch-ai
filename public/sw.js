const CACHE_PREFIX = "clinicx-pwa-";
const CACHE_NAME = `${CACHE_PREFIX}v8`;
const STATIC_ASSETS = [
  "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/pwa-192.png", "/pwa-512.png", "/logo-icon.png", "/logo.png",
];

function publicStaticPath(path) {
  return STATIC_ASSETS.includes(path) ||
    /^\/assets\/[A-Za-z0-9_./-]+\.(?:js|css|png|jpe?g|svg|webp|avif|ico|woff2?)$/.test(path) &&
    !path.split("/").some((part) => part.startsWith("."));
}

function cacheableResponse(response) {
  if (!response || response.status !== 200 || response.redirected || response.type !== "basic") return false;
  if (response.url && new URL(response.url).origin !== self.location.origin) return false;
  if (response.headers.has("set-cookie")) return false;
  const controls = ["cache-control", "cdn-cache-control", "cloudflare-cdn-cache-control", "vercel-cdn-cache-control"];
  if (controls.some((name) => /(?:^|,)\s*(?:private|no-store|no-cache)(?:\s|,|=|$)/i.test(response.headers.get(name) || ""))) return false;
  if ((response.headers.get("vary") || "").split(",").some((v) => /^(?:\*|cookie|authorization)$/i.test(v.trim()))) return false;
  // A 200 HTML login fallback is not a public JS/image/font resource.
  if (/text\/html/i.test(response.headers.get("content-type") || "")) return false;
  return /(?:^|,)\s*public(?:\s|,|$)/i.test(response.headers.get("cache-control") || "");
}

// Never precache HTML: even '/' can depend on a session cookie.
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(STATIC_ASSETS.map(async (path) => {
      try {
        const request = new Request(new URL(path, self.location.origin), { credentials: "omit" });
        const response = await fetch(request);
        if (cacheableResponse(response)) await cache.put(request, response);
      } catch { /* Offline installation may retain no static assets. */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

function offlineResponse(html = false) {
  return new Response(html
    ? '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ClinicX offline</title><body><h1>ClinicX is offline</h1><p>Reconnect to sign in or access your clinic. Private records are not available offline.</p><a href="/">Retry</a></body></html>'
    : "Offline or Network Error", {
    status: 503,
    headers: { "Content-Type": html ? "text/html; charset=utf-8" : "text/plain", "Cache-Control": "no-store" },
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  let url;
  try { url = new URL(request.url); } catch { return; }
  if (!/^https?:$/.test(url.protocol) || url.origin !== self.location.origin ||
    request.method !== "GET" || url.search ||
    request.headers.has("authorization") || request.headers.has("cookie")) return;

  // Public root shell is network-only; the fallback is fixed non-private HTML.
  if (url.pathname === "/" && request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(fetch(request).catch(() => offlineResponse(true)));
    return;
  }
  if (!publicStaticPath(url.pathname)) return;

  event.respondWith((async () => {
    const publicRequest = new Request(request, { credentials: "omit" });
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(publicRequest);
      if (cacheableResponse(response)) {
        event.waitUntil(cache.put(publicRequest, response.clone()).catch(() => {}));
      } else {
        // Don't resurrect a public entry after a privacy-policy change.
        await cache.delete(publicRequest);
      }
      return response;
    } catch {
      const cached = await cache.match(publicRequest);
      if (cached && cacheableResponse(cached)) return cached;
      return offlineResponse();
    }
  })());
});

// ---------------------------------------------------------------------------
// Update handling — the page can ask a waiting worker to activate immediately.
// ---------------------------------------------------------------------------
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ---------------------------------------------------------------------------
// Web Push (RFC 8291). Payload shape:
// { title, body, icon, badge, url, tag, renotify, data }
// ---------------------------------------------------------------------------
function safeUrl(rawUrl) {
  // Only same-origin paths may be opened from a notification.
  try {
    const target = new URL(rawUrl || "/", self.location.origin);
    if (target.origin !== self.location.origin) return self.location.origin + "/";
    return target.href;
  } catch {
    return self.location.origin + "/";
  }
}

function devicePlatform() {
  const ua = self.navigator && self.navigator.userAgent ? self.navigator.userAgent : "";
  if (/Android/.test(ua)) return "android";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  return "desktop";
}

// Analytics beacon. The notification token proves this device received the push.
function reportPushEvent(data, name) {
  if (!data || !data.nid || !data.ntoken) return Promise.resolve();
  return fetch("/api/public/push-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nid: data.nid,
      token: data.ntoken,
      event: name,
      platform: devicePlatform(),
    }),
    keepalive: true,
  }).catch(() => {});
}

self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: "ClinicX", body: event.data.text() };
    }
  }

  const title = payload.title || "ClinicX";
  const url = safeUrl(payload.url);

  event.waitUntil(
    Promise.all([
      reportPushEvent(payload.data, "delivered"),
      self.registration.showNotification(title, {
        body: payload.body || "",
        icon: payload.icon || "/icon-512.png",
        badge: payload.badge || "/icon-512.png",
        tag: payload.tag || undefined,
        renotify: payload.renotify === true,
        data: { ...(payload.data || {}), url },
        actions: Array.isArray(payload.actions) ? payload.actions.slice(0, 2) : undefined,
      }),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safeUrl(event.notification.data && event.notification.data.url);

  event.waitUntil(
    (async () => {
      await reportPushEvent(event.notification.data, "clicked");
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Prefer focusing an existing window instead of opening a duplicate tab.
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(url);
            } catch {
              /* focused window kept as-is */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

// Browser rotated the subscription — re-subscribe and let the app resync on
// next load (the page re-registers the fresh endpoint with the backend).
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription || (await self.registration.pushManager.getSubscription());
      const key =
        (event.newSubscription && event.newSubscription.options.applicationServerKey) ||
        (old && old.options && old.options.applicationServerKey);
      if (!key) return;
      try {
        await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        });
      } catch {
        /* the app will re-subscribe on next visit */
      }
    })(),
  );
});
