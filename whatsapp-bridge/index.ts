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

// In-memory cache mapping WhatsApp LIDs (e.g. 62152488562936) to real verified phone numbers
const lidToPhoneCache = new Map<string, string>();

function isLidJid(jid: string | null | undefined): boolean {
  if (!jid) return false;
  return jid.endsWith("@lid") || (!jid.includes("@") && jid.length >= 14);
}

function normalizeJid(jid: string | null | undefined): string {
  if (!jid) return "";
  const clean = jid.trim();
  const num = clean.split("@")[0].split(":")[0];
  if (!num) return "";
  return "+" + num.replace(/[^\d]/g, "");
}

function sanitizeSessionId(sessionId: string): string {
  return sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function extractClinicId(sessionId: string): string {
  return sessionId.replace(/^user-/, "");
}

// ─── Cloud Auth State Persistence (Survives Render Container Redeploys) ─────
const backupDebounceTimers = new Map<string, NodeJS.Timeout>();

async function backupSessionToCloud(sessionId: string): Promise<boolean> {
  const cleanSid = sanitizeSessionId(sessionId);
  const sessionDir = path.join(AUTH_BASE_DIR, cleanSid);
  const credsPath = path.join(sessionDir, "creds.json");

  if (!fs.existsSync(credsPath)) {
    return false;
  }

  try {
    const files: Record<string, string> = {};
    const entries = fs.readdirSync(sessionDir);
    for (const file of entries) {
      if (file.endsWith(".json")) {
        try {
          const content = fs.readFileSync(path.join(sessionDir, file), "utf8");
          files[file] = content;
        } catch {}
      }
    }

    if (!files["creds.json"]) return false;

    logger.info({ sessionId: cleanSid, fileCount: Object.keys(files).length }, "Backing up WhatsApp session auth to Supabase cloud");
    const res = await postWebhook({
      event: "auth_backup",
      session_id: cleanSid,
      clinic_id: extractClinicId(cleanSid),
      files,
    });

    return Boolean(res?.ok);
  } catch (err: any) {
    logger.warn({ sessionId: cleanSid, err: err.message }, "Failed to backup session auth to cloud");
    return false;
  }
}

function scheduleCloudBackup(sessionId: string) {
  const cleanSid = sanitizeSessionId(sessionId);
  const existing = backupDebounceTimers.get(cleanSid);
  if (existing) clearTimeout(existing);

  const t = setTimeout(() => {
    backupDebounceTimers.delete(cleanSid);
    void backupSessionToCloud(cleanSid);
  }, 2500);

  backupDebounceTimers.set(cleanSid, t);
}

async function restoreSessionFromCloud(sessionId: string): Promise<boolean> {
  const cleanSid = sanitizeSessionId(sessionId);
  const sessionDir = path.join(AUTH_BASE_DIR, cleanSid);
  const credsPath = path.join(sessionDir, "creds.json");

  if (fs.existsSync(credsPath)) {
    return true; // Already on disk
  }

  try {
    logger.info({ sessionId: cleanSid }, "Querying ClinicX Supabase cloud for session backup");
    const res = await postWebhook({
      event: "auth_restore",
      session_id: cleanSid,
    });

    if (res?.ok && Array.isArray(res.sessions) && res.sessions.length > 0) {
      const match = res.sessions.find((s: any) => s.sessionId === cleanSid) || res.sessions[0];
      if (match?.files && match.files["creds.json"]) {
        fs.mkdirSync(sessionDir, { recursive: true });
        for (const [filename, content] of Object.entries(match.files)) {
          const safeName = path.basename(filename);
          fs.writeFileSync(path.join(sessionDir, safeName), String(content), "utf8");
        }
        logger.info({ sessionId: cleanSid }, "✓ Restored session credentials from Supabase cloud");
        return true;
      }
    }
  } catch (err: any) {
    logger.warn({ sessionId: cleanSid, err: err.message }, "Cloud session restore request failed");
  }
  return false;
}

async function restoreAllSessionsFromCloud(): Promise<number> {
  try {
    logger.info("Syncing persisted WhatsApp sessions from ClinicX Supabase cloud...");
    const res = await postWebhook({ event: "auth_restore" });
    if (res?.ok && Array.isArray(res.sessions) && res.sessions.length > 0) {
      let count = 0;
      for (const item of res.sessions) {
        const { sessionId, files } = item;
        if (!sessionId || !files || !files["creds.json"]) continue;
        const cleanSid = sanitizeSessionId(sessionId);
        const sDir = path.join(AUTH_BASE_DIR, cleanSid);
        fs.mkdirSync(sDir, { recursive: true });
        for (const [filename, content] of Object.entries(files)) {
          const safeName = path.basename(filename);
          fs.writeFileSync(path.join(sDir, safeName), String(content), "utf8");
        }
        count++;
        logger.info({ sessionId: cleanSid }, "✓ Restored session files from cloud backup");
      }
      return count;
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, "Could not fetch cloud session backups on startup");
  }
  return 0;
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

  // If credentials are not present locally on disk, attempt cloud restore from Supabase
  if (!fs.existsSync(path.join(sessionDir, "creds.json"))) {
    await restoreSessionFromCloud(cleanSid);
  }

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

  // Persist auth credentials securely in the clinic's isolated directory + cloud backup
  sock.ev.on("creds.update", () => {
    saveCreds();
    scheduleCloudBackup(cleanSid);
  });

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

      // Trigger cloud backup of authenticated session
      scheduleCloudBackup(cleanSid);

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

      if (isLoggedOut) {
        void postWebhook({ event: "auth_clear", session_id: cleanSid });
      }

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

  // Track phoneNumberShare events emitted by Baileys
  sock.ev.on("chats.phoneNumberShare" as any, (data: any) => {
    if (data?.lid && data?.jid) {
      const lidNum = data.lid.split("@")[0];
      const phoneNum = normalizeJid(data.jid);
      if (phoneNum) {
        lidToPhoneCache.set(lidNum, phoneNum);
        lidToPhoneCache.set(data.lid, phoneNum);
        logger.info({ lid: data.lid, phone: phoneNum }, "Mapped WhatsApp LID to real phone number");
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

      const rawMsg = m.message;
      const unwrapped =
        rawMsg?.ephemeralMessage?.message ||
        rawMsg?.viewOnceMessage?.message ||
        rawMsg?.viewOnceMessageV2?.message ||
        rawMsg?.documentWithCaptionMessage?.message ||
        rawMsg;

      const text = (
        unwrapped?.conversation ||
        unwrapped?.extendedTextMessage?.text ||
        unwrapped?.imageMessage?.caption ||
        unwrapped?.videoMessage?.caption ||
        unwrapped?.buttonsResponseMessage?.selectedDisplayText ||
        unwrapped?.templateButtonReplyMessage?.selectedDisplayText ||
        unwrapped?.listResponseMessage?.title ||
        ""
      ).trim();

      if (!text) continue;

      try {
        await sock.sendPresenceUpdate("composing", remoteJid);
      } catch {}

      // Resolve real phone number if sender is using an internal WhatsApp LID (@lid)
      const senderPn =
        (m.key as any)?.senderPn ||
        (m.key as any)?.participantPn ||
        ((m.key?.participant && !m.key.participant.endsWith("@lid")) ? m.key.participant : null) ||
        ((m.participant && !m.participant.endsWith("@lid")) ? m.participant : null);

      let realPhone = "";
      const isLid = isLidJid(remoteJid);
      const cleanLid = remoteJid.split("@")[0];

      if (senderPn && !senderPn.endsWith("@lid")) {
        realPhone = normalizeJid(senderPn);
        if (isLid) {
          lidToPhoneCache.set(cleanLid, realPhone);
          lidToPhoneCache.set(remoteJid, realPhone);
        }
      } else if (isLid && lidToPhoneCache.has(cleanLid)) {
        realPhone = lidToPhoneCache.get(cleanLid)!;
      } else if (!isLid) {
        realPhone = normalizeJid(remoteJid);
      }

      // Dispatch to ClinicX incoming webhook with full tenant isolation parameters
      const webhookRes = await postWebhook({
        event: "message",
        session_id: cleanSid,
        clinic_id: clinicId,
        to_phone: stateObj.phone,
        from: realPhone || normalizeJid(remoteJid),
        phone: realPhone || undefined,
        remote_jid: remoteJid,
        remoteJid,
        is_lid: isLid,
        sender_lid: isLid ? remoteJid : (m.key as any)?.senderLid || undefined,
        sender_pn: senderPn ? normalizeJid(senderPn) : (realPhone || undefined),
        name: m.pushName || null,
        text,
        wa_message_id: m.key.id,
        timestamp: Number(m.messageTimestamp) || Math.floor(Date.now() / 1000),
      });

      // Immediate reply dispatch if returned directly in webhook response
      if (webhookRes && webhookRes.reply) {
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

// ─── Boot Restoration: Restore From Cloud & Local Disk ──────────────────────
// Never start dummy/unrequested sessions on startup!
try {
  // 1. Restore all authenticated clinic sessions saved in Supabase cloud (survives Render redeploys)
  await restoreAllSessionsFromCloud();

  const entries = fs.readdirSync(AUTH_BASE_DIR);
  let restoredCount = 0;
  for (const entry of entries) {
    const credsPath = path.join(AUTH_BASE_DIR, entry, "creds.json");
    if (fs.existsSync(credsPath)) {
      logger.info({ sessionId: entry }, "Restoring authenticated clinic session from credentials");
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

  void postWebhook({ event: "auth_clear", session_id: cleanSid });

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
