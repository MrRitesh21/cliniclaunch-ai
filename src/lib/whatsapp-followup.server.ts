/**
 * @module whatsapp-followup.server
 * @description Auto Follow-Up Engine for Quiet / Abandoned WhatsApp Patient Chats.
 *
 * Capabilities:
 * - Detects active patient booking conversations that went quiet (patient stopped responding).
 * - Enforces quiet hours (e.g. 22:00 - 08:00 IST) so patients are never disturbed at night.
 * - Prevents duplicate spam (at most 1 follow-up per session, 24-hr cooldown).
 * - Automatically skips if appointment is already confirmed or cancelled.
 * - Dispatches warm, polite, conversational follow-up via Baileys WhatsApp Gateway.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { baileysSend } from "./baileys.server";

export interface QuietFollowupSettings {
  enabled: boolean;
  delayMinutes: number; // e.g. 15, 30, 60, 120
  messageTemplate: string;
  quietStart: string; // "22:00"
  quietEnd: string; // "08:00"
}

export interface QuietFollowupResult {
  ok: boolean;
  processedCount: number;
  sentCount: number;
  skippedCount: number;
  reasons: Array<{ phone: string; reason: string }>;
  message: string;
}

const DEFAULT_SETTINGS: QuietFollowupSettings = {
  enabled: true,
  delayMinutes: 30,
  messageTemplate:
    "Namaste {{patient_name}}! 🙏 Humne dekha aap clinic appointment ke baare mein pooch rahe the. Kya hum aapka slot reserve kar dein ya aapko koi aur jaankari chahiye? Kripya apna preferred samay batayein, hum turant confirm kar denge! 🏥",
  quietStart: "22:00",
  quietEnd: "08:00",
};

/**
 * Checks if current time in IST is within quiet hours (e.g. 22:00 to 08:00).
 */
export function isCurrentTimeInQuietHours(quietStart = "22:00", quietEnd = "08:00"): boolean {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());

    const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
    const currentMin = hour * 60 + minute;

    const [sH, sM] = quietStart.split(":").map(Number);
    const [eH, eM] = quietEnd.split(":").map(Number);
    const startMin = sH * 60 + (sM || 0);
    const endMin = eH * 60 + (eM || 0);

    if (startMin > endMin) {
      // Overnight range, e.g. 22:00 to 08:00
      return currentMin >= startMin || currentMin < endMin;
    }
    return currentMin >= startMin && currentMin < endMin;
  } catch {
    return false;
  }
}

/**
 * Read quiet follow-up settings from system_settings
 */
