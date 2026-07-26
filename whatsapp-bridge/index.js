// ClinicX Multi-Tenant WhatsApp Gateway Bridge — Baileys → ClinicX Webhook
import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pino from "pino";
import qrcode from "qrcode-terminal";
import pkg from "@whiskeysockets/baileys";

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = pkg;

const BRIDGE_SECRET = process.env.BRIDGE_SECRET || "clinicx-secret-key";
const CLINIC_ID = process.env.CLINIC_ID || "default";
const WEBHOOK_URL =
  process.env.CLINICOS_WEBHOOK_URL || "https://clinicos.digiwil.com/api/public/hooks/whatsapp";
const AUTH_BASE_DIR = process.env.AUTH_DIR || "/data/auth";
const PORT = parseInt(process.env.PORT || "8080", 10);

fs.mkdirSync(AUTH_BASE_DIR, { recursive: true });
const logger = pino({ level: "info" });
const startedAt = Date.now();

// ─── Multi-Session Store ───────────────────────────────────────────────────────
/** @typedef {{ id: string, sock: any, status: "disconnected"|"qr"|"connected", phone: string|null, qr: string|null }} SessionState */

/** @type {Map<string, SessionState>} */
const sessions = new Map();

function sign(body) {
  return "sha256=" + crypto.createHmac("sha256", BRIDGE_SECRET).update(body).digest("hex");
}

function verify(req, raw) {
  const sig = req.headers["x-bridge-signature"];
  if (!sig) return true; // allow unauthenticated local health calls if signature header omitted
  const expected = sign(raw);
  const a = Buffer.from(String(sig));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function postWebhook(payload) {
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

function normalizeJid(jid) {
  const num = (jid || "").split("@")[0].split(":")[0];
  return num ? "+" + num : "";
}

// ─── Session Factory ─────────────────────────────────────────────────────────

/** @returns {Promise<SessionState>} */
async function getOrCreateSession(sessionId) {
  const existing = sessions.get(sessionId);
  if (existing && (existing.status === "connected" || existing.status === "qr")) {
    return existing;
  }

  const sessionDir = path.join(AUTH_BASE_DIR, sessionId.replace(/[^a-zA-Z0-9_-]/g, "_"));
  fs.mkdirSync(sessionDir, { recursive: true });

  /** @type {SessionState} */
  const stateObj = {
    id: sessionId,
    sock: null,
    status: "disconnected",
    phone: null,
    qr: null,
  };
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

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
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
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      logger.warn({ sessionId, code }, "WhatsApp Connection Closed");
      postWebhook({ event: "status", status: "disconnected", session_id: sessionId });

      if (shouldReconnect) {
        setTimeout(() => getOrCreateSession(sessionId), 3000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
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
      } catch {}

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
      } catch {}
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
} catch {}

// Initialize default session if specified
const defaultSessionId = process.env.DEFAULT_SESSION_ID || `user-${CLINIC_ID}`;
void getOrCreateSession(defaultSessionId);

// ─── HTTP API ────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.raw({ type: "*/*", limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    sessions_active: sessions.size,
    uptime_s: Math.floor((Date.now() - startedAt) / 1000),
  });
});

// Create/start a specific session
app.post("/api/sessions", async (req, res) => {
  const { sessionId } = req.body || {};
  const sid = sessionId || defaultSessionId;
  const sess = await getOrCreateSession(sid);
  res.json({ success: true, sessionId: sid, ready: sess.status === "connected" });
});

// Check status of a specific session
app.get("/api/sessions/:sessionId/status", (req, res) => {
  const sid = req.params.sessionId;
  const sess = sessions.get(sid);
  if (!sess) {
    return res.json({ id: sid, ready: false, hasQr: false, qr: null, clientInfo: null });
  }
  res.json({
    id: sid,
    ready: sess.status === "connected",
    hasQr: Boolean(sess.qr),
    qr: sess.qr,
    clientInfo: sess.phone ? { phone: sess.phone, id: sid } : null,
  });
});

// Delete/logout a specific session
app.delete("/api/sessions/:sessionId", async (req, res) => {
  const sid = req.params.sessionId;
  const sess = sessions.get(sid);
  if (sess?.sock) {
    try {
      await sess.sock.logout();
    } catch {}
  }
  sessions.delete(sid);
  const sessionDir = path.join(AUTH_BASE_DIR, sid.replace(/[^a-zA-Z0-9_-]/g, "_"));
  fs.rmSync(sessionDir, { recursive: true, force: true });
  res.json({ success: true });
});

// Send message via a SPECIFIC session
app.post("/api/sessions/:sessionId/send", async (req, res) => {
  const sid = req.params.sessionId;
  const sess = sessions.get(sid);
  if (!sess || sess.status !== "connected") {
    return res.status(503).json({ success: false, error: `Session ${sid} is not connected` });
  }

  const { phone: toPhone, message } = req.body || {};
  if (!toPhone || !message) {
    return res.status(400).json({ success: false, error: "phone and message required" });
  }

  try {
    const jid = String(toPhone).replace(/^\+/, "").replace(/\D/g, "") + "@s.whatsapp.net";
    const sent = await sess.sock.sendMessage(jid, { text: String(message) });
    res.json({ success: true, id: sent?.key?.id || null });
  } catch (err) {
    logger.error({ sid, err: String(err) }, "send via session failed");
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Legacy single-session /send endpoint
app.post("/send", async (req, res) => {
  let body = req.body;
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
    return res.status(503).json({ error: `Session ${sid} not connected` });
  }
  try {
    const jid = String(to).replace(/^\+/, "").replace(/\D/g, "") + "@s.whatsapp.net";
    const sent = await sess.sock.sendMessage(jid, { text: String(text) });
    res.json({ id: sent?.key?.id || null });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => logger.info(`ClinicX Multi-Session Baileys Gateway listening on :${PORT}`));
