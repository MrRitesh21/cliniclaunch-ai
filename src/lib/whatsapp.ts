import { supabase } from "@/integrations/supabase/client";

export type WaTemplateKey =
  | "lead_alert"
  | "appointment_alert"
  | "appointment_received"
  | "appointment_confirmed"
  | "appointment_reminder"
  | "followup"
  | "review_request"
  | "walkin_doctor_alert"
  | "walkin_confirmation"
  // Clinical / hospital events
  | "lab_report_ready"
  | "prescription_ready"
  | "discharge_summary"
  | "opd_token"
  | "vaccination_reminder"
  | "medicine_refill"
  | "bill_payment_reminder"
  | "health_camp_invite"
  | "birthday_wishes"
  | "abnormal_report_alert";

export const DEFAULT_TEMPLATES: Array<{
  key: WaTemplateKey;
  name: string;
  description: string;
  body: string;
  variables: string[];
  audience: "doctor" | "patient";
}> = [
  {
    key: "lead_alert",
    name: "New Lead Alert (to doctor)",
    description: "Notifies the doctor on their WhatsApp when a new lead (callback / enquiry) comes in.",
    body: "🔔 New lead for {clinic_name}\n\nName: {name}\nPhone: {phone}\nSource: {source}\nMessage: {message}",
    variables: ["clinic_name", "name", "phone", "source", "message"],
    audience: "doctor",
  },
  {
    key: "appointment_alert",
    name: "New Appointment Alert (to doctor)",
    description: "Notifies the doctor when a patient books a new appointment.",
    body: "📅 New appointment booked\n\nPatient: {patient_name}\nPhone: {patient_phone}\nWhen: {date} at {time}\nType: {appointment_type}\nProblem: {problem}",
    variables: ["patient_name", "patient_phone", "date", "time", "appointment_type", "problem"],
    audience: "doctor",
  },
  {
    key: "appointment_confirmed",
    name: "Appointment Confirmed",
    description: "Sent to the patient when you confirm a booking. For online appointments, the video link is appended automatically.",
    body: "Hi {patient_name} 👋, your appointment with {doctor_name} is confirmed for {date} at {time}. {consult_info}See you soon! 🏥",
    variables: ["patient_name", "doctor_name", "date", "time", "consult_info"],
    audience: "patient",
  },
  {
    key: "appointment_reminder",
    name: "24-hour Reminder",
    description: "Reminder sent 24 hours before the visit.",
    body: "Reminder: Your appointment with {doctor_name} is tomorrow at {time}. Reply CANCEL to cancel.",
    variables: ["doctor_name", "time"],
    audience: "patient",
  },
  {
    key: "followup",
    name: "Post-visit Follow-up",
    description: "Sent 3 days after a completed visit.",
    body: "Hi {patient_name}, hope you're feeling better after your visit! Book your next appointment: {clinic_link}",
    variables: ["patient_name", "clinic_link"],
    audience: "patient",
  },
  {
    key: "review_request",
    name: "Review Request",
    description: "Sent 7 days after a completed visit.",
    body: "Hi {patient_name}, we'd love your feedback! Leave us a review: {clinic_link}/review ⭐",
    variables: ["patient_name", "clinic_link"],
    audience: "patient",
  },
  {
    key: "walkin_doctor_alert",
    name: "New Walk-in Alert (to doctor)",
    description: "Notifies the doctor when a new walk-in is registered.",
    body: "🚶 New walk-in: {patient_name}\nPhone: {patient_phone}\nTime: {time}",
    variables: ["patient_name", "patient_phone", "time"],
    audience: "doctor",
  },
  {
    key: "walkin_confirmation",
    name: "Walk-in Confirmation",
    description: "Sent to the patient after walk-in registration.",
    body: "Hi {patient_name}, you are registered for a walk-in at {clinic_name}. Your estimated time is {time}. See you soon!",
    variables: ["patient_name", "clinic_name", "time"],
    audience: "patient",
  },
  {
    key: "appointment_received",
    name: "Booking Received",
    description: "Sent to the patient immediately after they book online.",
    body: "Hi {patient_name}, we have received your booking for {date} at {time}. {doctor_name} will confirm it shortly. Thank you!",
    variables: ["patient_name", "date", "time", "doctor_name", "clinic_name"],
    audience: "patient",
  },
  // ── Clinical / hospital events ─────────────────────────────────────────────
  {
    key: "lab_report_ready",
    name: "Lab Report Ready",
    description: "Notifies the patient when their lab/diagnostic report is available.",
    body: "🧪 Hi {patient_name}, your {test_name} report is ready at {clinic_name}.\n\nCollection: {collection_point}\nReport No: {report_no}\n\nPlease collect it during working hours or ask for the digital copy. 📋",
    variables: ["patient_name", "test_name", "clinic_name", "collection_point", "report_no"],
    audience: "patient",
  },
  {
    key: "prescription_ready",
    name: "Prescription Ready",
    description: "Alerts the patient that their prescription / medicine is ready to collect.",
    body: "💊 Hi {patient_name}, your prescription from Dr. {doctor_name} is ready.\n\nCollect it from {clinic_name} or show this token: {token}\n\nStay healthy! 🌿",
    variables: ["patient_name", "doctor_name", "clinic_name", "token"],
    audience: "patient",
  },
  {
    key: "discharge_summary",
    name: "Discharge Summary",
    description: "Sent to the patient on hospital discharge with follow-up instructions.",
    body: "🏥 Dear {patient_name}, you have been discharged from {clinic_name} on {date}.\n\nNext follow-up: {followup_date} with Dr. {doctor_name}.\nImportant notes: {instructions}\n\nGet well soon! 🙏",
    variables: ["patient_name", "clinic_name", "date", "followup_date", "doctor_name", "instructions"],
    audience: "patient",
  },
  {
    key: "opd_token",
    name: "OPD Queue Token",
    description: "Issued when the patient registers for OPD / walk-in queue.",
    body: "🎫 Hi {patient_name}, your OPD token at {clinic_name} is *#{token_number}*.\n\nEstimated wait: ~{wait_minutes} minutes.\nDoctor: {doctor_name}\n\nPlease stay nearby. 📍",
    variables: ["patient_name", "clinic_name", "token_number", "wait_minutes", "doctor_name"],
    audience: "patient",
  },
  {
    key: "vaccination_reminder",
    name: "Vaccination Reminder",
    description: "Reminds the patient (or parent) about an upcoming vaccine / booster.",
    body: "💉 Vaccination reminder for {patient_name}!\n\n*Vaccine:* {vaccine_name}\n*Due date:* {due_date}\n*Clinic:* {clinic_name}\n\nPlease book your slot: {clinic_link}\nCall us if you have questions. 🩺",
    variables: ["patient_name", "vaccine_name", "due_date", "clinic_name", "clinic_link"],
    audience: "patient",
  },
  {
    key: "medicine_refill",
    name: "Medicine Refill Reminder",
    description: "Reminds the patient to refill their ongoing medication.",
    body: "⏰ Hi {patient_name}, it's time to refill your medication — *{medicine_name}*.\n\nYour last prescription was from Dr. {doctor_name} on {last_date}.\n\nBook a follow-up: {clinic_link} 📲",
    variables: ["patient_name", "medicine_name", "doctor_name", "last_date", "clinic_link"],
    audience: "patient",
  },
  {
    key: "bill_payment_reminder",
    name: "Bill Payment Reminder",
    description: "Gentle reminder for outstanding bills / dues.",
    body: "🧾 Hi {patient_name}, this is a gentle reminder of a pending amount of ₹{amount} at {clinic_name}.\n\nBill No: {bill_no} | Due: {due_date}\n\nPay online: {payment_link} or visit the billing counter.\nThank you! 🙏",
    variables: ["patient_name", "amount", "clinic_name", "bill_no", "due_date", "payment_link"],
    audience: "patient",
  },
  {
    key: "health_camp_invite",
    name: "Health Camp / Camp Invite",
    description: "Invites patients to a free health camp, blood donation drive, or wellness event.",
    body: "🏕️ {clinic_name} invites you to a *Free Health Camp*!\n\n📅 Date: {event_date}\n⏰ Time: {event_time}\n📍 Venue: {venue}\n🩺 Services: {services}\n\nRegistration is FREE. Bring this message as your entry pass.\nSee you there, {patient_name}! ✨",
    variables: ["clinic_name", "event_date", "event_time", "venue", "services", "patient_name"],
    audience: "patient",
  },
  {
    key: "birthday_wishes",
    name: "Birthday Wishes",
    description: "Warm birthday message sent on the patient's birthday to build loyalty.",
    body: "🎂 Happy Birthday, {patient_name}! 🎉\n\nWishing you great health and happiness on your special day!\n\n{clinic_name} is always here to keep you healthy. 💙\n\nBook your annual health check-up: {clinic_link}",
    variables: ["patient_name", "clinic_name", "clinic_link"],
    audience: "patient",
  },
  {
    key: "abnormal_report_alert",
    name: "Abnormal Report Alert (Doctor)",
    description: "Alerts the doctor when a critical / abnormal lab value is flagged.",
    body: "🚨 *Critical Report Alert* — {clinic_name}\n\nPatient: {patient_name} ({patient_phone})\nTest: {test_name}\n*Result:* {result} (Normal: {normal_range})\nFlagged: {flag_reason}\n\nPlease review immediately. ⚠️",
    variables: ["clinic_name", "patient_name", "patient_phone", "test_name", "result", "normal_range", "flag_reason"],
    audience: "doctor",
  },
];

