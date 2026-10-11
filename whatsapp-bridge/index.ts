// ClinicX Ultra-Optimized WhatsApp Gateway Bridge — Baileys (Render Free Plan Optimized)
import Fastify from "fastify";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pino from "pino";
import qrcode from "qrcode-terminal";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidGroup,
  isJidBroadcast,
} from "@whiskeysockets/baileys";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET || "clinicx-secret-key";
const CLINIC_ID = process.env.CLINIC_ID || "default";
const WEBHOOK_URL =
  process.env.CLINICX_WEBHOOK_URL ||
  process.env.clinicx_WEBHOOK_URL ||
  process.env.WEBHOOK_URL ||
  "https://clinicx.digiwil.com/api/public/whatsapp/incoming";

// Safe auth directory: prefer process.env.AUTH_DIR, fallback to local ./auth or /tmp/auth
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

// ─── Multi-Session Store ───────────────────────────────────────────────────────
type SessionState = {
  id: string;
  sock: any;
  status: "disconnected" | "qr" | "connected";
  phone: string | null;
  qr: string | null;
};

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
      logger.warn({ status: res.status, event: payload.event }, "webhook returned non-2xx");
      return null;
    }
    const data = await res.json().catch(() => null);
    return data;
  } catch (err) {
    logger.error({ err: String(err) }, "webhook dispatch failed");
    return null;
  }
}

function normalizeJid(jid: string | null | undefined): string {
  const num = (jid || "").split("@")[0].split(":")[0];
  return num ? "+" + num : "";
}

// ─── Session Factory (Low-Memory Config for Render 512MB RAM) ───────────────────

async function getOrCreateSession(sessionId: string): Promise<SessionState> {
  const existing = sessions.get(sessionId);
  if (existing && (existing.status === "connected" || existing.status === "qr")) {
    return existing;
  }

  const sessionDir = path.join(AUTH_BASE_DIR, sessionId.replace(/[^a-zA-Z0-9_-]/g, "_"));
  fs.mkdirSync(sessionDir, { recursive: true });

  const stateObj: SessionState = existing || {
    id: sessionId,
    sock: null,
    status: "disconnected",
    phone: null,
    qr: null,
  };

  if (existing && existing.sock) {
    try {
      existing.sock.ev?.removeAllListeners();
      existing.sock.ws?.close();
    } catch (err) {
      logger.debug({ sessionId, err: String(err) }, "Cleaned up old socket");
    }
  }

  sessions.set(sessionId, stateObj);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  // ⚡ CRITICAL RENDER 512MB RAM OPTIMIZATIONS:
  // 1. syncFullHistory: false (NEVER pull years of historical chats into memory)
  // 2. markOnlineOnConnect: false (reduces constant socket heartbeat overhead)
  // 3. shouldIgnoreJid: ignore group & broadcast chats
  // 4. getMessage: no heavy in-memory message buffering
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "error" }), // Suppress high-frequency socket debug logs
    syncFullHistory: false,
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

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update: any) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      stateObj.status = "qr";
      stateObj.qr = qr;
      logger.info({ sessionId }, "📱 New QR generated for session");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "open") {
      stateObj.status = "connected";
      stateObj.qr = null;
      stateObj.phone = normalizeJid(sock.user?.id);
      logger.info({ sessionId, phone: stateObj.phone }, "✓ WhatsApp Connected Successfully");
      postWebhook({
        event: "status",
        status: "connected",
        session_id: sessionId,
        phone: stateObj.phone,
      });
    }
    if (connection === "close") {
      stateObj.status = "disconnected";
      stateObj.qr = null;
      const code = (lastDisconnect?.error as any)?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      logger.warn({ sessionId, code }, "WhatsApp Connection Closed");
      postWebhook({ event: "status", status: "disconnected", session_id: sessionId });

      if (shouldReconnect) {
        // Auto-reconnect with 3.5s delay
        setTimeout(() => getOrCreateSession(sessionId), 3500);
      }
    }
  });

  sock.ev.on("messages.upsert", async (upsert: any) => {
    const { messages, type } = upsert;
    if (type !== "notify") return;
    for (const m of messages) {
      if (m.key.fromMe || !m.message) continue;
      const text =
        m.message.conversation ||
        m.message.extendedTextMessage?.text ||
        m.message.imageMessage?.caption ||
        m.message.videoMessage?.caption ||
        "";
      if (!text) continue;

      const remoteJid = m.key.remoteJid;
      if (remoteJid && (remoteJid.endsWith("@g.us") || remoteJid.endsWith("@broadcast"))) {
        continue; // Skip group and broadcast messages
      }

      try {
        if (remoteJid) await sock.sendPresenceUpdate("composing", remoteJid);
      } catch {}

      const webhookRes = await postWebhook({
        event: "message",
        session_id: sessionId,
        clinic_id: CLINIC_ID,
        to_phone: stateObj.phone,
        from: normalizeJid(remoteJid),
        name: m.pushName || null,
        text,
        wa_message_id: m.key.id,
        timestamp: Number(m.messageTimestamp) || Math.floor(Date.now() / 1000),
      });

      // If webhook returned immediate AI reply, send it directly over Baileys socket
      if (webhookRes && webhookRes.reply && (webhookRes.needs_bridge_send || !webhookRes.sent)) {
        try {
          const preview = String(webhookRes.reply).slice(0, 40).replace(/\n/g, " ");
          logger.info({ remoteJid, preview }, "Dispatching AI Receptionist reply via Baileys socket");
          await sock.sendMessage(remoteJid, { text: String(webhookRes.reply) });
        } catch (sendErr: any) {
          logger.error({ err: sendErr.message, remoteJid }, "Error sending AI reply via Baileys");
        }
      }

      try {
        if (remoteJid) await sock.sendPresenceUpdate("paused", remoteJid);
      } catch {}
    }
  });

  return stateObj;
}

