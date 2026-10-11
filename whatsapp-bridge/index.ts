// ClinicX SaaS Multi-Tenant WhatsApp Gateway Bridge — Baileys Engine
// Isolated per-clinic sessions with on-demand lifecycle & Render Free Tier optimization

import Fastify from "fastify";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pino from "pino";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidGroup,
  isJidBroadcast,
} from "@whiskeysockets/baileys";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET || "clinicx-secret-key";
const WEBHOOK_URL =
  process.env.CLINICX_WEBHOOK_URL ||
  process.env.clinicx_WEBHOOK_URL ||
  process.env.WEBHOOK_URL ||
  "https://clinicx.digiwil.com/api/public/whatsapp/incoming";

// Safe persistent auth directory
let AUTH_BASE_DIR = process.env.AUTH_DIR || path.resolve(process.cwd(), "auth");
try {
  fs.mkdirSync(AUTH_BASE_DIR, { recursive: true });
} catch {
  AUTH_BASE_DIR = path.resolve("/tmp", "clinicx-auth");
  fs.mkdirSync(AUTH_BASE_DIR, { recursive: true });
}

const PORT = parseInt(process.env.PORT || "8080", 10);
const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const startedAt = Date.now();

// ─── Multi-Tenant Isolated Session Model ──────────────────────────────────────
type SessionState = {
  id: string; // e.g. "user-<clinicId>" or "platform-admin"
  clinicId: string; // clean clinic UUID
  sock: any;
  status: "disconnected" | "qr" | "connected";
  phone: string | null;
  qr: string | null;
  pairingCode?: string | null;
  createdAt: number;
  qrTimeout?: NodeJS.Timeout | null;
};

// Isolated in-memory state store indexed strictly by Session ID
const sessions = new Map<string, SessionState>();

function sign(body: string) {
  return "sha256=" + crypto.createHmac("sha256", BRIDGE_SECRET).update(body).digest("hex");
}

async function postWebhook(payload: Record<string, any>): Promise<any> {
  const body = JSON.stringify(payload);
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-bridge-signature": sign(body) },
      body,
    });
    if (!res.ok) {
      logger.warn({ status: res.status, event: payload.event, session: payload.session_id }, "Webhook non-2xx");
      return null;
    }
    const data = await res.json().catch(() => null);
    return data;
  } catch (err: any) {
    logger.error({ err: err.message, session: payload.session_id }, "Webhook dispatch failed");
    return null;
  }
}

function normalizeJid(jid: string | null | undefined): string {
  const num = (jid || "").split("@")[0].split(":")[0];
  return num ? "+" + num : "";
}

