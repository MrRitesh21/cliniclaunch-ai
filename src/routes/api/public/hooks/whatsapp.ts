import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { baileysSend, clinicSessionId } from "@/lib/baileys.server";
import { createHmac, timingSafeEqual } from "crypto";
import { serverEnv } from "@/lib/env.server";

/** Verify the bridge HMAC over the raw body. Permissive if secret is unset so self-hosted bridges work. */
function verifyBridgeSignature(rawBody: string, signature: string | null): boolean {
  const secret = serverEnv.WHATSAPP_BRIDGE_SECRET || "";
  if (!secret) {
    // Permissive in dev/self-hosted environments when secret is not configured
    return true;
  }
  if (!signature) return false;
  const provided = signature.replace(/^sha256=/, "").trim();
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

import { processWhatsAppMessage } from "@/lib/whatsapp-booking.server";

// Supabase query builders are thenable but have no `.catch`, so calling it throws
// synchronously and aborted the whole webhook before any reply was sent.
async function logBestEffort(query: PromiseLike<unknown>) {
  try {
    await query;
  } catch (e) {
    console.error("[WhatsApp Webhook] log write failed:", e);
  }
}

export const Route = createFileRoute("/api/public/hooks/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const rawBody = await request.text();
          const signature =
            request.headers.get("x-bridge-signature") ?? request.headers.get("x-hub-signature-256");
          if (!verifyBridgeSignature(rawBody, signature)) {
            return new Response("Invalid signature", { status: 401 });
          }
          let body: any = {};
          try {
            body = JSON.parse(rawBody);
          } catch {
            body = {};
          }

          // Filter out self-sent messages to avoid infinite loops
          const fromMe =
            body?.fromMe ||
            body?.data?.key?.fromMe ||
            body?.messages?.[0]?.key?.fromMe ||
            false;
          if (fromMe) {
            return Response.json({ ok: true, ignored: true, reason: "from_me" });
          }

          // Extract sender identifier
          const rawFrom =
            body?.from ||
            body?.sender ||
            body?.remoteJid ||
            body?.data?.key?.remoteJid ||
            body?.messages?.[0]?.key?.remoteJid ||
            "";

          // Ignore WhatsApp group messages (only handle 1-on-1 patient queries)
          if (typeof rawFrom === "string" && rawFrom.endsWith("@g.us")) {
            return Response.json({ ok: true, ignored: true, reason: "group_message" });
          }

          // Extract text content across standard and nested Baileys payload structures
          const rawText =
            body?.text ||
            body?.message ||
            body?.body ||
            body?.content ||
            body?.data?.message?.conversation ||
            body?.data?.message?.extendedTextMessage?.text ||
            body?.messages?.[0]?.message?.conversation ||
            body?.messages?.[0]?.message?.extendedTextMessage?.text ||
            "";

          const text = typeof rawText === "string" ? rawText.trim() : "";
          const name =
            body?.name ||
            body?.pushName ||
            body?.sender_name ||
            body?.data?.pushName ||
            body?.messages?.[0]?.pushName ||
            null;
          const clinic_id = body?.clinic_id || body?.clinicId || null;
          const session_id = body?.session_id || body?.sessionId || body?.session || null;
          const to_phone = body?.to_phone || body?.to || body?.recipient || null;

          if (!rawFrom || !text) {
            return Response.json({ ok: true, ignored: true, reason: "missing_from_or_text" });
          }

          const sb = supabaseAdmin;

          // ─── STRICT CLINIC & SESSION RESOLUTION ───
          let clinic: any = null;

          // 1. Resolve by session_id if present
          if (session_id) {
            const rawClinicId = String(session_id).replace(/^user-/, "");
            const { data } = await sb
              .from("clinics")
              .select("*")
              .or(`id.eq.${rawClinicId},wa_session_id.eq.${session_id}`)
              .maybeSingle();
            if (data) clinic = data;
          }

          // 2. Resolve by explicit clinic_id if not found yet
          if (!clinic && clinic_id) {
            const { data } = await sb.from("clinics").select("*").eq("id", clinic_id).maybeSingle();
            if (data) clinic = data;
          }

          // 3. Resolve by receiving WhatsApp number (to_phone) if not found yet
          if (!clinic && to_phone) {
            const cleanTo = String(to_phone).replace(/[^\d]/g, "");
            if (cleanTo.length >= 7) {
              const { data } = await sb
                .from("clinics")
                .select("*")
                .or(
                  `wa_phone.ilike.%${cleanTo}%,phone.ilike.%${cleanTo}%,personal_phone.ilike.%${cleanTo}%`,
                )
                .limit(1)
                .maybeSingle();
              if (data) clinic = data;
            }
          }

          // 4. Fallback for single connected clinic instances when session is omitted
          if (!clinic) {
            const { data: readyClinics } = await sb
              .from("clinics")
              .select("*")
              .eq("wa_status", "ready")
              .limit(2);
            if (readyClinics && readyClinics.length === 1) {
              clinic = readyClinics[0];
            }
          }

          // 5. Strict Failure: If no clinic matches the receiving number or session, DO NOT guess
          if (!clinic) {
            console.warn(
              `[WhatsApp Webhook] Unmapped message received from ${rawFrom} to session ${session_id || "unknown"}`,
            );
            return Response.json({ ok: false, error: "unmapped_session_clinic" }, { status: 404 });
          }

          // ─── PROCESS MESSAGE FOR THE VERIFIED TARGET CLINIC ───
          const cleanPhone = String(rawFrom).replace(/@.*$/, "").replace(/[^\d]/g, "");
          const formattedPhone = cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${cleanPhone}`;

          // Log incoming patient message

          // Log incoming patient message
          await logBestEffort(
            sb.from("whatsapp_logs").insert({
              organization_id: clinic.organization_id,
              patient_name: name || null,
              patient_phone: formattedPhone,
              template_key: "incoming_patient_msg",
              automation_key: "incoming_patient_msg",
              message: text,
              status: "received",
              sent_at: new Date().toISOString(),
            }),
          );

          // ─── PROCESS AUTOMATED BOOKING & CONVERSATION ───
          const bookingResult = await processWhatsAppMessage({
            clinic,
            patientPhone: formattedPhone,
            senderName: name || null,
            incomingText: text,
          });

          // Send reply strictly back using the target clinic's specific Baileys session ID
          const sessionId = clinic.wa_session_id || clinicSessionId(clinic.id);
          const sendResult = await baileysSend(sessionId, formattedPhone, bookingResult.reply);

          // Log outgoing reply
          await logBestEffort(
            sb.from("whatsapp_logs").insert({
              organization_id: clinic.organization_id,
              appointment_id: bookingResult.appointmentId || null,
              patient_name: name || null,
              patient_phone: formattedPhone,
              template_key: bookingResult.action === "booked" ? "whatsapp_booking_confirmed" : "ai_auto_reply",
              automation_key: bookingResult.action === "booked" ? "whatsapp_booking_confirmed" : "ai_auto_reply",
              message: bookingResult.reply,
              status: sendResult.ok ? "sent" : "failed",
              error: sendResult.error || null,
              sent_at: sendResult.ok ? new Date().toISOString() : null,
            }),
          );

          return Response.json({
            ok: true,
            action: bookingResult.action,
            appointment_id: bookingResult.appointmentId,
            token_number: bookingResult.tokenNumber,
            clinic_id: clinic.id,
            session_id: sessionId,
            reply: bookingResult.reply,
            sent: sendResult.ok,
            error: sendResult.error,
          });
        } catch (e: any) {
          console.error("[WhatsApp AI Webhook Error]:", e);
          return Response.json({ ok: false, error: e.message }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, service: "ClinicX WhatsApp AI Webhook" }),
    },
  },
});