export function renderTemplate(body: string, vars: Record<string, string | number | undefined>): string {
  return body.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? `{${k}}` : String(v);
  });
}

export function waLink(phone: string, message: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export async function ensureDefaultTemplates(organizationId: string): Promise<void> {
  const { data } = await supabase
    .from("whatsapp_templates")
    .select("template_key")
    .eq("organization_id", organizationId);
  const existing = new Set((data ?? []).map((r) => r.template_key));
  const missing = DEFAULT_TEMPLATES.filter((t) => !existing.has(t.key));
  if (missing.length === 0) return;
  await supabase.from("whatsapp_templates").insert(
    missing.map((t) => ({
      organization_id: organizationId,
      template_key: t.key,
      name: t.name,
      body: t.body,
      is_active: true,
    })),
  );
}

export type SendWaOptions = {
  organizationId: string;
  templateKey: WaTemplateKey;
  patientName?: string;
  patientPhone: string;
  variables: Record<string, string | number | undefined>;
  appointmentId?: string;
  openWindow?: boolean;
};

/**
 * "Send" a WhatsApp message — MVP uses click-to-chat (wa.me) and logs the attempt.
 * Returns the wa.me link so the caller can open it.
 */
export async function sendWhatsApp(opts: SendWaOptions): Promise<{ link: string | null; logged: boolean }> {
  // Fetch active template
  const { data: tpl } = await supabase
    .from("whatsapp_templates")
    .select("body, is_active")
    .eq("organization_id", opts.organizationId)
    .eq("template_key", opts.templateKey)
    .maybeSingle();

  if (!tpl || !tpl.is_active) {
    return { link: null, logged: false };
  }

  const message = renderTemplate(tpl.body, opts.variables);
  const link = waLink(opts.patientPhone, message);

  await supabase.from("whatsapp_logs").insert({
    organization_id: opts.organizationId,
    appointment_id: opts.appointmentId ?? null,
    patient_name: opts.patientName ?? null,
    patient_phone: opts.patientPhone,
    template_key: opts.templateKey,
    message,
    wa_link: link,
    status: "sent",
  });

  if (opts.openWindow && typeof window !== "undefined") {
    window.open(link, "_blank", "noopener,noreferrer");
  }

  return { link, logged: true };
}