// ─── Auto-restore existing auth folders on start ─────────────────────────────
try {
  const folders = fs.readdirSync(AUTH_BASE_DIR);
  for (const folder of folders) {
    if (folder.startsWith("user-") || folder === "platform-admin" || folder === "default") {
      logger.info({ folder }, "Restoring Baileys Session from disk");
      void getOrCreateSession(folder);
    }
  }
} catch (err) {
  logger.warn({ err: String(err) }, "No existing sessions found to restore");
}

const defaultSessionId = process.env.DEFAULT_SESSION_ID || `user-${CLINIC_ID}`;
void getOrCreateSession(defaultSessionId);

// ─── FASTIFY HTTP SERVER ─────────────────────────────────────────────────────
const fastify = Fastify({
  logger: false,
  bodyLimit: 2 * 1024 * 1024, // 2MB
});

// Root friendly probe
fastify.get("/", async (_req, _reply) => {
  return {
    ok: true,
    service: "ClinicX WhatsApp Baileys Bridge",
    uptime_s: Math.floor((Date.now() - startedAt) / 1000),
    active_sessions: sessions.size,
    memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
  };
});

// Health check endpoint for Render and Uptime monitors
fastify.get("/health", async (_req, _reply) => {
  const mem = process.memoryUsage();
  return {
    ok: true,
    status: "healthy",
    engine: "baileys-fastify",
    sessions_active: sessions.size,
    uptime_s: Math.floor((Date.now() - startedAt) / 1000),
    memory: {
      rss_mb: Math.round(mem.rss / 1024 / 1024),
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
    },
  };
});

// Start/Create a session
fastify.post("/api/sessions", async (req, _reply) => {
  const body = (req.body || {}) as any;
  const sid = body.sessionId || defaultSessionId;
  const sess = await getOrCreateSession(sid);
  return { success: true, sessionId: sid, ready: sess.status === "connected" };
});

// Request 8-digit phone pairing code (Alternative to QR scan)
fastify.post("/api/sessions/:sessionId/pairing-code", async (req, reply) => {
  const { sessionId } = req.params as { sessionId: string };
  const { phone } = (req.body || {}) as { phone?: string };
  if (!phone) {
    reply.status(400);
    return { success: false, error: "Phone number is required for pairing code" };
  }
  const sess = await getOrCreateSession(sessionId);
  if (sess.status === "connected") {
    return { success: true, alreadyConnected: true, phone: sess.phone };
  }
  try {
    const cleanPhone = phone.replace(/\D/g, "");
    const code = await sess.sock.requestPairingCode(cleanPhone);
    logger.info({ sessionId, cleanPhone, code }, "Generated WhatsApp Pairing Code");
    return { success: true, code, pairingCode: code };
  } catch (err: any) {
    reply.status(500);
    return { success: false, error: err.message || "Failed to generate pairing code" };
  }
});

