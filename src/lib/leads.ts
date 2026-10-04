import { supabase } from "@/integrations/supabase/client";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminClient } from "./clinic.functions";

export const leadSchema = z.object({
  clinic_id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(100),
  phone: z.string().trim().min(5, "Phone is required").max(20),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  message: z.string().trim().max(500).optional().or(z.literal("")),
  source: z.enum(["callback", "offer", "whatsapp", "newsletter"]).default("callback"),
});

export type LeadInput = z.infer<typeof leadSchema>;

// Public server fn — creates lead + dispatches WhatsApp alert to the doctor.
export const submitLeadServer = createServerFn({ method: "POST" })
  .validator((i: unknown) => leadSchema.parse(i))
  .handler(async ({ data }) => {
    // Redis-backed budgets (per-IP and per-phone), shared across instances.
    const { enforcePolicy, callerIp } = await import("./scale.server");
    await enforcePolicy("lead_ip", `${data.clinic_id}:${await callerIp()}`);
    await enforcePolicy("lead_phone", `${data.clinic_id}:${data.phone}`);

    const sb = await adminClient();
    const { error } = await sb.from("leads").insert({
      clinic_id: data.clinic_id,
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      message: data.message || null,
      source: data.source,
    });
    if (error) throw new Error(error.message);

    // Doctor alert (best-effort)
    try {
      const { notifyClinicEvent } = await import("./notify.server");
      const { data: clinic } = await sb
        .from("clinics")
        .select("personal_phone, phone, doctor_name, clinic_name")
        .eq("id", data.clinic_id)
        .maybeSingle();
      const c = clinic as { personal_phone?: string | null; phone?: string | null; clinic_name?: string | null } | null;
      const doctorPhone = c?.personal_phone || c?.phone || null;
      if (doctorPhone) {
        await notifyClinicEvent({
          sb,
          clinicId: data.clinic_id,
          templateKey: "lead_alert",
          recipientPhone: doctorPhone,
          variables: {
            clinic_name: c?.clinic_name ?? "",
            name: data.name,
            phone: data.phone,
            source: data.source,
            message: data.message ?? "",
          },
        });
      }
    } catch { /* swallow */ }
    return { ok: true };
  });

// Demo/marketing lead (no clinic context) — must go through the server because
// anonymous inserts into `leads` are restricted to real clinics by RLS.
export const demoLeadSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(5).max(20),
  email: z.string().trim().email().max(200),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const submitDemoLeadServer = createServerFn({ method: "POST" })
  .validator((i: unknown) => demoLeadSchema.parse(i))
  .handler(async ({ data }) => {
    const { enforcePolicy, callerIp } = await import("./scale.server");
    await enforcePolicy("lead_ip", `demo:${await callerIp()}`);
    await enforcePolicy("lead_phone", `demo:${data.phone}`);

    const sb = await adminClient();
    const { error } = await sb.from("leads").insert({
      name: data.name,
      phone: data.phone,
      email: data.email,
      message: data.message || null,
      source: "demo_booking",
      status: "new",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Client wrapper kept for backwards compatibility.
export async function submitLead(input: LeadInput) {
  const parsed = leadSchema.parse(input);
  await submitLeadServer({ data: parsed });
}


// Re-export for any direct consumers that imported supabase from this module
export { supabase };