function sanitizeSessionId(sessionId: string): string {
  return sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function extractClinicId(sessionId: string): string {
  return sessionId.replace(/^user-/, "");
}

// ─── On-Demand Isolated Session Factory ───────────────────────────────────────

async function getOrCreateSession(sessionId: string, autoConnect = true): Promise<SessionState> {
  const cleanSid = sanitizeSessionId(sessionId);
  const existing = sessions.get(cleanSid);

  // If already connected or active in QR wait, reuse
  if (existing && (existing.status === "connected" || existing.status === "qr")) {
    return existing;
  }

  const clinicId = extractClinicId(cleanSid);
  const sessionDir = path.join(AUTH_BASE_DIR, cleanSid);
  fs.mkdirSync(sessionDir, { recursive: true });

  const stateObj: SessionState = existing || {
    id: cleanSid,
    clinicId,
    sock: null,
    status: "disconnected",
    phone: null,
    qr: null,
    createdAt: Date.now(),
  };

  // Teardown stale socket if present
  if (existing?.sock) {
    try {
      existing.sock.ev?.removeAllListeners();
      existing.sock.ws?.close();
    } catch {}
  }

  sessions.set(cleanSid, stateObj);

  if (!autoConnect) {
    return stateObj;
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  // ⚡ Low-Memory, Isolated SaaS WASocket
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false, // Clean logs for SaaS
    logger: pino({ level: "error" }),
    syncFullHistory: false, // Critical: never load gigabytes of past chats into RAM
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    keepAliveIntervalMs: 25_000,
    defaultQueryTimeoutMs: 60_000,
    shouldIgnoreJid: (jid) =>
      isJidGroup(jid) ||
      isJidBroadcast(jid) ||
      jid.endsWith("@broadcast") ||
      jid.endsWith("@newsletter"),
    getMessage: async () => undefined,
  });

  stateObj.sock = sock;

  // Persist auth credentials securely in the clinic's isolated directory
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update: any) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      stateObj.status = "qr";
      stateObj.qr = qr;
      logger.info({ sessionId: cleanSid }, "📱 QR code generated for isolated clinic session");

      // Set 3-minute QR inactivity cleanup timer to protect memory
      if (stateObj.qrTimeout) clearTimeout(stateObj.qrTimeout);
      stateObj.qrTimeout = setTimeout(() => {
        if (stateObj.status === "qr") {
          logger.info({ sessionId: cleanSid }, "QR scan timed out (3m), disposing unauthenticated socket");
          try {
            stateObj.sock?.ev?.removeAllListeners();
            stateObj.sock?.ws?.close();
          } catch {}
          stateObj.status = "disconnected";
          stateObj.qr = null;
        }
      }, 3 * 60 * 1000);
    }

    if (connection === "open") {
      if (stateObj.qrTimeout) clearTimeout(stateObj.qrTimeout);
      stateObj.status = "connected";
      stateObj.qr = null;
      stateObj.phone = normalizeJid(sock.user?.id);

      logger.info(
        { sessionId: cleanSid, clinicId, phone: stateObj.phone },
        "✓ Clinic WhatsApp Session Connected",
      );

      // Post status event to ClinicX
      void postWebhook({
        event: "status",
        status: "connected",
        session_id: cleanSid,
        clinic_id: clinicId,
        phone: stateObj.phone,
      });
    }

    if (connection === "close") {
      stateObj.status = "disconnected";
      stateObj.qr = null;
      const code = (lastDisconnect?.error as any)?.output?.statusCode;
      const isLoggedOut = code === DisconnectReason.loggedOut;

      logger.warn({ sessionId: cleanSid, code, isLoggedOut }, "Session connection closed");

      void postWebhook({
        event: "status",
        status: "disconnected",
        session_id: cleanSid,
        clinic_id: clinicId,
      });

      if (!isLoggedOut) {
        // Reconnect after brief pause
        setTimeout(() => {
          const s = sessions.get(cleanSid);
          if (s && s.status === "disconnected") {
            void getOrCreateSession(cleanSid, true);
          }
        }, 4000);
      }
    }
  });

  // ─── Isolated Inbound Message Dispatch ─────────────────────────────────────
  sock.ev.on("messages.upsert", async (upsert: any) => {
    const { messages, type } = upsert;
    if (type !== "notify") return;

    for (const m of messages) {
      if (m.key.fromMe || !m.message) continue;

      const remoteJid = m.key.remoteJid;
      if (!remoteJid || remoteJid.endsWith("@g.us") || remoteJid.endsWith("@broadcast")) {
        continue;
      }

      const text =
        m.message.conversation ||
        m.message.extendedTextMessage?.text ||
        m.message.imageMessage?.caption ||
        m.message.videoMessage?.caption ||
        "";

      if (!text) continue;

      try {
        await sock.sendPresenceUpdate("composing", remoteJid);
      } catch {}

      // Dispatch to ClinicX incoming webhook with full tenant isolation parameters
      const webhookRes = await postWebhook({
        event: "message",
        session_id: cleanSid,
        clinic_id: clinicId,
        to_phone: stateObj.phone,
        from: normalizeJid(remoteJid),
        name: m.pushName || null,
        text,
        wa_message_id: m.key.id,
        timestamp: Number(m.messageTimestamp) || Math.floor(Date.now() / 1000),
      });

      // Immediate reply dispatch if returned directly in webhook response
      if (webhookRes && webhookRes.reply && (webhookRes.needs_bridge_send || !webhookRes.sent)) {
        try {
          const preview = String(webhookRes.reply).slice(0, 40).replace(/\n/g, " ");
          logger.info({ session: cleanSid, remoteJid, preview }, "Dispatching AI reply via isolated socket");
          await sock.sendMessage(remoteJid, { text: String(webhookRes.reply) });
        } catch (sendErr: any) {
          logger.error({ session: cleanSid, err: sendErr.message }, "Error sending AI reply");
        }
      }

      try {
        await sock.sendPresenceUpdate("paused", remoteJid);
      } catch {}
    }
  });

  return stateObj;
}

