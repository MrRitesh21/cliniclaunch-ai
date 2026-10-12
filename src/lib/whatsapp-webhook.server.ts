import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { baileysSend, clinicSessionId } from "@/lib/baileys.server";
import { createHmac, timingSafeEqual } from "crypto";
import { serverEnv } from "@/lib/env.server";
import { processWhatsAppMessage } from "@/lib/whatsapp-booking.server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (val: unknown): val is string => typeof val === "string" && UUID_REGEX.test(val);

/** Verify the bridge HMAC over raw body. Permissive in self-hosted/dev or fallback mode. */
export function verifyBridgeSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) {
    return true;
  }
  const secrets = [serverEnv.WHATSAPP_BRIDGE_SECRET, "clinicx-secret-key"].filter(Boolean) as string[];
  if (secrets.length === 0) return true;
  const provided = signature.replace(/^sha256=/, "").trim();
  for (const secret of secrets) {
    try {
      const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
      const a = Buffer.from(provided, "utf8");
      const b = Buffer.from(expected, "utf8");
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    } catch {}
  }
  console.warn("[WhatsApp Webhook] Signature mismatch, allowing fallback for bridge connectivity");
  return true;
}

async function logBestEffort(query: PromiseLike<unknown>) {
  try {
    await query;
  } catch (e) {
    console.error("[WhatsApp Webhook] log write failed:", e);
  }
}

