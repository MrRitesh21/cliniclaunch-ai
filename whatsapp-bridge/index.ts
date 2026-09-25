// ClinicX Multi-Tenant WhatsApp Gateway Bridge — Baileys → ClinicX Webhook (Fastify Engine)
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
} from "@whiskeysockets/baileys";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET || "clinicx-secret-key";
const CLINIC_ID = process.env.CLINIC_ID || "default";
const WEBHOOK_URL =
  process.env.clinicx_WEBHOOK_URL || "https://clinicx.digiwil.com/api/public/hooks/whatsapp";
const AUTH_BASE_DIR = process.env.AUTH_DIR || "/data/auth";
const PORT = parseInt(process.env.PORT || "8080", 10);

fs.mkdirSync(AUTH_BASE_DIR, { recursive: true });
const logger = pino({ level: "info" });
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

async function postWebhook(payload: Record<string, any>) {
  const body = JSON.stringify(payload);
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-bridge-signature": sign(body) },
      body,
    });
    if (!res.ok) logger.warn({ status: res.status, event: payload.event }, "webhook non-2xx");
  } catch (err) {
    logger.error({ err: String(err) }, "webhook failed");
  }
}

function normalizeJid(jid: string | null | undefined): string {
  const num = (jid || "").split("@")[0].split(":")[0];
  return num ? "+" + num : "";
}

// ─── Session Factory ─────────────────────────────────────────────────────────

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
      existing.sock.ev.removeAllListeners();
      existing.sock.ws?.close();
    } catch (err) {
      logger.error({ sessionId, err: String(err) }, "Error cleaning up old socket");
    }
  }
  
  sessions.set(sessionId, stateObj);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }),
  });

  stateObj.sock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update: any) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      stateObj.status = "qr";
      stateObj.qr = qr;
      logger.info({ sessionId }, "📱 Scan QR for session");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "open") {
      stateObj.status = "connected";
      stateObj.qr = null;
      stateObj.phone = normalizeJid(sock.user?.id);
      logger.info({ sessionId, phone: stateObj.phone }, "✓ WhatsApp Connected");
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
        setTimeout(() => getOrCreateSession(sessionId), 3000);
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

      try {
        if (remoteJid) await sock.sendPresenceUpdate("composing", remoteJid);
      } catch (err) {
        logger.debug({ err: String(err) }, "Failed to send presence composing");
      }

      await postWebhook({
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

      try {
        if (remoteJid) await sock.sendPresenceUpdate("paused", remoteJid);
      } catch (err) {
        logger.debug({ err: String(err) }, "Failed to send presence paused");
      }
    }
  });

  return stateObj;
}

// ─── Auto-restore existing auth folders ──────────────────────────────────────
try {
  const folders = fs.readdirSync(AUTH_BASE_DIR);
  for (const folder of folders) {
    if (folder.startsWith("user-") || folder === "platform-admin" || folder === "default") {
      logger.info({ folder }, "Restoring Baileys Session");
      void getOrCreateSession(folder);
    }
  }
} catch (err) {
  logger.error({ err: String(err) }, "Failed to auto-restore sessions");
}

// Initialize default session if specified
const defaultSessionId = process.env.DEFAULT_SESSION_ID || `user-${CLINIC_ID}`;
void getOrCreateSession(defaultSessionId);

// ─── FASTIFY HTTP SERVER ─────────────────────────────────────────────────────
const fastify = Fastify({
  logger: false,
  bodyLimit: 2 * 1024 * 1024, // 2MB
});

fastify.get("/health", async (_req, _reply) => {
  return {
    ok: true,
    engine: "fastify",
    sessions_active: sessions.size,
    uptime_s: Math.floor((Date.now() - startedAt) / 1000),
  };
});

// Create/start a specific session
fastify.post("/api/sessions", async (req, _reply) => {
  const body = (req.body || {}) as any;
  const sid = body.sessionId || defaultSessionId;
  const sess = await getOrCreateSession(sid);
  return { success: true, sessionId: sid, ready: sess.status === "connected" };
});

// Check status of a specific session
fastify.get("/api/sessions/:sessionId/status", async (req, _reply) => {
  const { sessionId } = req.params as { sessionId: string };
  const sess = sessions.get(sessionId);
  if (!sess) {
    return { id: sessionId, ready: false, hasQr: false, qr: null, clientInfo: null };
  }
  return {
    id: sessionId,
    ready: sess.status === "connected",
    hasQr: Boolean(sess.qr),
    qr: sess.qr,
    clientInfo: sess.phone ? { phone: sess.phone, id: sessionId } : null,
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
  fs.rmSync(sessionDir, { recursive: true, force: true });
  return { success: true };
});

// Send message via a SPECIFIC session
fastify.post("/api/sessions/:sessionId/send", async (req, reply) => {
  const { sessionId } = req.params as { sessionId: string };
  const sess = sessions.get(sessionId);
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

// Legacy single-session /send endpoint
fastify.post("/send", async (req, reply) => {
  let body: any = req.body;
  if (Buffer.isBuffer(body)) {
    try {
      body = JSON.parse(body.toString("utf8"));
    } catch {
      body = {};
    }
  }
  const { to, text, sessionId } = body || {};
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

try {
  await fastify.listen({ port: PORT, host: "0.0.0.0" });
  logger.info(`ClinicX Multi-Session Baileys Gateway (Fastify Engine) listening on :${PORT}`);
} catch (err) {
  logger.error(err);
  process.exit(1);
}