// ─── Boot Restoration: Restore ONLY Authenticated Clinic Sessions ─────────────
// Never start dummy/unrequested sessions on startup!
try {
  const entries = fs.readdirSync(AUTH_BASE_DIR);
  let restoredCount = 0;
  for (const entry of entries) {
    const credsPath = path.join(AUTH_BASE_DIR, entry, "creds.json");
    if (fs.existsSync(credsPath)) {
      logger.info({ sessionId: entry }, "Restoring authenticated clinic session from disk");
      void getOrCreateSession(entry, true);
      restoredCount++;
    }
  }
  logger.info({ restoredCount }, "Session boot restoration complete");
} catch (err: any) {
  logger.warn({ err: err.message }, "No existing session folders found on startup");
}

// ─── FASTIFY HTTP API (Multi-Tenant SaaS Endpoints) ──────────────────────────
const fastify = Fastify({
  logger: false,
  bodyLimit: 2 * 1024 * 1024,
});

// Root Gateway Info
fastify.get("/", async () => {
  const connected = Array.from(sessions.values()).filter((s) => s.status === "connected").length;
  return {
    ok: true,
    service: "ClinicX Multi-Tenant WhatsApp Gateway",
    architecture: "isolated-sessions",
    uptime_s: Math.floor((Date.now() - startedAt) / 1000),
    sessions_total: sessions.size,
    sessions_connected: connected,
    memory_rss_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
  };
});

// Health check endpoint for Render / Uptime monitors
fastify.get("/health", async () => {
  const mem = process.memoryUsage();
  const connected = Array.from(sessions.values()).filter((s) => s.status === "connected").length;
  return {
    ok: true,
    status: "healthy",
    engine: "baileys-multi-tenant",
    sessions_active: sessions.size,
    sessions_connected: connected,
    uptime_s: Math.floor((Date.now() - startedAt) / 1000),
    memory: {
      rss_mb: Math.round(mem.rss / 1024 / 1024),
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
    },
  };
});

// List all active sessions (Super Admin / Diagnostics)
fastify.get("/api/sessions", async () => {
  const list = Array.from(sessions.values()).map((s) => ({
    id: s.id,
    clinicId: s.clinicId,
    status: s.status,
    phone: s.phone,
    hasQr: Boolean(s.qr),
  }));
  return { success: true, count: list.length, sessions: list };
});

// On-demand session initialization (called when doctor clicks "Connect WhatsApp")
fastify.post("/api/sessions", async (req, reply) => {
  const body = (req.body || {}) as any;
  const sid = body.sessionId;
  if (!sid || typeof sid !== "string") {
    reply.status(400);
    return { success: false, error: "sessionId is required (e.g. user-<clinicId>)" };
  }

  const sess = await getOrCreateSession(sid, true);
  return {
    success: true,
    sessionId: sess.id,
    clinicId: sess.clinicId,
    status: sess.status,
    ready: sess.status === "connected",
    hasQr: Boolean(sess.qr),
  };
});

// Request 8-digit phone pairing code for a specific clinic session
fastify.post("/api/sessions/:sessionId/pairing-code", async (req, reply) => {
  const { sessionId } = req.params as { sessionId: string };
  const { phone } = (req.body || {}) as { phone?: string };

  if (!phone) {
    reply.status(400);
    return { success: false, error: "Phone number is required for pairing code" };
  }

  const sess = await getOrCreateSession(sessionId, true);
  if (sess.status === "connected") {
    return { success: true, alreadyConnected: true, phone: sess.phone };
  }

  try {
    const cleanPhone = phone.replace(/\D/g, "");
    const code = await sess.sock.requestPairingCode(cleanPhone);
    sess.pairingCode = code;
    logger.info({ sessionId: sess.id, cleanPhone, code }, "Generated WhatsApp Pairing Code for clinic");
    return { success: true, code, pairingCode: code };
  } catch (err: any) {
    reply.status(500);
    return { success: false, error: err.message || "Failed to generate pairing code" };
  }
});

