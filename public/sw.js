const CACHE_NAME = "clinicx-pwa-v7";
const STATIC_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/logo-icon.png",
  "/logo.png",
];

// Install Event — pre-cache core static shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    }),
  );
  self.skipWaiting();
});

// Activate Event — clean up old caches & claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

// Fetch Event — Network First strategy with Cache Fallback
self.addEventListener("fetch", (event) => {
  const request = event.request;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Skip non-HTTP/HTTPS requests (chrome-extension://, moz-extension://, etc.)
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // Skip non-GET requests, web sockets, Supabase, server functions, and API calls from caching
  if (
    request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_server") ||
    url.pathname.startsWith("/__server") ||
    url.pathname.includes("_serverFn") ||
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("supabase") ||
    url.pathname.includes("/realtime/")
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (networkResponse.type === "basic" || networkResponse.type === "cors")
        ) {
          const responseClone = networkResponse.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => {
              cache.put(request, responseClone).catch(() => {});
            })
            .catch(() => {});
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        if (request.headers.get("accept")?.includes("text/html")) {
          const rootCached = await caches.match("/");
          if (rootCached) return rootCached;
        }
        return new Response("Offline or Network Error", {
          status: 503,
          statusText: "Service Unavailable",
          headers: new Headers({ "Content-Type": "text/plain" }),
        });
      }),
  );
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
