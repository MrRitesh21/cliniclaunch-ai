// Server-only Baileys WhatsApp gateway client.
// Talks to the agency-provided Baileys HTTP service.
// Never import this from client/route code — call via createServerFn handlers.

const BAILEYS_URL =
  (typeof process !== "undefined" && process.env.BAILEYS_URL) || "";

export type BaileysStatus = {
  id: string;
  ready: boolean;
  hasQr: boolean;
  qr: string | null;
  clientInfo: { id?: string; name?: string; phone?: string } | null;
  queueLength?: number;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BAILEYS_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let body: unknown;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) {
    const msg = (body as { error?: string })?.error || `Baileys ${path} failed (${res.status})`;
    throw new Error(msg);
  }
  return body as T;
}

export async function baileysCreateSession(sessionId: string) {
  return call<{ success: boolean; sessionId: string; ready: boolean }>(
    "/api/sessions",
    { method: "POST", body: JSON.stringify({ sessionId }) },
  );
}

export async function baileysPairingCode(sessionId: string, phone: string) {
  const normalized = normalizePhone(phone);
  try {
    return await call<{ success: boolean; code?: string; pairingCode?: string }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/pairing-code`,
      { method: "POST", body: JSON.stringify({ phone: normalized }) }
    );
  } catch {
    return await call<{ success: boolean; code?: string; pairingCode?: string }>(
      "/api/sessions",
      { method: "POST", body: JSON.stringify({ sessionId, phone: normalized, pairingCode: true }) }
    ).catch(() => ({ success: false, code: undefined }));
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
  try {
    const res = await fetch(
      `${BAILEYS_URL}/api/sessions/${encodeURIComponent(sessionId)}/send`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: to, message }),
      },
    );
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
