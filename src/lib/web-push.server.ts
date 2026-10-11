/**
 * Standards-based Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) implemented
 * with Web Crypto only, so it runs in the Cloudflare Worker runtime where the
 * `web-push` npm package (node crypto/https) is not usable.
 */
import { serverEnv } from "@/lib/env.server";

export type PushPayload = {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  /** Same-origin path the notification should open, e.g. "/dashboard/appointments". */
  url?: string;
  tag?: string;
  renotify?: boolean;
  data?: Record<string, unknown>;
};

export type PushTarget = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushResult = {
  endpoint: string;
  ok: boolean;
  status: number;
  /** True when the push service says the subscription is gone (404/410). */
  expired: boolean;
  error?: string;
};

const enc = new TextEncoder();

function b64uToBytes(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = pad + "=".repeat((4 - (pad.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64u(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey("raw", ikm as unknown as ArrayBuffer, "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt as unknown as ArrayBuffer,
      info: info as unknown as ArrayBuffer,
    },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

/** RFC 8291 message encryption. Returns the aes128gcm body. */
async function encryptPayload(target: PushTarget, plaintext: Uint8Array): Promise<Uint8Array> {
  const clientPublic = b64uToBytes(target.p256dh);
  const authSecret = b64uToBytes(target.auth);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const localKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const localPublic = new Uint8Array(await crypto.subtle.exportKey("raw", localKeys.publicKey));

  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublic as unknown as ArrayBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, localKeys.privateKey, 256),
  );

  const prk = await hkdf(
    authSecret,
    ecdhSecret,
    concat(enc.encode("WebPush: info\0"), clientPublic, localPublic),
    32,
  );
  const cek = await hkdf(salt, prk, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, prk, enc.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey(
    "raw",
    cek as unknown as ArrayBuffer,
    "AES-GCM",
    false,
    ["encrypt"],
  );
  // A single record: payload + 0x02 padding delimiter.
  const record = concat(plaintext, new Uint8Array([2]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as unknown as ArrayBuffer, tagLength: 128 },
      aesKey,
      record as unknown as ArrayBuffer,
    ),
  );

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  return concat(salt, recordSize, new Uint8Array([localPublic.length]), localPublic, ciphertext);
}

/** RFC 8292 VAPID Authorization header value for one push origin. */
async function vapidHeader(
  audience: string,
  publicKey: string,
  privateKey: string,
  subject: string,
) {
  const pub = b64uToBytes(publicKey);
  if (pub.length !== 65 || pub[0] !== 4)
    throw new Error("VAPID_PUBLIC_KEY must be an uncompressed P-256 point");
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64u(pub.slice(1, 33)),
    y: bytesToB64u(pub.slice(33, 65)),
    d: privateKey,
    ext: true,
  };
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const header = bytesToB64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = bytesToB64u(
    enc.encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: subject,
      }),
    ),
  );
  const signingInput = `${header}.${claims}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      enc.encode(signingInput) as unknown as ArrayBuffer,
    ),
  );
  return `vapid t=${signingInput}.${bytesToB64u(sig)}, k=${publicKey}`;
}

export function getVapidConfig() {
  const publicKey =
    serverEnv.VAPID_PUBLIC_KEY ||
    "BB-vfIqGId228AlJeru8ZqePSS953h6A7fwfgP-90yStlQj09Ka3Xuk5KibiDL95VyxSSLzIfJSgPSyPcpjeGLo";
  const privateKey =
    serverEnv.VAPID_PRIVATE_KEY ||
    "_PldHkiZcxiONkrTFCZieU-bfddu2mjAWQOtR5mDO6c";
  const subject = serverEnv.VAPID_SUBJECT || "mailto:support@clinicx.in";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

/** Sends one notification to one subscription. Never throws for transport errors. */
export async function sendPush(
  target: PushTarget,
  payload: PushPayload,
  opts: { ttl?: number; urgency?: "very-low" | "low" | "normal" | "high" } = {},
): Promise<PushResult> {
  const vapid = getVapidConfig();
  if (!vapid) {
    return {
      endpoint: target.endpoint,
      ok: false,
      status: 0,
      expired: false,
      error: "VAPID keys not configured",
    };
  }

  try {
    const audience = new URL(target.endpoint).origin;
    const [body, authorization] = await Promise.all([
      encryptPayload(target, enc.encode(JSON.stringify(payload))),
      vapidHeader(audience, vapid.publicKey, vapid.privateKey, vapid.subject),
    ]);

    const res = await fetch(target.endpoint, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(opts.ttl ?? 60 * 60 * 24),
        Urgency: opts.urgency ?? "normal",
      },
      body: body as unknown as BodyInit,
    });

    return {
      endpoint: target.endpoint,
      ok: res.ok,
      status: res.status,
      expired: res.status === 404 || res.status === 410,
      error: res.ok ? undefined : await res.text().catch(() => undefined),
    };
  } catch (e) {
    return {
      endpoint: target.endpoint,
      ok: false,
      status: 0,
      expired: false,
      error: e instanceof Error ? e.message : "Unknown push error",
    };
  }
}

/**
 * Fan-out to every active subscription of a user (multi-device) and clean up
 * endpoints the push service reports as gone. Also writes the alert into the
 * in-app inbox and records one analytics event per device.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  opts: { inbox?: boolean; category?: string } = {},
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { createNotification, getUserPlanContext, hashEndpoint, recordPushEvents } =
    await import("./notifications.server");

  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, platform, categories, quiet_start, quiet_end, timezone")
    .eq("user_id", userId)
    .eq("enabled", true);

  if (error) throw error;

  // The inbox row exists even when no device is subscribed, so alerts are never lost.
  const notification =
    opts.inbox === false
      ? null
      : await createNotification({
          userId,
          title: payload.title,
          body: payload.body,
          url: payload.url,
          category: opts.category ?? "general",
        }).catch(() => null);

  const { organizationId, planId } = await getUserPlanContext(userId);

  const category = opts.category ?? "general";
  const eligible = (subs ?? []).filter((s) => {
    const cats = (s as { categories?: string[] | null }).categories;
    if (cats && cats.length && !cats.includes(category)) return false;
    return !inQuietHours(s as QuietWindow);
  });

  if (!eligible.length)
    return { sent: 0, failed: 0, removed: 0, notificationId: notification?.id ?? null };

  const enriched: PushPayload = {
    ...payload,
    url: notification ? appendNotificationId(payload.url, notification.id) : payload.url,
    data: {
      ...(payload.data ?? {}),
      ...(notification ? { nid: notification.id, ntoken: notification.event_token } : {}),
    },
  };

  const results = await Promise.all(eligible.map((s) => sendPush(s as PushTarget, enriched)));

  const expired = results.filter((r) => r.expired).map((r) => r.endpoint);
  if (expired.length) {
    await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", expired);
  }

  const okEndpoints = results.filter((r) => r.ok).map((r) => r.endpoint);
  if (okEndpoints.length) {
    await supabaseAdmin
      .from("push_subscriptions")
      .update({ last_used_at: new Date().toISOString(), failure_count: 0 })
      .in("endpoint", okEndpoints);
  }

  const platformByEndpoint = new Map(eligible.map((s) => [s.endpoint, s.platform ?? null]));
  await recordPushEvents(
    await Promise.all(
      results.map(async (r) => ({
        notificationId: notification?.id ?? null,
        userId,
        organizationId,
        event: (r.ok ? "sent" : "failed") as "sent" | "failed",
        endpointHash: await hashEndpoint(r.endpoint),
        platform: platformByEndpoint.get(r.endpoint) ?? null,
        planId,
      })),
    ),
  ).catch(() => undefined);

  return {
    sent: okEndpoints.length,
    failed: results.filter((r) => !r.ok).length,
    removed: expired.length,
    notificationId: notification?.id ?? null,
  };
}

type QuietWindow = {
  quiet_start?: string | null;
  quiet_end?: string | null;
  timezone?: string | null;
};

/** True when the device's local clock sits inside its quiet-hours window (wrap-around aware). */
function inQuietHours(sub: QuietWindow, now = new Date()) {
  if (!sub.quiet_start || !sub.quiet_end) return false;
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":");
    return Number(h) * 60 + Number(m ?? 0);
  };
  let local: string;
  try {
    local = new Intl.DateTimeFormat("en-GB", {
      timeZone: sub.timezone || "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);
  } catch {
    return false;
  }
  const cur = toMinutes(local);
  const start = toMinutes(sub.quiet_start);
  const end = toMinutes(sub.quiet_end);
  return start <= end ? cur >= start && cur < end : cur >= start || cur < end;
}

/** Deep-link URLs carry the notification id so opening it can mark it read. */
function appendNotificationId(url: string | undefined, id: string) {
  const path = url && url.startsWith("/") ? url : "/dashboard";
  return path.includes("?") ? `${path}&n=${id}` : `${path}?n=${id}`;
}