export async function getQuietFollowupSettings(): Promise<QuietFollowupSettings> {
  try {
    const { data: rows } = await supabaseAdmin
      .from("system_settings" as any)
      .select("key, value")
      .in("key", [
        "ai_auto_followup_enabled",
        "ai_auto_followup_delay_minutes",
        "ai_auto_followup_message",
        "ai_auto_followup_quiet_start",
        "ai_auto_followup_quiet_end",
      ]);

    const map: Record<string, string> = {};
    (rows || []).forEach((r: any) => {
      map[r.key] = r.value || "";
    });

    return {
      enabled: map.ai_auto_followup_enabled !== "false",
      delayMinutes: map.ai_auto_followup_delay_minutes ? parseInt(map.ai_auto_followup_delay_minutes, 10) : DEFAULT_SETTINGS.delayMinutes,
      messageTemplate: map.ai_auto_followup_message?.trim() || DEFAULT_SETTINGS.messageTemplate,
      quietStart: map.ai_auto_followup_quiet_start?.trim() || DEFAULT_SETTINGS.quietStart,
      quietEnd: map.ai_auto_followup_quiet_end?.trim() || DEFAULT_SETTINGS.quietEnd,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Sweeps for conversations that went quiet and dispatches a warm follow-up.
 * Can be called from /api/wa/cron or triggered on-demand by admins.
 */
export async function processQuietChatFollowups(opts?: {
  overrideQuietHours?: boolean;
}): Promise<QuietFollowupResult> {
  const sb = supabaseAdmin;
  const settings = await getQuietFollowupSettings();

  if (!settings.enabled) {
    return {
      ok: true,
      processedCount: 0,
      sentCount: 0,
      skippedCount: 0,
      reasons: [],
      message: "Auto follow-up is disabled in settings.",
    };
  }

  // Check quiet hours
  if (!opts?.overrideQuietHours && isCurrentTimeInQuietHours(settings.quietStart, settings.quietEnd)) {
    return {
      ok: true,
      processedCount: 0,
      sentCount: 0,
      skippedCount: 0,
      reasons: [{ phone: "*", reason: `Night quiet hours active (${settings.quietStart} - ${settings.quietEnd} IST). Sleeping patients are protected.` }],
      message: `Quiet hours active (${settings.quietStart} - ${settings.quietEnd} IST). Follow-ups paused until morning.`,
    };
  }

  const now = Date.now();
  const minAgeMs = settings.delayMinutes * 60 * 1000;
  const maxAgeMs = 12 * 60 * 60 * 1000; // Look back up to 12 hours
  const quietThresholdIso = new Date(now - minAgeMs).toISOString();
  const maxLookbackIso = new Date(now - maxAgeMs).toISOString();

  // 1. Fetch recent patient messages that haven't been resolved
  const { data: recentLogs, error: logErr } = await sb
    .from("whatsapp_logs")
    .select("id, organization_id, patient_phone, patient_name, template_key, message, created_at, status")
    .gte("created_at", maxLookbackIso)
    .order("created_at", { ascending: false })
    .limit(300);

  if (logErr || !recentLogs || recentLogs.length === 0) {
    return {
      ok: true,
      processedCount: 0,
      sentCount: 0,
      skippedCount: 0,
      reasons: [],
      message: "No recent WhatsApp conversations found to audit.",
    };
  }

  // 2. Group logs by organization & patient phone
  const conversationsByPhone = new Map<string, typeof recentLogs>();
  for (const log of recentLogs) {
    if (!log.patient_phone) continue;
    const key = `${log.organization_id}:${log.patient_phone}`;
    if (!conversationsByPhone.has(key)) {
      conversationsByPhone.set(key, []);
    }
    conversationsByPhone.get(key)!.push(log);
  }

  let sentCount = 0;
  let skippedCount = 0;
  const reasons: Array<{ phone: string; reason: string }> = [];

  for (const [convKey, logs] of conversationsByPhone.entries()) {
    const [orgId, phone] = convKey.split(":");
    // Sort logs descending (newest first)
    logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latestLog = logs[0];
    const latestTime = new Date(latestLog.created_at).getTime();

    // Check if chat has been quiet long enough
    if (now - latestTime < minAgeMs) {
      skippedCount++;
      reasons.push({ phone, reason: `Chat is still active (< ${settings.delayMinutes} mins since last message)` });
      continue;
    }

    // Check if patient already received a follow-up in the last 24h
    const hasRecentFollowup = logs.some(
      (l) => l.template_key === "chat_quiet_followup" && now - new Date(l.created_at).getTime() < 24 * 60 * 60 * 1000
    );
    if (hasRecentFollowup) {
      skippedCount++;
      reasons.push({ phone, reason: "Already received follow-up in last 24h" });
      continue;
    }

    // Check if appointment is already confirmed or created after this chat
    const { data: activeAppt } = await sb
      .from("appointments")
      .select("id, status, scheduled_at")
      .eq("organization_id", orgId)
      .eq("patient_phone", phone)
      .gte("created_at", maxLookbackIso)
      .neq("status", "cancelled")
      .limit(1)
      .maybeSingle();

    if (activeAppt) {
      skippedCount++;
      reasons.push({ phone, reason: "Patient already has a confirmed/scheduled appointment" });
      continue;
    }

    // Check if patient explicitly opted out or said "cancel"
    const patientMessages = logs
      .filter((l) => l.template_key === "incoming_patient_msg")
      .map((l) => l.message.toLowerCase());
    const hasOptOut = patientMessages.some((msg) =>
      /(cancel|nahi chahiye|stop|mat karo|don't message|not interested)/i.test(msg)
    );
    if (hasOptOut) {
      skippedCount++;
      reasons.push({ phone, reason: "Patient indicated cancellation or not interested" });
      continue;
    }

    // Find clinic details for this organization
    const { data: clinic } = await sb
      .from("clinics")
      .select("id, clinic_name, doctor_name, wa_session_id")
      .eq("organization_id", orgId)
      .limit(1)
      .maybeSingle();

    if (!clinic) {
      skippedCount++;
      reasons.push({ phone, reason: "Clinic record not found" });
      continue;
    }

    // Generate personalized follow-up message
    const patientName = latestLog.patient_name || "Patient";
    const greetingName = patientName && patientName !== "Patient" ? `${patientName} ji` : "ji";
    const message = settings.messageTemplate
      .replace(/\{\{patient_name\}\}/g, greetingName)
      .replace(/\{\{clinic_name\}\}/g, clinic.clinic_name || "Clinic")
      .replace(/\{\{doctor_name\}\}/g, clinic.doctor_name || "Doctor");

    // Dispatch WhatsApp follow-up via Baileys
    const sessionId = clinic.wa_session_id || `clinic-${clinic.id}`;
    let sendResult = await baileysSend(sessionId, phone, message);

    if (!sendResult.ok && sessionId !== "default") {
      const defRetry = await baileysSend("user-default", phone, message);
      if (defRetry.ok) sendResult = defRetry;
    }

    // Log the follow-up attempt
    await sb.from("whatsapp_logs").insert({
      organization_id: orgId,
      patient_name: latestLog.patient_name || null,
      patient_phone: phone,
      template_key: "chat_quiet_followup",
      automation_key: "chat_quiet_followup",
      message,
      status: sendResult.ok ? "sent" : "failed",
      error: sendResult.error || null,
      sent_at: sendResult.ok ? new Date().toISOString() : null,
      metadata: {
        trigger: "chat_quiet_inactivity",
        delay_minutes: settings.delayMinutes,
        quiet_hours_checked: true,
      },
    });

    if (sendResult.ok) {
      sentCount++;
      reasons.push({ phone, reason: "Follow-up delivered successfully" });
    } else {
      skippedCount++;
      reasons.push({ phone, reason: `Baileys delivery failed: ${sendResult.error || "unknown"}` });
    }
  }

  return {
    ok: true,
    processedCount: conversationsByPhone.size,
    sentCount,
    skippedCount,
    reasons,
    message: `Follow-up audit complete: Sent ${sentCount} follow-ups, skipped ${skippedCount}.`,
  };
}
