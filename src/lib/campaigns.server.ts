// Server-only campaign engine: audience resolution + real dispatch.
// WhatsApp goes out through the clinic's Baileys session; email/sms are
// recorded as queued until a provider is connected.

import { baileysSend, baileysStatus, clinicSessionId } from "./baileys.server";
import { renderTemplate } from "./whatsapp";

export type AudienceSegment =
  "all_patients" | "recent_visitors" | "lapsed_patients" | "new_leads" | "all_leads";

export const AUDIENCE_SEGMENTS: { key: AudienceSegment; label: string; description: string }[] = [
  { key: "all_patients", label: "All patients", description: "Every patient in your CRM" },
  {
    key: "recent_visitors",
    label: "Recent visitors (90 days)",
    description: "Seen in the last 3 months",
  },
  { key: "lapsed_patients", label: "Lapsed patients (180+ days)", description: "Due for a recall" },
  { key: "new_leads", label: "New leads", description: "Enquiries not yet contacted" },
  { key: "all_leads", label: "All leads", description: "Every enquiry ever captured" },
];

export interface Recipient {
  patient_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
}

export { renderTemplate };

export async function resolveAudience(
  sb: any,
  orgId: string,
  segment: AudienceSegment,
): Promise<Recipient[]> {
  if (segment === "new_leads" || segment === "all_leads") {
    let q = sb
      .from("leads")
      .select("id, name, phone, email, status")
      .eq("organization_id", orgId)
      .limit(2000);
    if (segment === "new_leads") q = q.eq("status", "new");
    const { data } = await q;
    return ((data ?? []) as any[]).map((l) => ({
      patient_id: null,
      name: l.name ?? "there",
      phone: l.phone ?? null,
      email: l.email ?? null,
    }));
  }

  const { data: patients } = await sb
    .from("patients")
    .select("id, name, phone, email")
    .eq("organization_id", orgId)
    .limit(5000);
  const all = ((patients ?? []) as any[]).map((p) => ({
    patient_id: p.id as string,
    name: (p.name as string) ?? "there",
    phone: (p.phone as string) ?? null,
    email: (p.email as string) ?? null,
  }));
  if (segment === "all_patients") return all;

  const cutoff = new Date(Date.now() - (segment === "recent_visitors" ? 90 : 180) * 864e5)
    .toISOString()
    .slice(0, 10);
  const { data: appts } = await sb
    .from("appointments")
    .select("patient_id, appointment_date")
    .eq("organization_id", orgId)
    .gte("appointment_date", cutoff)
    .limit(10000);
  const seen = new Set(((appts ?? []) as any[]).map((a) => a.patient_id).filter(Boolean));
  return segment === "recent_visitors"
    ? all.filter((p) => seen.has(p.patient_id))
    : all.filter((p) => !seen.has(p.patient_id));
}

/**
 * Sends a campaign to its resolved audience and writes one
 * marketing_recipients row per contact so delivery is auditable.
 */
export async function dispatchCampaign(
  sb: any,
  campaignId: string,
): Promise<{ sent: number; failed: number; skipped: number; total: number }> {
  const { data: camp } = await sb
    .from("marketing_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();
  if (!camp) throw new Error("Campaign not found");

  const orgId = camp.organization_id as string;
  const segment = (camp.audience_segment as AudienceSegment) || "all_patients";
  const recipients = await resolveAudience(sb, orgId, segment);

  const { data: clinic } = await sb
    .from("clinics")
    .select("id, clinic_name, doctor_name, wa_status")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const counters = { sent: 0, failed: 0, skipped: 0, total: recipients.length };
  const isWhatsApp = camp.channel === "whatsapp";
  let canSend = false;
  let sessionId = "";

  if (isWhatsApp && clinic?.id) {
    sessionId = clinicSessionId(clinic.id as string);
    const live = await baileysStatus(sessionId);
    canSend = Boolean(live?.ready || clinic.wa_status === "ready");
  }

  for (const r of recipients) {
    const message = renderTemplate(camp.body ?? "", {
      patient_name: r.name,
      clinic_name: clinic?.clinic_name ?? "",
      doctor_name: clinic?.doctor_name ?? "",
      cta_url: camp.cta_url ?? "",
    });

    let status = "queued";
    let error: string | null = null;

    if (isWhatsApp) {
      if (!r.phone) {
        status = "skipped";
        error = "no phone number";
      } else if (canSend) {
        const res = await baileysSend(sessionId, r.phone, message);
        status = res.ok ? "sent" : "failed";
        error = res.ok ? null : (res.error ?? "send failed");
      } else {
        status = "queued";
        error = "WhatsApp not connected";
      }
    } else if (camp.channel === "email" && !r.email) {
      status = "skipped";
      error = "no email address";
    }

    if (status === "sent") counters.sent++;
    else if (status === "failed") counters.failed++;
    else if (status === "skipped") counters.skipped++;

    await sb.from("marketing_recipients").insert({
      organization_id: orgId,
      campaign_id: campaignId,
      patient_id: r.patient_id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      status,
      error,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    });
  }

  await sb
    .from("marketing_campaigns")
    .update({
      status: counters.sent > 0 || counters.total === 0 ? "completed" : "running",
      sent_at: new Date().toISOString(),
      recipient_count: counters.total,
      delivered_count: counters.sent,
    })
    .eq("id", campaignId);

  return counters;
}
