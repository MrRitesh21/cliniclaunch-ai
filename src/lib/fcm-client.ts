/**
 * Frontend Firebase Cloud Messaging (FCM) Client Hook & Service
 * Handles browser permission requests, FCM token retrieval, registration,
 * foreground toast alerts, and device management.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getFcmConfig,
  listMyDevices,
  registerDeviceToken,
  sendTestFcmPush,
  unregisterDeviceToken,
} from "./fcm.functions";

export interface FcmDevice {
  id: string;
  token: string;
  platform: string;
  device_name: string | null;
  is_active: boolean;
  last_seen_at: string;
  created_at: string;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function getDeviceName() {
  if (typeof navigator === "undefined") return "Web Browser";
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

  const isIos = /iPad|iPhone|iPod/.test(ua);
  const os = /Android/.test(ua)
    ? "Android"
    : isIos
      ? "iOS Device"
      : /Windows/.test(ua)
        ? "Windows PC"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : "Desktop";

  return `${browser} on ${os}`;
}

export function useFcmNotifications() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [token, setToken] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [devices, setDevices] = useState<FcmDevice[]>([]);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await listMyDevices();
      setDevices(list as FcmDevice[]);
    } catch {
      // User may not be logged in or offline
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (typeof window === "undefined") return;

      const canPush =
        "serviceWorker" in navigator &&
        ("Notification" in window || "PushManager" in window);

      if (cancelled) return;
      setSupported(Boolean(canPush));
      if (!canPush) return;

      if ("Notification" in window) {
        setPermission(Notification.permission);
      }

      // Check FCM config from server
      const cfg = await getFcmConfig().catch(() => null);
      if (cancelled) return;
      setConfigured(cfg?.configured ?? false);

      // Register or ensure service worker is active
      try {
        let reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
            scope: "/",
          }).catch(() => undefined);
        }
        if (!reg) {
          reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
        }

        if (reg?.pushManager && cfg?.vapidKey) {
          const existing = await reg.pushManager.getSubscription().catch(() => null);
          if (existing && !cancelled) {
            setSubscribed(true);
            setToken(existing.endpoint);

            // If permission is already granted, ensure token is registered in DB
            if (Notification.permission === "granted") {
              await registerDeviceToken({
                data: {
                  token: existing.endpoint,
                  platform: /iPhone|iPad|iPod/.test(navigator.userAgent) ? "ios" : /Android/.test(navigator.userAgent) ? "android" : "web",
                  deviceName: getDeviceName(),
                },
              }).catch(() => {});
            }
          }
        }
      } catch (swErr) {
        console.warn("[FCM] Service worker detection notice:", swErr);
      }

      await refreshDevices();
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshDevices]);

  // Request browser permission and register FCM device token
  const enableNotifications = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Push notifications are not supported in this browser.");
      return { ok: false, reason: "unsupported" };
    }

    setBusy(true);
    try {
      // 1. Get Firebase VAPID config
      const cfg = await getFcmConfig();
      if (!cfg || !cfg.vapidKey) {
        toast.error("Firebase FCM is not configured on the server yet.");
        return { ok: false, reason: "not_configured" };
      }

      // 2. Request Notification Permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== "granted") {
        toast.error("Notification permission was denied. Please allow notifications in browser settings.");
        return { ok: false, reason: "denied" };
      }

      // 3. Register service worker
      let reg: ServiceWorkerRegistration | null = null;
      try {
        reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
          scope: "/",
        });
        await navigator.serviceWorker.ready;
      } catch {
        reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
      }

      if (!reg || !reg.pushManager) {
        toast.error("Push messaging manager is unavailable.");
        return { ok: false, reason: "no_push_manager" };
      }

      // 4. Subscribe to PushManager using the Firebase VAPID key
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(cfg.vapidKey) as unknown as BufferSource,
        });
      }

      const activeToken = sub.endpoint;
      setToken(activeToken);
      setSubscribed(true);

      // 5. Register device token on server in Supabase
      const platform = /iPhone|iPad|iPod/.test(navigator.userAgent)
        ? "ios"
        : /Android/.test(navigator.userAgent)
          ? "android"
          : "web";

      await registerDeviceToken({
        data: {
          token: activeToken,
          platform,
          deviceName: getDeviceName(),
        },
      });

      toast.success("Push notifications enabled for this device!");
      await refreshDevices();
      return { ok: true, token: activeToken };
    } catch (err: any) {
      console.error("[FCM] Failed to enable notifications:", err);
      toast.error(err?.message || "Could not enable notifications. Please try again.");
      return { ok: false, reason: "error", error: err?.message };
    } finally {
      setBusy(false);
    }
  }, [refreshDevices]);

  // Disable notifications and unregister token
  const disableNotifications = useCallback(async () => {
    setBusy(true);
    try {
      if (token) {
        await unregisterDeviceToken({ data: { token } }).catch(() => {});
      }

      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager?.getSubscription();
        if (sub) {
          await sub.unsubscribe().catch(() => {});
        }
      }

      setSubscribed(false);
      setToken(null);
      toast.success("Push notifications turned off on this device.");
      await refreshDevices();
      return { ok: true };
    } catch (err: any) {
      toast.error(err?.message || "Could not disable notifications.");
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }, [token, refreshDevices]);

  // Test notification trigger
  const sendTestNotification = useCallback(async () => {
    setBusy(true);
    try {
      const result = await sendTestFcmPush();
      if (result.sent > 0) {
        toast.success(`FCM notification delivered to ${result.sent} device(s)!`);
      } else if (result.removed > 0) {
        toast.info("Inactive tokens cleaned up. Re-enable to register fresh token.");
        await refreshDevices();
      } else {
        toast.info("No active devices found. Enable push on this device first.");
      }
      return result;
    } catch (err: any) {
      toast.error(err?.message || "Test notification failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [refreshDevices]);

  return {
    supported,
    permission,
    token,
    subscribed,
    busy,
    configured,
    devices,
    enableNotifications,
    disableNotifications,
    sendTestNotification,
    refreshDevices,
  };
}
