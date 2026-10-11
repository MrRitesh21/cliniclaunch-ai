/**
 * @module baileys.server
 * @description Server-only client for the Baileys WhatsApp HTTP gateway.
 *
 * Talks to a self-hosted Baileys HTTP service (`BAILEYS_URL`) that manages
 * WhatsApp Web sessions. Each clinic has its own session identified by
 * `clinicSessionId(clinicId)`. A platform-wide admin session is available
 * as `PLATFORM_ADMIN_SESSION`.
 *
 * **Never** import this module from client code or `*.functions.ts` files —
 * call it only from `*.server.ts` modules or from inside `.handler()` callbacks.
 *
 * @see `whatsapp.ts` for the higher-level automation orchestration
 */

import { serverEnv } from "./env.server";

let cachedBaileysUrl: string | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 15_000;

export async function resolveBaileysUrl(): Promise<string> {
  const now = Date.now();
  if (cachedBaileysUrl !== null && (now - lastCacheTime) < CACHE_TTL_MS) {
    return cachedBaileysUrl;
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("system_settings" as any)
      .select("value")
      .eq("key", "whatsapp_bridge_url")
      .maybeSingle();

    if (data?.value && typeof data.value === "string" && data.value.trim()) {
      cachedBaileysUrl = data.value.trim().replace(/\/+$/, "");
      lastCacheTime = now;
      return cachedBaileysUrl;
    }
  } catch {}

  cachedBaileysUrl = (serverEnv.BAILEYS_URL || "").trim().replace(/\/+$/, "");
  lastCacheTime = now;
  return cachedBaileysUrl;
}

export function setBaileysUrlCache(url?: string | null) {
  if (!url || !url.trim()) {
    cachedBaileysUrl = (serverEnv.BAILEYS_URL || "").trim().replace(/\/+$/, "");
  } else {
    cachedBaileysUrl = url.trim().replace(/\/+$/, "");
  }
  lastCacheTime = Date.now();
}

/** Resolved from system_settings override or BAILEYS_URL env var. */
export function getBaileysUrl(): string {
  if (cachedBaileysUrl !== null) return cachedBaileysUrl;
  return (serverEnv.BAILEYS_URL || "").trim().replace(/\/+$/, "");
}

export type BaileysStatus = {
  id: string;
  ready: boolean;
  hasQr: boolean;
  qr: string | null;
  clientInfo: { id?: string; name?: string; phone?: string } | null;
  queueLength?: number;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const base = await resolveBaileysUrl();
  if (!base) {
    throw new Error("WhatsApp Bridge URL is not configured. Update in Admin -> WhatsApp.");
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${base}${cleanPath}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const msg = (body as { error?: string })?.error || `Baileys ${path} failed (${res.status})`;
    throw new Error(msg);
  }
  return body as T;
}

export async function baileysPing(customUrl?: string): Promise<{
  ok: boolean;
  status: number | null;
  latencyMs: number;
  url: string;
  error?: string;
  bodySnippet?: string;
}> {
  let base = (customUrl ? customUrl.trim().replace(/\/+$/, "") : await resolveBaileysUrl());
  if (base && !/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }
  if (!base) {
    return {
      ok: false,
      status: null,
      latencyMs: 0,
      url: "",
      error: "WhatsApp Bridge URL is missing",
    };
  }
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    let res = await fetch(`${base}/health`, { signal: controller.signal }).catch(() => null);
    if (!res || !res.ok) {
      res = await fetch(`${base}/api/sessions`, { signal: controller.signal }).catch(() => null);
    }
    if (!res || !res.ok) {
      res = await fetch(`${base}/`, { signal: controller.signal }).catch(() => null);
    }
    clearTimeout(timeout);

    const latencyMs = Date.now() - start;
    if (!res) {
      return {
        ok: false,
        status: null,
        latencyMs,
        url: base,
        error: "Gateway server did not respond (timeout or unreachable network)",
      };
    }
    const text = await res.text().catch(() => "");
    return {
      ok: res.ok || res.status < 500,
      status: res.status,
      latencyMs,
      url: base,
      bodySnippet: text.slice(0, 150),
    };
  } catch (err: any) {
    return {
      ok: false,
      status: null,
      latencyMs: Date.now() - start,
      url: base,
      error: err.message || "Failed to connect to WhatsApp Gateway",
    };
  }
}

export async function baileysCreateSession(sessionId: string) {
  return call<{ success: boolean; sessionId: string; ready: boolean }>("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export async function baileysPairingCode(sessionId: string, phone: string) {
  const normalized = normalizePhone(phone);
  try {
    return await call<{ success: boolean; code?: string; pairingCode?: string }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/pairing-code`,
      { method: "POST", body: JSON.stringify({ phone: normalized }) },
    );
  } catch {
    return await call<{ success: boolean; code?: string; pairingCode?: string }>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ sessionId, phone: normalized, pairingCode: true }),
    }).catch(() => ({ success: false, code: undefined }));
  }
}

export async function baileysStatus(sessionId: string): Promise<BaileysStatus | null> {
  try {
    return await call<BaileysStatus>(`/api/sessions/${encodeURIComponent(sessionId)}/status`);
  } catch {
    return null;
  }
}

export async function baileysDelete(sessionId: string) {
  return call<{ success: boolean }>(`/api/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

function normalizePhone(input: string): string {
  // Keep digits only; assume already E.164-ish. If no country code, default to India (91).
  const digits = (input || "").replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export async function baileysSend(
  sessionId: string,
  phone: string,
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  const to = normalizePhone(phone);
  if (!to || !message) return { ok: false, error: "phone and message required" };
  const base = await resolveBaileysUrl();
  if (!base) {
    console.warn(`[Baileys] WhatsApp Bridge URL not configured. Delegating delivery to webhook response or queue.`);
    return { ok: false, error: "BAILEYS_URL_NOT_CONFIGURED" };
  }
  try {
    const res = await fetch(`${base}/api/sessions/${encodeURIComponent(sessionId)}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: to, message }),
    });
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
    if (!res.ok || !data.success) return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Async send via BullMQ queue (with instant fallback if queue unavailable)
 */
export async function baileysSendAsync(
  sessionId: string,
  phone: string,
  message: string,
  opts?: { delay?: number; priority?: number },
): Promise<{ ok: boolean; queued?: boolean; error?: string }> {
  try {
    const { enqueueWhatsAppMessage } = await import("./queue/queues");
    const job = await enqueueWhatsAppMessage({ sessionId, phone, message }, opts);
    if (job) {
      return { ok: true, queued: true };
    }
  } catch {
    // Fall back to direct sync send
  }

  const directResult = await baileysSend(sessionId, phone, message);
  return { ...directResult, queued: false };
}

export const PLATFORM_ADMIN_SESSION = "platform-admin";
export function clinicSessionId(clinicId: string) {
  return `user-${clinicId}`;
}