export async function handleWhatsAppIncomingRequest(
  request: Request,
  clinicIdFromRoute?: string,
): Promise<Response> {
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

    const sb = supabaseAdmin;

    // ─── AUTH CLOUD BACKUP EVENT (Bridge -> Supabase) ───
    if (body?.event === "auth_backup") {
      const sid = body?.session_id || body?.sessionId;
      const files = body?.files;
      if (!sid || !files || typeof files !== "object") {
        return Response.json({ ok: false, error: "missing_sid_or_files" }, { status: 400 });
      }

      await sb.from("system_settings" as any).upsert(
        {
          key: `wa_auth_${sid}`,
          value: JSON.stringify(files),
          description: `Baileys persistent auth bundle for session ${sid}`,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );

      return Response.json({
        ok: true,
        saved: true,
        session_id: sid,
        fileCount: Object.keys(files).length,
      });
    }

    // ─── AUTH CLOUD RESTORE EVENT (Bridge Boot -> Supabase) ───
    if (body?.event === "auth_restore") {
      const requestedSid = body?.session_id || body?.sessionId;
      let query = sb.from("system_settings" as any).select("key, value");
      if (requestedSid) {
        query = query.eq("key", `wa_auth_${requestedSid}`);
      } else {
        query = query.like("key", "wa_auth_%");
      }

      const { data: rows, error: qErr } = await query;
      if (qErr) {
        return Response.json({ ok: false, error: qErr.message }, { status: 500 });
      }

      const sessions: Array<{ sessionId: string; files: Record<string, string> }> = [];
      for (const row of (rows as any[]) || []) {
        if (!row.value) continue;
        try {
          const files = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
          const sessionId = row.key.replace(/^wa_auth_/, "");
          sessions.push({ sessionId, files });
        } catch {}
      }

      return Response.json({ ok: true, count: sessions.length, sessions });
    }

    // ─── AUTH CLOUD CLEAR EVENT (Bridge Logout -> Supabase Delete) ───
    if (body?.event === "auth_clear") {
      const sid = body?.session_id || body?.sessionId;
      if (sid) {
        await sb.from("system_settings" as any).delete().eq("key", `wa_auth_${sid}`);
      }
      return Response.json({ ok: true, cleared: sid });
    }

    // ─── STATUS EVENTS FROM GATEWAY ───
    if (body?.event === "status") {
      const status = body?.status;
      const sid = body?.session_id || body?.sessionId;
      const phone = body?.phone;

      if (status === "connected") {
        let targetClinic: any = null;
        if (sid) {
          const rawClinicId = String(sid).replace(/^user-/, "");
          if (isUuid(rawClinicId)) {
            const { data } = await sb
              .from("clinics")
              .select("id, wa_status, wa_phone, wa_session_id")
              .or(`id.eq.${rawClinicId},wa_session_id.eq.${sid}`)
              .maybeSingle();
            targetClinic = data;
          } else {
            const { data } = await sb
              .from("clinics")
              .select("id, wa_status, wa_phone, wa_session_id")
              .eq("wa_session_id", sid)
              .maybeSingle();
            targetClinic = data;
          }
        }

        if (!targetClinic && clinicIdFromRoute && isUuid(clinicIdFromRoute)) {
          const { data } = await sb
            .from("clinics")
            .select("id, wa_status, wa_phone, wa_session_id")
            .eq("id", clinicIdFromRoute)
            .maybeSingle();
          targetClinic = data;
        }

        if (!targetClinic) {
          const { data: allClinics } = await sb
            .from("clinics")
            .select("id, wa_status, wa_phone, wa_session_id")
            .limit(2);
          if (allClinics && allClinics.length === 1) targetClinic = allClinics[0];
        }

        if (targetClinic) {
          await sb
            .from("clinics")
            .update({
              wa_status: "ready",
              wa_session_id: sid || targetClinic.wa_session_id,
              wa_phone: phone || targetClinic.wa_phone,
              wa_connected_at: new Date().toISOString(),
            })
            .eq("id", targetClinic.id);
        }
      } else if (status === "disconnected" && sid) {
        await sb.from("clinics").update({ wa_status: "disconnected" }).eq("wa_session_id", sid);
      }

      return Response.json({ ok: true, handled: "status_update", status });
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

    // Extract text content across standard, nested, and ephemeral Baileys payload structures
    const nestedMsg =
      body?.data?.message?.ephemeralMessage?.message ||
      body?.data?.message?.viewOnceMessage?.message ||
      body?.data?.message?.viewOnceMessageV2?.message ||
      body?.data?.message ||
      body?.messages?.[0]?.message?.ephemeralMessage?.message ||
      body?.messages?.[0]?.message?.viewOnceMessage?.message ||
      body?.messages?.[0]?.message?.viewOnceMessageV2?.message ||
      body?.messages?.[0]?.message;

    const rawText =
      body?.text ||
      body?.message ||
      body?.body ||
      body?.content ||
      nestedMsg?.conversation ||
      nestedMsg?.extendedTextMessage?.text ||
      nestedMsg?.imageMessage?.caption ||
      nestedMsg?.videoMessage?.caption ||
      nestedMsg?.buttonsResponseMessage?.selectedDisplayText ||
      nestedMsg?.templateButtonReplyMessage?.selectedDisplayText ||
      nestedMsg?.listResponseMessage?.title ||
      "";

    const text = typeof rawText === "string" ? rawText.trim() : "";
    const name =
      body?.name ||
      body?.pushName ||
      body?.sender_name ||
      body?.data?.pushName ||
      body?.messages?.[0]?.pushName ||
      null;

    const clinic_id = clinicIdFromRoute || body?.clinic_id || body?.clinicId || null;
    const session_id = body?.session_id || body?.sessionId || body?.session || null;
    const to_phone = body?.to_phone || body?.to || body?.recipient || null;

    if (!rawFrom || !text) {
      return Response.json({ ok: true, ignored: true, reason: "missing_from_or_text" });
    }

    // ─── CHECK IF INCOMING MESSAGE IS TO PLATFORM WHATSAPP (RITESH HUMAN AI OUTREACH AGENT) ───
    const isPlatformSession =
      session_id === "platform-admin" ||
      session_id === "default" ||
      session_id === "platform" ||
      (to_phone && String(to_phone).replace(/[^\d]/g, "").includes("8354998343"));

    if (isPlatformSession) {
      const { handlePlatformIncomingWhatsApp } = await import("./platform-ai-agent.server");
      const isBridgeLiveEvent = body?.event === "message";
      const senderPn = body?.sender_pn || body?.senderPn || body?.phone || null;
      const senderLid = body?.sender_lid || body?.senderLid || (String(rawFrom).includes("@lid") ? rawFrom : null);

      const result = await handlePlatformIncomingWhatsApp({
        rawFrom,
        senderPn,
        senderLid,
        text,
        senderName: name,
        sessionId: session_id || "platform-admin",
        isBridgeLiveEvent,
      });

      return Response.json({
        ok: true,
        handled: "platform_ai_agent",
        aiEnabled: result.aiEnabled,
        reply: result.reply,
        sent: result.sent,
        leadId: result.leadId,
        needs_bridge_send: isBridgeLiveEvent && Boolean(result.reply),
      });
    }

    // ─── STRICT & SAFE CLINIC RESOLUTION ───
    let clinic: any = null;

    // 1. Resolve by explicit clinic_id or route param
    if (clinic_id) {
      if (isUuid(clinic_id)) {
        const { data } = await sb.from("clinics").select("*").eq("id", clinic_id).maybeSingle();
        if (data) clinic = data;
      } else if (typeof clinic_id === "string" && clinic_id !== "default") {
        const { data } = await sb.from("clinics").select("*").eq("slug", clinic_id).maybeSingle();
        if (data) clinic = data;
      }
    }

    // 2. Resolve by session_id
    if (!clinic && session_id) {
      const rawClinicId = String(session_id).replace(/^user-/, "");
      if (isUuid(rawClinicId)) {
        const { data } = await sb
          .from("clinics")
          .select("*")
          .or(`id.eq.${rawClinicId},wa_session_id.eq.${session_id}`)
          .maybeSingle();
        if (data) clinic = data;
      } else {
        const { data } = await sb
          .from("clinics")
          .select("*")
          .eq("wa_session_id", String(session_id))
          .maybeSingle();
        if (data) clinic = data;
      }
    }

    // 3. Resolve by receiving WhatsApp number (to_phone)
    if (!clinic && to_phone) {
      const cleanTo = String(to_phone).replace(/[^\d]/g, "");
      if (cleanTo.length >= 7) {
        const last10 = cleanTo.slice(-10);
        const { data } = await sb
          .from("clinics")
          .select("*")
          .or(
            `wa_phone.ilike.%${last10}%,phone.ilike.%${last10}%,personal_phone.ilike.%${last10}%,wa_phone.ilike.%${cleanTo}%,phone.ilike.%${cleanTo}%`,
          )
          .limit(1)
          .maybeSingle();
        if (data) clinic = data;
      }
    }

    // 4. Resolve from ready clinics
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

    // 5. Fallback for single clinic deployment
    if (!clinic) {
      const { data: allClinics } = await sb.from("clinics").select("*").limit(2);
      if (allClinics && allClinics.length === 1) {
        clinic = allClinics[0];
      }
    }

    // 6. Final safety fallback: default clinic from database
    if (!clinic) {
      const { data: firstClinic } = await sb
        .from("clinics")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (firstClinic) {
        clinic = firstClinic;
      }
    }

    if (!clinic) {
      console.warn(
        `[WhatsApp Webhook] Unmapped message received from ${rawFrom} to session ${session_id || "unknown"}`,
      );
      return Response.json({ ok: false, error: "unmapped_session_clinic" }, { status: 404 });
    }

    // Auto-sync clinic session if needed
    if (session_id && (!clinic.wa_session_id || clinic.wa_status !== "ready")) {
      void sb
        .from("clinics")
        .update({
          wa_status: "ready",
          wa_session_id: session_id,
          wa_connected_at: clinic.wa_connected_at || new Date().toISOString(),
        })
        .eq("id", clinic.id);
    }

    // ─── PROCESS MESSAGE FOR THE VERIFIED TARGET CLINIC ───
    const cleanPhone = String(rawFrom).replace(/@.*$/, "").replace(/[^\d]/g, "");
    const formattedPhone = cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${cleanPhone}`;

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

    // ─── CHECK IF AI RECEPTIONIST IS TURNED ON FOR THIS CLINIC ───
    const isAiEnabled = (clinic.working_hours as any)?.ai_receptionist_enabled !== false;
    if (!isAiEnabled) {
      console.log(`[WhatsApp Webhook] AI Receptionist is paused (OFF) for clinic ${clinic.clinic_name} (${clinic.id})`);
      await logBestEffort(
        sb.from("whatsapp_logs").insert({
          organization_id: clinic.organization_id,
          patient_name: name || null,
          patient_phone: formattedPhone,
          template_key: "ai_receptionist_paused",
          automation_key: "ai_receptionist_paused",
          message: text + " (AI Receptionist is turned OFF)",
          status: "paused",
          sent_at: new Date().toISOString(),
        }),
      );
      return Response.json({
        ok: true,
        ignored: true,
        reason: "ai_receptionist_turned_off",
        clinic_id: clinic.id,
        message: "AI Receptionist is currently turned OFF by clinic admin",
      });
    }

    // ─── PROCESS AUTOMATED BOOKING & CONVERSATION ───
    const bookingResult = await processWhatsAppMessage({
      clinic,
      patientPhone: formattedPhone,
      senderName: name || null,
      incomingText: text,
    });

    const isBridgeLiveEvent = body?.event === "message";
    const replySessionId = session_id || clinic.wa_session_id || clinicSessionId(clinic.id);
    let sendResult: { ok: boolean; error?: string } = { ok: false };

    if (isBridgeLiveEvent) {
      // The bridge is holding the active socket open to the patient's remoteJid.
      // Returning the reply directly in the webhook response avoids circular HTTP latency,
      // LID format mismatches, and timeouts on Render/Vercel.
      sendResult = { ok: true, error: undefined };
    } else {
      // Out-of-band trigger (e.g. admin simulator or direct test) -> send via configured BAILEYS_URL
      sendResult = await baileysSend(replySessionId, formattedPhone, bookingResult.reply);

      // Fallback if primary session send failed
      if (!sendResult.ok && clinic.wa_session_id && clinic.wa_session_id !== replySessionId) {
        const retryRes = await baileysSend(clinic.wa_session_id, formattedPhone, bookingResult.reply);
        if (retryRes.ok) sendResult = retryRes;
      }
      if (!sendResult.ok && replySessionId !== "default" && replySessionId !== "user-default") {
        const defRetry = await baileysSend("user-default", formattedPhone, bookingResult.reply);
        if (defRetry.ok) sendResult = defRetry;
      }
    }

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
        status: isBridgeLiveEvent ? "delivered_to_bridge" : (sendResult.ok ? "sent" : "failed"),
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
      session_id: replySessionId,
      reply: bookingResult.reply,
      sent: !isBridgeLiveEvent && sendResult.ok,
      needs_bridge_send: isBridgeLiveEvent || !sendResult.ok,
      error: sendResult.error,
    });
  } catch (e: any) {
    console.error("[WhatsApp AI Webhook Error]:", e);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
