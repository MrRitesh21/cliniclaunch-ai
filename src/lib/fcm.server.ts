/**
 * Firebase Cloud Messaging (FCM) HTTP v1 Provider
 * Built with pure Web Crypto (RFC 7515 / RS256) for universal compatibility
 * across Cloudflare Workers, Node.js, and Vercel Edge runtimes with zero external dependencies.
 */
import { serverEnv } from "@/lib/env.server";

export interface FcmNotificationPayload {
  title: string;
  body: string;
  actionUrl?: string;
  tag?: string;
  notificationType?: string;
  clinicId?: string;
  data?: Record<string, string>;
  notificationId?: string;
}

export interface FcmSendResult {
  token: string;
  ok: boolean;
  status: number;
  expired: boolean;
  messageId?: string;
  error?: string;
}

export interface SendPushNotificationOptions {
  clinicId?: string;
  recipientUserId?: string;
  recipientUserIds?: string[];
  role?: "doctor" | "staff" | "patient" | "owner" | "all";
  title: string;
  body: string;
  notificationType?:
    | "booking"
    | "appointment"
    | "cancellation"
    | "reschedule"
    | "reminder"
    | "patient_registration"
    | "inquiry"
    | "payment"
    | "followup"
    | "announcement"
    | "operational"
    | "general"
    | (string & {});
  data?: Record<string, string | number | boolean | null | undefined>;
  actionUrl?: string;
  tag?: string;
  createInboxItem?: boolean;
}

// In-memory token cache with expiration timestamp
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

function b64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64UrlFromString(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return b64Url(bytes);
}

function pemToBinary(pem: string): ArrayBuffer {
  const cleanPem = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\\n/g, "")
    .replace(/\s+/g, "");

  const raw = atob(cleanPem);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    buf[i] = raw.charCodeAt(i);
  }
  return buf.buffer;
}

export function getFcmServerConfig() {
  const projectId = serverEnv.FIREBASE_PROJECT_ID?.trim() || "";
  const clientEmail = serverEnv.FIREBASE_CLIENT_EMAIL?.trim() || "";
  let privateKey = serverEnv.FIREBASE_PRIVATE_KEY?.trim() || "";

  // Normalize private key escapes if provided via env string
  if (privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  const isConfigured = Boolean(projectId && clientEmail && privateKey);
  return {
    projectId,
    clientEmail,
    privateKey,
    isConfigured,
  };
}

/**
 * Generates an OAuth2 Google Access Token using RS256 signed JWT assertion
 * Valid for 1 hour; cached in memory for 50 minutes.
 */
export async function getFcmAccessToken(): Promise<string | null> {
  const config = getFcmServerConfig();
  if (!config.isConfigured) return null;

  const now = Math.floor(Date.now() / 1000);

  // Return cached token if valid for at least 5 more minutes
  if (cachedToken && cachedToken.expiresAt > now + 300) {
    return cachedToken.accessToken;
  }

  try {
    const keyBuffer = pemToBinary(config.privateKey);
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      keyBuffer,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["sign"],
    );

    const header = b64UrlFromString(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = b64UrlFromString(
      JSON.stringify({
        iss: config.clientEmail,
        sub: config.clientEmail,
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
      }),
    );

    const signingInput = new TextEncoder().encode(`${header}.${claims}`);
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, signingInput);
    const signedJwt = `${header}.${claims}.${b64Url(new Uint8Array(signature))}`;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: signedJwt,
      }).toString(),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[FCM] Failed to obtain OAuth2 token from Google:", res.status, errText);
      return null;
    }

    const json = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = {
      accessToken: json.access_token,
      expiresAt: now + (json.expires_in || 3600),
    };

    return cachedToken.accessToken;
  } catch (err) {
    console.error("[FCM] Exception deriving OAuth2 token:", err);
    return null;
  }
}

/**
 * Sends a single notification payload to one device token via FCM HTTP v1 API.
 * Detects invalid / expired tokens (404, UNREGISTERED) for automated cleanup.
 */
