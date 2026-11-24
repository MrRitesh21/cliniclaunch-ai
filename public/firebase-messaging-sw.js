/**
 * ClinicX Firebase Cloud Messaging (FCM) Service Worker
 * Handles background push notifications, click deep-linking, and delivery reporting.
 */

// Import Firebase compat scripts from Google CDN
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// Initialize Firebase in Service Worker using URL query params or defaults
const urlParams = new URL(location.href).searchParams;
const firebaseConfig = {
  apiKey: urlParams.get("apiKey") || "",
  authDomain: urlParams.get("authDomain") || "",
  projectId: urlParams.get("projectId") || "",
  messagingSenderId: urlParams.get("messagingSenderId") || "",
  appId: urlParams.get("appId") || "",
};

let messaging = null;
try {
  if (firebase.apps.length === 0 && firebaseConfig.projectId) {
    firebase.initializeApp(firebaseConfig);
  }
  if (firebase.apps.length > 0) {
    messaging = firebase.messaging();
  }
} catch (e) {
  console.warn("[FCM SW] Firebase compat initialization notice:", e);
}

function safeUrl(rawUrl) {
  try {
    const target = new URL(rawUrl || "/dashboard", self.location.origin);
    if (target.origin !== self.location.origin) return self.location.origin + "/dashboard";
    return target.href;
  } catch {
    return self.location.origin + "/dashboard";
  }
}

// Background message handler when Firebase messaging is active
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || payload.data?.title || "ClinicX Alert";
    const body = payload.notification?.body || payload.data?.body || "";
    const icon = payload.notification?.icon || payload.data?.icon || "/icon-512.png";
    const url = safeUrl(payload.data?.url || payload.fcmOptions?.link || "/dashboard");

    return self.registration.showNotification(title, {
      body,
      icon,
      badge: "/icon-512.png",
      tag: payload.data?.tag || `clinicx-fcm-${Date.now()}`,
      data: {
        ...(payload.data || {}),
        url,
      },
      requireInteraction: true,
      vibrate: [200, 100, 200],
    });
  });
}

// Standalone Push event listener as resilient fallback
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { notification: { title: "ClinicX", body: event.data.text() } };
  }

  // If handled by onBackgroundMessage, avoid double notification
  const notificationTitle =
    payload.notification?.title || payload.data?.title || payload.title || "ClinicX Alert";
  const notificationBody =
    payload.notification?.body || payload.data?.body || payload.body || "";
  const icon = payload.notification?.icon || payload.data?.icon || "/icon-512.png";
  const url = safeUrl(payload.data?.url || payload.fcmOptions?.link || payload.url || "/dashboard");

  event.waitUntil(
    self.registration.showNotification(notificationTitle, {
      body: notificationBody,
      icon,
      badge: "/icon-512.png",
      tag: payload.data?.tag || `clinicx-push-${Date.now()}`,
      data: {
        ...(payload.data || {}),
        url,
      },
      requireInteraction: true,
      vibrate: [200, 100, 200],
    }),
  );
});

// Deep link navigation on notification tap
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safeUrl(event.notification.data?.url);

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(url);
            } catch {}
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
