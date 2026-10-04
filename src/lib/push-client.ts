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
      setPublicKey(cfg?.publicKey || DEFAULT_VAPID_PUBLIC_KEY);

      // Ensure service worker is registered
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg && "serviceWorker" in navigator) {
        reg = await navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      }
      if (cancelled) return;
      setServiceWorkerReady(Boolean(reg));
      if (reg && reg.pushManager) {
        const existing = await reg.pushManager.getSubscription().catch(() => null);
        if (!cancelled) setSubscribed(Boolean(existing));
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
      if (!reg.pushManager) {
        return { ok: false, reason: "unsupported" as const };
      }

      let sub = await reg.pushManager.getSubscription().catch(() => null);
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
        });
      }

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
      });

      setSubscribed(true);
      await refreshDevices();
      return { ok: true as const };
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