export async function sendFcmMessage(
  token: string,
  payload: FcmNotificationPayload,
): Promise<FcmSendResult> {
  const config = getFcmServerConfig();
  if (!config.isConfigured) {
    return {
      token,
      ok: false,
      status: 0,
      expired: false,
      error: "Firebase FCM credentials not configured on server",
    };
  }

  const accessToken = await getFcmAccessToken();
  if (!accessToken) {
    return {
      token,
      ok: false,
      status: 0,
      expired: false,
      error: "Could not obtain Firebase OAuth2 token",
    };
  }

  const actionUrl = payload.actionUrl || "/dashboard";

  // Sanitize data dictionary: all values must be strings for FCM
  const fcmData: Record<string, string> = {
    url: actionUrl,
    notificationId: payload.notificationId || "",
    clinicId: payload.clinicId || "",
    notificationType: payload.notificationType || "general",
  };

  if (payload.data) {
    for (const [k, v] of Object.entries(payload.data)) {
      if (v != null) fcmData[k] = String(v);
    }
  }

  const requestBody = {
    message: {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: fcmData,
      webpush: {
        fcm_options: {
          link: actionUrl,
        },
        notification: {
          icon: "/icon-512.png",
          badge: "/icon-512.png",
          tag: payload.tag || "clinicx-alert",
          requireInteraction: true,
        },
      },
      android: {
        priority: "HIGH" as const,
        notification: {
          icon: "notification_icon",
          color: "#0891B2",
          sound: "default",
          channel_id: "clinicx_alerts",
          click_action: "OPEN_CLINICX",
        },
      },
      apns: {
        headers: {
          "apns-priority": "10",
        },
        payload: {
          aps: {
            sound: "default",
            badge: 1,
            alert: {
              title: payload.title,
              body: payload.body,
            },
          },
        },
      },
    },
  };

  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${config.projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
    );

    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { name?: string };
      return {
        token,
        ok: true,
        status: res.status,
        expired: false,
        messageId: data.name,
      };
    }

    const errJson = (await res.json().catch(() => ({}))) as {
      error?: { code?: number; message?: string; status?: string; details?: any[] };
    };

    const statusStr = errJson?.error?.status || "";
    const isUnregistered =
      res.status === 404 ||
      statusStr === "UNREGISTERED" ||
      statusStr === "INVALID_ARGUMENT" ||
      (errJson?.error?.message || "").includes("Requested entity was not found");

    return {
      token,
      ok: false,
      status: res.status,
      expired: isUnregistered,
      error: errJson?.error?.message || `FCM Error HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      token,
      ok: false,
      status: 0,
      expired: false,
      error: e instanceof Error ? e.message : "Network error contacting FCM",
    };
  }
}

/**
 * High-level centralized push notification dispatcher.
 * Handles recipient resolution, preferences, database inbox logging, multi-device fan-out,
 * and automated expired token cleanup.
 */
export async function sendPushNotification(options: SendPushNotificationOptions): Promise<{
  sent: number;
  failed: number;
  removed: number;
  notificationId: string | null;
  error?: string;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1. Resolve recipients list
  let userIds: string[] = [];
  if (options.recipientUserId) {
    userIds.push(options.recipientUserId);
  }
  if (options.recipientUserIds && options.recipientUserIds.length > 0) {
    userIds.push(...options.recipientUserIds);
  }

  // If role is specified and clinicId is given, resolve users in clinic
  if (options.clinicId && options.role && options.role !== "patient") {
    const { data: clinicMembers } = await supabaseAdmin
      .from("clinics")
      .select("owner_id, organization_id")
      .eq("id", options.clinicId)
      .maybeSingle();

    if (clinicMembers?.owner_id && (options.role === "owner" || options.role === "doctor" || options.role === "all")) {
      userIds.push(clinicMembers.owner_id);
    }

    if (clinicMembers?.organization_id && (options.role === "staff" || options.role === "all")) {
      const { data: orgStaff } = await supabaseAdmin
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", clinicMembers.organization_id);

      if (orgStaff) {
        userIds.push(...orgStaff.map((m: any) => m.user_id));
      }
    }
  }

  userIds = [...new Set(userIds.filter(Boolean))];

  if (userIds.length === 0) {
    return { sent: 0, failed: 0, removed: 0, notificationId: null, error: "No recipients identified" };
  }

  let primaryNotificationId: string | null = null;
  let totalSent = 0;
  let totalFailed = 0;
  let totalRemoved = 0;

  // 2. Iterate each recipient user
  for (const userId of userIds) {
    // Check user preferences
    const { data: prefs } = await supabaseAdmin
      .from("user_notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (prefs && prefs.push_enabled === false) {
      // User disabled push notifications; still log in-app if requested
      if (options.createInboxItem !== false) {
        await supabaseAdmin.from("notifications").insert({
          user_id: userId,
          clinic_id: options.clinicId || null,
          title: options.title,
          body: options.body,
          url: options.actionUrl || "/dashboard",
          category: options.notificationType || "general",
          notification_type: options.notificationType || "general",
          delivery_status: "skipped_user_preference",
        });
      }
      continue;
    }

    // 3. Create Notification history item
    let notifRecord: { id: string } | null = null;
    if (options.createInboxItem !== false) {
      const { data: insertedNotif } = await supabaseAdmin
        .from("notifications")
        .insert({
          user_id: userId,
          clinic_id: options.clinicId || null,
          title: options.title,
          body: options.body,
          url: options.actionUrl || "/dashboard",
          category: options.notificationType || "general",
          notification_type: options.notificationType || "general",
          delivery_status: "pending",
          meta: (options.data || {}) as never,
        })
        .select("id")
        .maybeSingle();

      notifRecord = insertedNotif;
      if (!primaryNotificationId && insertedNotif?.id) {
        primaryNotificationId = insertedNotif.id;
      }
    }

    // 4. Query active device tokens for recipient
    const { data: tokens, error: tokensErr } = await supabaseAdmin
      .from("device_tokens")
      .select("id, token, platform")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (tokensErr || !tokens || tokens.length === 0) {
      if (notifRecord?.id) {
        await supabaseAdmin
          .from("notifications")
          .update({ delivery_status: "no_active_devices" })
          .eq("id", notifRecord.id);
      }
      continue;
    }

    // 5. Send FCM push to all registered devices in parallel
    const fcmPayload: FcmNotificationPayload = {
      title: options.title,
      body: options.body,
      actionUrl: options.actionUrl || "/dashboard",
      tag: options.tag || `notif-${Date.now()}`,
      notificationType: options.notificationType || "general",
      clinicId: options.clinicId,
      data: options.data,
      notificationId: notifRecord?.id,
    };

    const results = await Promise.all(
      tokens.map((d: any) => sendFcmMessage(d.token, fcmPayload)),
    );

    // 6. Cleanup invalid / unregistered tokens automatically
    const expiredTokens = results.filter((r) => r.expired).map((r) => r.token);
    if (expiredTokens.length > 0) {
      await supabaseAdmin
        .from("device_tokens")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in("token", expiredTokens);
      totalRemoved += expiredTokens.length;
    }

    const successfulTokens = results.filter((r) => r.ok).map((r) => r.token);
    if (successfulTokens.length > 0) {
      await supabaseAdmin
        .from("device_tokens")
        .update({ last_seen_at: new Date().toISOString() })
        .in("token", successfulTokens);
    }

    const sentCount = results.filter((r) => r.ok).length;
    const failedCount = results.filter((r) => !r.ok && !r.expired).length;

    totalSent += sentCount;
    totalFailed += failedCount;

    if (notifRecord?.id) {
      await supabaseAdmin
        .from("notifications")
        .update({
          delivery_status: sentCount > 0 ? "delivered" : "failed",
        })
        .eq("id", notifRecord.id);
    }
  }

  return {
    sent: totalSent,
    failed: totalFailed,
    removed: totalRemoved,
    notificationId: primaryNotificationId,
  };
}
