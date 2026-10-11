import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SB = any;

async function getMyManagedClinic(supabase: SB, userId: string) {
  const { data: orgs } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .in("role", ["owner", "admin", "doctor"]);
  const orgIds = (orgs ?? []).map((o: { organization_id: string }) => o.organization_id);
  if (orgIds.length === 0) {
    throw new Error("Forbidden: you must be an owner, admin, or doctor to manage WhatsApp");
  }
  const { data: clinic, error } = await supabase
    .from("clinics")
    .select(
      "id, organization_id, clinic_name, doctor_name, specialization, phone, address, working_hours, consultation_fee, slug, wa_status, wa_phone, wa_session_id",
    )
    .in("organization_id", orgIds)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!clinic) throw new Error("No clinic found for your organization");
  return clinic;
}

function formatWorkingHours(wh: unknown): string {
  if (!wh) return "10:00 AM - 8:00 PM";
  if (typeof wh === "string") {
    try {
      const parsed = JSON.parse(wh);
      if (typeof parsed === "object" && parsed !== null) {
        return formatWorkingHours(parsed);
      }
    } catch {
      return wh.trim() || "10:00 AM - 8:00 PM";
    }
    return wh.trim() || "10:00 AM - 8:00 PM";
  }
  if (typeof wh === "object" && wh !== null) {
    const obj = wh as { start?: string; end?: string; days?: number[] };
    if (obj.start && obj.end) {
      const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      let daysStr = "";
      if (Array.isArray(obj.days) && obj.days.length > 0) {
        if (obj.days.length === 7) {
          daysStr = "Every day";
        } else if (obj.days.length === 6 && !obj.days.includes(0)) {
          daysStr = "Mon - Sat";
        } else if (obj.days.length === 5 && !obj.days.includes(0) && !obj.days.includes(6)) {
          daysStr = "Mon - Fri";
        } else {
          daysStr = obj.days.map((d) => DAY_NAMES[d] || String(d)).join(", ");
        }
      }
      return `${obj.start} - ${obj.end}${daysStr ? ` (${daysStr})` : ""}`;
    }
  }
  return "10:00 AM - 8:00 PM";
}

/**
 * Get AI Receptionist live status, stats & recent conversational logs.
 */
export const getAiReceptionistInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clinic = await getMyManagedClinic(context.supabase, context.userId);

    const todayStr = new Date().toISOString().split("T")[0];

    // Count today's WhatsApp bookings
    const { count: todayBookings } = await context.supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinic.id)
      .eq("appointment_date", todayStr)
      .eq("source", "whatsapp");

    // Count total WhatsApp bookings
    const { count: totalBookings } = await context.supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinic.id)
      .eq("source", "whatsapp");

    // Fetch latest receptionist messages (last 10)
    const { data: recentLogs } = await context.supabase
      .from("whatsapp_logs")
      .select("id, patient_name, patient_phone, message, template_key, status, created_at")
      .eq("organization_id", clinic.organization_id)
      .order("created_at", { ascending: false })
      .limit(10);

    return {
      clinic: {
        id: String(clinic.id),
        name: String(clinic.clinic_name || "My Clinic"),
        doctor: String(clinic.doctor_name || "Doctor"),
        specialization: String(clinic.specialization || "General Medicine"),
        address: String(clinic.address || "Clinic Address"),
        workingHours: formatWorkingHours(clinic.working_hours),
        consultationFee: Number(clinic.consultation_fee ?? 500),
        waStatus: String(clinic.wa_status || "disconnected"),
        waPhone: clinic.wa_phone ? String(clinic.wa_phone) : null,
        isOnline: clinic.wa_status === "ready",
      },
      stats: {
        todayBookings: Number(todayBookings ?? 0),
        totalBookings: Number(totalBookings ?? 0),
      },
      recentLogs: recentLogs || [],
    };
  });

/**
 * Simulate the AI Receptionist directly from the dashboard so the doctor
 * can test conversing with the bot in real time!
 */
export const testAiReceptionistSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      message: z.string().min(1, "Message is required"),
      patientName: z.string().optional(),
      patientPhone: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const clinic = await getMyManagedClinic(context.supabase, context.userId);
    const { processWhatsAppMessage } = await import("./whatsapp-booking.server");

    const phone = data.patientPhone?.trim() || "+919876543210";
    const name = data.patientName?.trim() || "Test Patient";

    const result = await processWhatsAppMessage({
      clinic,
      patientPhone: phone,
      senderName: name,
      incomingText: data.message,
    });

    return {
      success: true,
      reply: result.reply,
      action: result.action,
      appointmentId: result.appointmentId || null,
      tokenNumber: result.tokenNumber || null,
    };
  });
