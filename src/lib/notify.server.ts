// Server-side helper: render template + send via doctor's Baileys session.
// Always inserts a row into whatsapp_logs.
//
// Caller must already have a server supabase client (admin or RLS) with
// permission to read whatsapp_templates / insert whatsapp_logs for the org.

import { baileysSend, baileysStatus, clinicSessionId } from "./baileys.server";
import { renderTemplate } from "./whatsapp";

export async function notifyClinicEvent(opts: {
  sb: any;
  clinicId: string;
  templateKey: string;
  recipientPhone: string;
  recipientName?: string | null;
  appointmentId?: string | null;
  variables: Record<string, string | number | null | undefined>;
}): Promise<{ ok: boolean; status: string; error?: string | null }> {
  const { sb, clinicId, templateKey, recipientPhone, recipientName, appointmentId, variables } =
    opts;
  try {
    const { data: clinic } = await sb
      .from("clinics")
      .select("id, organization_id, wa_status")
      .eq("id", clinicId)
      .maybeSingle();
    if (!clinic) return { ok: false, status: "failed", error: "clinic not found" };

    const { data: tpl } = await sb
      .from("whatsapp_templates")
      .select("body, is_active")
      .eq("organization_id", clinic.organization_id)
      .eq("template_key", templateKey)
      .maybeSingle();
    if (!tpl || !tpl.is_active) return { ok: false, status: "skipped", error: "template inactive" };

    const message = renderTemplate(tpl.body, variables);
    const digits = (recipientPhone || "").replace(/[^\d]/g, "");
    const waLink = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

    const sessionId = clinicSessionId(clinic.id);
    let status = "pending";
    let error: string | null = null;
    const live = await baileysStatus(sessionId);
    const canAutoSend = live?.ready || clinic.wa_status === "ready";
    if (canAutoSend) {
      const r = await baileysSend(sessionId, recipientPhone, message);
      if (r.ok) status = "sent";
      else {
        status = "failed";
        error = r.error ?? "send failed";
      }

      if (live?.ready && clinic.wa_status !== "ready") {
        await sb
          .from("clinics")
          .update({
            wa_status: "ready",
            wa_phone: live.clientInfo?.phone ?? null,
            wa_session_id: sessionId,
            wa_connected_at: new Date().toISOString(),
          })
          .eq("id", clinic.id);
      }
    }

    await sb.from("whatsapp_logs").insert({
      organization_id: clinic.organization_id,
      appointment_id: appointmentId ?? null,
      patient_name: recipientName ?? null,
      patient_phone: recipientPhone,
      template_key: templateKey,
      automation_key: templateKey,
      message,
      wa_link: waLink,
      status,
      error,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    });

    return { ok: status === "sent", status, error };
  } catch (e) {
    return { ok: false, status: "failed", error: (e as Error).message };
  }
}
