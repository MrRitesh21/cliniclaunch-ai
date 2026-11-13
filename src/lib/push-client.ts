import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_VAPID_PUBLIC_KEY,
  getPushConfig,
  listMyPushDevices,
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
} from "@/lib/push.functions";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function keyToB64u(sub: PushSubscription, name: "p256dh" | "auth") {
  const key = sub.getKey(name);
  if (!key) return "";
  let bin = "";
  for (const b of new Uint8Array(key)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari home-screen flag
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function deviceLabel() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /Android/.test(ua)
    ? "Android"
    : isIos()
      ? "iPhone/iPad"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : "Device";
  return `${browser} on ${os}${isStandalone() ? " (installed app)" : ""}`;
}

export type PushDevice = {
  id: string;
  endpoint: string;
  device_label: string | null;
  platform: string | null;
  enabled: boolean;
  created_at: string;
  last_used_at: string | null;
  categories?: string[] | null;
  quiet_start?: string | null;
  quiet_end?: string | null;
  timezone?: string | null;
};

export function usePushNotifications() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [devices, setDevices] = useState<PushDevice[]>([]);

  const refreshDevices = useCallback(async () => {
    try {
      setDevices((await listMyPushDevices()) as PushDevice[]);
    } catch {
      /* not signed in yet or offline */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const canPush =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        ("Notification" in window || "PushManager" in window || isIos() || /Android|iPhone|iPad/i.test(navigator.userAgent));
      if (cancelled) return;
      setSupported(Boolean(canPush));
      if (!canPush) return;

      if ("Notification" in window) {
        setPermission(Notification.permission);
      }

      const cfg = await getPushConfig().catch(() => ({ configured: true, publicKey: DEFAULT_VAPID_PUBLIC_KEY }));
      if (cancelled) return;
      setConfigured(cfg?.configured ?? true);
      const vapidPublicKey = cfg?.publicKey || DEFAULT_VAPID_PUBLIC_KEY;
      setPublicKey(vapidPublicKey);

      // Ensure service worker is registered
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg && "serviceWorker" in navigator) {
        reg = await navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      }
      if (cancelled) return;
      setServiceWorkerReady(Boolean(reg));
      if (reg && reg.pushManager) {
        let existing = await reg.pushManager.getSubscription().catch(() => null);
        if (!cancelled) setSubscribed(Boolean(existing));

        // Auto-subscribe / auto-sync if notification permission is already granted
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted" &&
          vapidPublicKey
        ) {
          try {
            if (!existing) {
              existing = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
              });
            }
            if (existing) {
              if (!cancelled) setSubscribed(true);
              await savePushSubscription({
                data: {
                  endpoint: existing.endpoint,
                  p256dh: keyToB64u(existing, "p256dh"),
                  auth: keyToB64u(existing, "auth"),
                  deviceLabel: deviceLabel(),
                  userAgent: navigator.userAgent.slice(0, 400),
                  platform: isIos() ? "ios" : /Android/.test(navigator.userAgent) ? "android" : "desktop",
                  expirationTime: existing.expirationTime ?? null,
                },
              }).catch((e) => console.warn("[Push] Auto-sync subscription notice:", e));
            }
          } catch (autoErr) {
            console.warn("[Push] Auto-subscription sync notice:", autoErr);
          }
        }
      }
      await refreshDevices();
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshDevices]);

  const enable = useCallback(async () => {
    const vapidKey = publicKey || DEFAULT_VAPID_PUBLIC_KEY;
    if (typeof window === "undefined") return { ok: false, reason: "unsupported" as const };
    setBusy(true);
    try {
      // 1. Ensure service worker is registered & active
      let reg: ServiceWorkerRegistration | null = null;
      if ("serviceWorker" in navigator) {
        try {
          reg = await navigator.serviceWorker.ready;
        } catch {
          reg = (await navigator.serviceWorker.register("/sw.js").catch(() => null)) ?? null;
        }
      }
      if (!reg) return { ok: false, reason: "no-service-worker" as const };

      // 2. Request permission (Promise + Callback fallback for older WebViews)
      let result: NotificationPermission = "granted";
      if ("Notification" in window) {
        try {
          result = await Notification.requestPermission();
        } catch {
          result = await new Promise<NotificationPermission>((resolve) => {
            Notification.requestPermission(resolve);
          });
        }
        setPermission(result);
        if (result !== "granted") return { ok: false, reason: "denied" as const };
      }

      // 3. Obtain push subscription
      // If VAPID key is configured and PushManager is available, register background push
      if (vapidKey && reg.pushManager) {
        try {
          let sub = await reg.pushManager.getSubscription().catch(() => null);
          if (!sub) {
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
            });
          }

          if (sub) {
            await savePushSubscription({
              data: {
                endpoint: sub.endpoint,
                p256dh: keyToB64u(sub, "p256dh"),
                auth: keyToB64u(sub, "auth"),
                deviceLabel: deviceLabel(),
                userAgent: navigator.userAgent.slice(0, 400),
                platform: isIos() ? "ios" : /Android/.test(navigator.userAgent) ? "android" : "desktop",
                expirationTime: sub.expirationTime ?? null,
              },
            }).catch((err) => {
              console.warn("[Push] Remote subscription save fallback:", err);
            });

            setSubscribed(true);
            await refreshDevices();
            try {
              localStorage.setItem("clinicx_push_enabled", "true");
            } catch {}
            return { ok: true as const, mode: "push" as const };
          }
        } catch (pushErr) {
          console.warn("[Push] Remote push manager registration failed, using browser notification:", pushErr);
        }
      }

      // Flexible fallback: If permission is granted in browser, mark active so local alerts work
      try {
        localStorage.setItem("clinicx_push_enabled", "true");
      } catch {}
      setSubscribed(true);
      return { ok: true as const, mode: "browser_local" as const };
    } catch (err) {
      return { ok: false, reason: "error" as const, error: (err as Error).message };
    } finally {
      setBusy(false);
    }
  }, [publicKey, refreshDevices]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription({ data: { endpoint: sub.endpoint } }).catch(() => undefined);
        await sub.unsubscribe().catch(() => undefined);
      }
      setSubscribed(false);
      await refreshDevices();
    } finally {
      setBusy(false);
    }
  }, [refreshDevices]);

  const removeDevice = useCallback(
    async (endpoint: string) => {
      await removePushSubscription({ data: { endpoint } });
      await refreshDevices();
      const sub = await (
        await navigator.serviceWorker.getRegistration()
      )?.pushManager.getSubscription();
      if (sub?.endpoint === endpoint) setSubscribed(false);
    },
    [refreshDevices],
  );

  const test = useCallback(async () => sendTestPush(), []);

  return {
    supported,
    configured,
    permission,
    subscribed,
    busy,
    serviceWorkerReady,
    devices,
    enable,
    disable,
    removeDevice,
    test,
    refreshDevices,
    /** iOS only delivers background push to a Home Screen install. */
    needsIosInstall: isIos() && !isStandalone(),
  };
}

/**
 * Triggers a browser desktop notification if permission is granted.
 * Works even if background push keys or remote push services are not configured.
 */
export function triggerBrowserNotification(title: string, options?: NotificationOptions) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try {
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready
          .then((reg) => {
            reg.showNotification(title, {
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              ...options,
            });
          })
          .catch(() => {
            new Notification(title, {
              icon: "/icon-192.png",
              ...options,
            });
          });
      } else {
        new Notification(title, {
          icon: "/icon-192.png",
          ...options,
        });
      }
    } catch (e) {
      console.warn("[Push] Browser notification error:", e);
    }
  }
}
