const CACHE_NAME = "clinicx-pwa-v2";
const STATIC_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icon-512.png",
  "/logo-icon.png",
];

// Install Event — pre-cache core static shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
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
        })
      );
    })
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

  // Skip non-GET requests, web sockets, Supabase, and API calls from caching
  if (
    request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
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
      })
  );
});