// Check status of a specific session
fastify.get("/api/sessions/:sessionId/status", async (req, _reply) => {
  const { sessionId } = req.params as { sessionId: string };
  let sess = sessions.get(sessionId);
  if (!sess || (sess.status !== "connected" && !sess.qr)) {
    const connectedSessions = Array.from(sessions.values()).filter((s) => s.status === "connected");
    if (connectedSessions.length === 1) {
      sess = connectedSessions[0];
    }
  }
  if (!sess) {
    return { id: sessionId, ready: false, hasQr: false, qr: null, clientInfo: null };
  }
  return {
    id: sess.id,
    ready: sess.status === "connected",
    hasQr: Boolean(sess.qr),
    qr: sess.qr,
    clientInfo: sess.phone ? { phone: sess.phone, id: sess.id } : null,
  };
});

// Delete/logout a specific session
fastify.delete("/api/sessions/:sessionId", async (req, _reply) => {
  const { sessionId } = req.params as { sessionId: string };
  const sess = sessions.get(sessionId);
  if (sess?.sock) {
    try {
      await sess.sock.logout();
    } catch (err) {
      logger.error({ sessionId, err: String(err) }, "Error logging out session");
    }
  }
  sessions.delete(sessionId);
  const sessionDir = path.join(AUTH_BASE_DIR, sessionId.replace(/[^a-zA-Z0-9_-]/g, "_"));
  try {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  } catch {}
  return { success: true };
});

// Send message via a specific session
fastify.post("/api/sessions/:sessionId/send", async (req, reply) => {
  const { sessionId } = req.params as { sessionId: string };
  let sess = sessions.get(sessionId);
  if (!sess || sess.status !== "connected") {
    const connectedSessions = Array.from(sessions.values()).filter((s) => s.status === "connected");
    if (connectedSessions.length === 1) {
      sess = connectedSessions[0];
    }
  }
  if (!sess || sess.status !== "connected") {
    reply.status(503);
    return { success: false, error: `Session ${sessionId} is not connected` };
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
    logger.error({ sid: sessionId, err: String(err) }, "send via session failed");
    reply.status(500);
    return { success: false, error: String(err) };
  }
});

// Legacy /send endpoint
fastify.post("/send", async (req, reply) => {
  const body = (req.body || {}) as any;
  const { to, text, sessionId } = body;
  const sid = sessionId || defaultSessionId;
  const sess = sessions.get(sid);
  if (!sess || sess.status !== "connected") {
    reply.status(503);
    return { error: `Session ${sid} not connected` };
  }
  try {
    const jid = String(to).replace(/^\+/, "").replace(/\D/g, "") + "@s.whatsapp.net";
    const sent = await sess.sock.sendMessage(jid, { text: String(text) });
    return { id: sent?.key?.id || null };
  } catch (err: any) {
    reply.status(500);
    return { error: String(err) };
  }
});

// ─── RENDER 15-MINUTE SPIN-DOWN AUTO KEEP-ALIVE ──────────────────────────────
// Render Free tier sleeps after 15 minutes of inactivity.
// We auto-detect RENDER_EXTERNAL_URL (populated by Render) and self-ping every 10 min.
const RENDER_EXTERNAL_URL =
  process.env.RENDER_EXTERNAL_URL ||
  process.env.SELF_URL ||
  process.env.APP_URL;

if (RENDER_EXTERNAL_URL) {
  const cleanUrl = RENDER_EXTERNAL_URL.replace(/\/+$/, "");
  const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
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

// ─── START SERVER ────────────────────────────────────────────────────────────
try {
  await fastify.listen({ port: PORT, host: "0.0.0.0" });
  logger.info(`ClinicX Ultra-Optimized Baileys Bridge listening on port ${PORT}`);
} catch (err) {
  logger.error(err);
  process.exit(1);
}
