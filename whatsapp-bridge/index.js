// ClinicX WhatsApp Bridge — Baileys → ClinicX HMAC webhook
import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import pino from "pino";
import qrcode from "qrcode-terminal";
import pkg from "@whiskeysockets/baileys";
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = pkg;

const BRIDGE_SECRET = process.env.BRIDGE_SECRET;
const CLINIC_ID = process.env.CLINIC_ID;
const WEBHOOK_URL = process.env.CLINICOS_WEBHOOK_URL;
const AUTH_DIR = process.env.AUTH_DIR || "/data/auth";
const PORT = parseInt(process.env.PORT || "8080", 10);

if (!BRIDGE_SECRET) throw new Error("BRIDGE_SECRET is required");
if (!CLINIC_ID) throw new Error("CLINIC_ID is required");
if (!WEBHOOK_URL) throw new Error("CLINICOS_WEBHOOK_URL is required");

fs.mkdirSync(AUTH_DIR, { recursive: true });
const logger = pino({ level: "info" });
const startedAt = Date.now();
let sock = null;
let status = "disconnected"; // disconnected | qr | connected
let phone = null;

function sign(body) {
  return "sha256=" + crypto.createHmac("sha256", BRIDGE_SECRET).update(body).digest("hex");
}

function verify(req, raw) {
  const sig = req.headers["x-bridge-signature"];
  if (!sig) return false;
  const expected = sign(raw);
  const a = Buffer.from(sig); const b = Buffer.from(expected);
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
    if (!res.ok) logger.warn({ status: res.status }, "webhook non-2xx");
  } catch (err) {
    logger.error({ err: String(err) }, "webhook failed");
  }
}

function normalizeJid(jid) {
  // 91XXXXXXXXXX@s.whatsapp.net -> +91XXXXXXXXXX
  const num = (jid || "").split("@")[0].split(":")[0];
  return num ? "+" + num : "";
}

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ version, auth: state, printQRInTerminal: false, logger: pino({ level: "silent" }) });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) { status = "qr"; qrcode.generate(qr, { small: true }); logger.info("📱 Scan QR above"); }
    if (connection === "open") {
      status = "connected";
      phone = normalizeJid(sock.user?.id);
      logger.info(`✓ Connected as ${phone}`);
      postWebhook({ event: "status", status: "connected", phone });
    }
    if (connection === "close") {
      status = "disconnected";
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      logger.warn({ code }, "connection closed");
      postWebhook({ event: "status", status: "disconnected" });
      if (shouldReconnect) setTimeout(connect, 3000);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const m of messages) {
      if (m.key.fromMe || !m.message) continue;
      const text = m.message.conversation
        || m.message.extendedTextMessage?.text
        || m.message.imageMessage?.caption
        || m.message.videoMessage?.caption
        || "";
      if (!text) continue;

      const remoteJid = m.key.remoteJid;

      // Indicate typing status on WhatsApp while processing AI reply
      try {
        if (sock && remoteJid) await sock.sendPresenceUpdate("composing", remoteJid);
      } catch {}

      await postWebhook({
        event: "message",
        clinic_id: CLINIC_ID,
        from: normalizeJid(remoteJid),
        name: m.pushName || null,
        text,
        wa_message_id: m.key.id,
        timestamp: Number(m.messageTimestamp) || Math.floor(Date.now() / 1000),
      });

      // Reset typing status
      try {
        if (sock && remoteJid) await sock.sendPresenceUpdate("paused", remoteJid);
      } catch {}
    }
  });
}

await connect();

// --- HTTP API ---
const app = express();
app.use(express.raw({ type: "*/*", limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/status", (_req, res) => {
  res.json({ status, phone, uptime_s: Math.floor((Date.now() - startedAt) / 1000) });
});

app.post("/send", async (req, res) => {
  const raw = req.body?.toString("utf8") || "";
  if (!verify(req, raw)) return res.status(401).json({ error: "bad signature" });
  let body; try { body = JSON.parse(raw); } catch { return res.status(400).json({ error: "bad json" }); }
  const { to, text } = body || {};
  if (!to || !text) return res.status(400).json({ error: "to and text required" });
  if (status !== "connected") return res.status(503).json({ error: "not connected" });
  try {
    const jid = to.replace(/^\+/, "").replace(/\D/g, "") + "@s.whatsapp.net";
    const sent = await sock.sendMessage(jid, { text });
    res.json({ id: sent?.key?.id || null });
  } catch (err) {
    logger.error({ err: String(err) }, "send failed");
    res.status(500).json({ error: String(err) });
  }
});

app.post("/logout", async (req, res) => {
  const raw = req.body?.toString("utf8") || "";
  if (!verify(req, raw)) return res.status(401).json({ error: "bad signature" });
  try { await sock?.logout(); } catch {}
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  res.json({ ok: true });
  setTimeout(() => process.exit(0), 500);
});

app.listen(PORT, () => logger.info(`HTTP listening on :${PORT}`));