// Check status & retrieve live QR code for a specific clinic session
fastify.get("/api/sessions/:sessionId/status", async (req) => {
  const { sessionId } = req.params as { sessionId: string };
  const cleanSid = sanitizeSessionId(sessionId);
  const sess = sessions.get(cleanSid);

  if (!sess) {
    return { id: cleanSid, ready: false, hasQr: false, qr: null, clientInfo: null };
  }

  return {
    id: sess.id,
    ready: sess.status === "connected",
    status: sess.status,
    hasQr: Boolean(sess.qr),
    qr: sess.qr,
    clientInfo: sess.phone ? { phone: sess.phone, id: sess.id } : null,
  };
});

// Delete / Disconnect ONLY this clinic's session
fastify.delete("/api/sessions/:sessionId", async (req) => {
  const { sessionId } = req.params as { sessionId: string };
  const cleanSid = sanitizeSessionId(sessionId);
  const sess = sessions.get(cleanSid);

  if (sess?.sock) {
    try {
      sess.sock.ev?.removeAllListeners();
      await sess.sock.logout();
    } catch (err: any) {
      logger.warn({ sessionId: cleanSid, err: err.message }, "Error during session logout");
    }
  }

  sessions.delete(cleanSid);

  const sessionDir = path.join(AUTH_BASE_DIR, cleanSid);
  try {
    fs.rmSync(sessionDir, { recursive: true, force: true });
    logger.info({ sessionId: cleanSid }, "Deleted clinic auth directory from disk");
  } catch {}

  return { success: true, deleted: cleanSid };
});

// Send message via a SPECIFIC clinic session (Strict Tenant Isolation)
fastify.post("/api/sessions/:sessionId/send", async (req, reply) => {
  const { sessionId } = req.params as { sessionId: string };
  const cleanSid = sanitizeSessionId(sessionId);
  const sess = sessions.get(cleanSid);

  if (!sess || sess.status !== "connected") {
    reply.status(503);
    return {
      success: false,
      error: `Clinic WhatsApp session [${cleanSid}] is not connected. Pair via doctor dashboard.`,
    };
  }

  const { phone: toPhone, message } = (req.body || {}) as any;
  if (!toPhone || !message) {
    reply.status(400);
    return { success: false, error: "phone and message required" };
  }

  try {
    const jid = String(toPhone).replace(/^\+/, "").replace(/\D/g, "") + "@s.whatsapp.net";
    const sent = await sess.sock.sendMessage(jid, { text: String(message) });
    return { success: true, id: sent?.key?.id || null };
  } catch (err: any) {
    logger.error({ sessionId: cleanSid, err: err.message }, "Send failed on isolated socket");
    reply.status(500);
    return { success: false, error: String(err.message || err) };
  }
});

// ─── Render Free Plan Keep-Alive ─────────────────────────────────────────────
const RENDER_EXTERNAL_URL =
  process.env.RENDER_EXTERNAL_URL ||
  process.env.SELF_URL ||
  process.env.APP_URL;

if (RENDER_EXTERNAL_URL) {
  const cleanUrl = RENDER_EXTERNAL_URL.replace(/\/+$/, "");
  const PING_INTERVAL_MS = 10 * 60 * 1000;
  logger.info({ pingUrl: `${cleanUrl}/health` }, "✓ Render Keep-Alive self-ping enabled (every 10m)");
  setInterval(async () => {
    try {
      const pingRes = await fetch(`${cleanUrl}/health`, { signal: AbortSignal.timeout(10000) });
      if (pingRes.ok) {
        logger.info("Render Free Keep-Alive ping OK");
      }
    } catch (e: any) {
      logger.warn({ err: e.message }, "Render Keep-Alive ping failed");
    }
  }, PING_INTERVAL_MS);
}

// ─── Start Fastify Server ────────────────────────────────────────────────────
try {
  await fastify.listen({ port: PORT, host: "0.0.0.0" });
  logger.info(`ClinicX Multi-Tenant SaaS WhatsApp Gateway listening on port ${PORT}`);
} catch (err) {
  logger.error(err);
  process.exit(1);
}
