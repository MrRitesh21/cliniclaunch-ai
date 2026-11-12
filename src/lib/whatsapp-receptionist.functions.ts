import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getAllClinicKnowledgeDocs,
  getActiveSessionCount,
  clearSessionMemory,
  type RagKnowledgeDoc,
  type GuardrailSettings,
} from "./whatsapp-rag.server";

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
      "id, organization_id, clinic_name, doctor_name, specialization, phone, address, working_hours, consultation_fee, slug, wa_status, wa_phone, wa_session_id, custom_domain, services, faqs",
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
 * Get AI Assistant live status, stats, RAG knowledge docs, guardrails, & recent conversational logs.
 */
export const getAiReceptionistInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clinic = await getMyManagedClinic(context.supabase, context.userId);

    const todayStr = new Date().toISOString().split("T")[0];

    // Fetch stats and logs concurrently via Promise.all
    const [todayRes, totalRes, logsRes] = await Promise.all([
      context.supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinic.id)
        .eq("appointment_date", todayStr)
        .eq("source", "whatsapp"),
      context.supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinic.id)
        .eq("source", "whatsapp"),
      context.supabase
        .from("whatsapp_logs")
        .select("id, patient_name, patient_phone, message, template_key, status, created_at")
        .eq("organization_id", clinic.organization_id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const todayBookings = todayRes.count;
    const totalBookings = totalRes.count;
    const recentLogs = logsRes.data;

    const currentWh =
      typeof clinic.working_hours === "object" && clinic.working_hours && !Array.isArray(clinic.working_hours)
        ? (clinic.working_hours as any)
        : {};

    const ragKnowledgeDocs = getAllClinicKnowledgeDocs(clinic);
    const defaultGuardrails: GuardrailSettings = {
      blockOffTopic: true,
      maskConfidential: true,
      disallowPrescriptions: true,
      strictness: "strict",
      offTopicMessage: "",
    };
    const guardrailSettings: GuardrailSettings = {
      ...defaultGuardrails,
      ...(currentWh.guardrail_settings || {}),
    };

    const activeSessions = getActiveSessionCount(clinic.id);

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
        isAiEnabled: currentWh.ai_receptionist_enabled !== false,
        aiPersona: String(currentWh.ai_persona || "WhatsApp AI Assistant"),
        systemInstructions: String(currentWh.system_instructions || ""),
      },
      stats: {
        todayBookings: Number(todayBookings ?? 0),
        totalBookings: Number(totalBookings ?? 0),
        activeSessions,
        ragDocsCount: ragKnowledgeDocs.length,
      },
      ragKnowledgeDocs,
      guardrailSettings,
      recentLogs: recentLogs || [],
    };
  });

/**
 * Toggle the AI Assistant ON/OFF for the managed clinic.
 */
export const toggleAiReceptionistStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      enabled: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const clinic = await getMyManagedClinic(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const currentWh =
      typeof clinic.working_hours === "object" && clinic.working_hours && !Array.isArray(clinic.working_hours)
        ? clinic.working_hours
        : {};

    const updatedWh = {
      ...currentWh,
      ai_receptionist_enabled: data.enabled,
    };

    const { error: clinicErr } = await supabaseAdmin
      .from("clinics")
      .update({ working_hours: updatedWh } as any)
      .eq("id", clinic.id);

    if (clinicErr) throw new Error(clinicErr.message);

    try {
      await supabaseAdmin.from("system_settings" as any).upsert(
        {
          key: `ai_receptionist_enabled_${clinic.id}`,
          value: String(data.enabled),
          description: `WhatsApp AI Assistant toggle for clinic ${clinic.id}`,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
    } catch {}

    return {
      success: true,
      enabled: data.enabled,
    };
  });

/**
 * Simulate the AI Assistant directly from the dashboard with RAG citations,
 * session memory state, and guardrail audit flags!
 */
export const testAiReceptionistSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      message: z.string().min(1, "Message is required"),
      patientName: z.string().optional(),
      patientPhone: z.string().optional(),
      resetSession: z.boolean().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const clinic = await getMyManagedClinic(context.supabase, context.userId);
    const { processWhatsAppMessage } = await import("./whatsapp-booking.server");

    const phone = data.patientPhone?.trim() || "+919876543210";
    const name = data.patientName?.trim() || "Test Patient";

    if (data.resetSession) {
      clearSessionMemory(clinic.id, phone);
    }

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
      ragCitations: result.ragCitations || [],
      memoryState: result.memoryState || null,
      guardrailTriggered: result.guardrailTriggered || "none",
    };
  });

/**
 * Save custom AI Persona and System Instructions for the clinic's WhatsApp AI Assistant.
 */
export const saveAiReceptionistPersona = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      aiPersona: z.string().trim().max(300).default("WhatsApp AI Assistant"),
      systemInstructions: z.string().trim().max(5000).default(""),
    }),
  )
  .handler(async ({ context, data }) => {
    const clinic = await getMyManagedClinic(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const currentWh =
      typeof clinic.working_hours === "object" && clinic.working_hours && !Array.isArray(clinic.working_hours)
        ? clinic.working_hours
        : {};

    const updatedWh = {
      ...currentWh,
      ai_persona: data.aiPersona,
      system_instructions: data.systemInstructions,
    };

    const { error: clinicErr } = await supabaseAdmin
      .from("clinics")
      .update({ working_hours: updatedWh } as any)
      .eq("id", clinic.id);

    if (clinicErr) throw new Error(clinicErr.message);

    try {
      await supabaseAdmin.from("system_settings" as any).upsert(
        {
          key: `ai_persona_${clinic.id}`,
          value: JSON.stringify({
            aiPersona: data.aiPersona,
            systemInstructions: data.systemInstructions,
          }),
          description: `AI Persona and instructions for clinic ${clinic.id}`,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
    } catch {}

    return {
      success: true,
      aiPersona: data.aiPersona,
      systemInstructions: data.systemInstructions,
    };
  });

/**
 * Add or update a custom RAG Knowledge document for the clinic.
 */
export const saveAiKnowledgeDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      id: z.string().optional(),
      title: z.string().min(2, "Title is required").max(150),
      category: z.enum(["policy", "service", "pricing", "timing", "doctor", "faq", "custom"]),
      content: z.string().min(5, "Content is required").max(3000),
      keywords: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const clinic = await getMyManagedClinic(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const currentWh =
      typeof clinic.working_hours === "object" && clinic.working_hours && !Array.isArray(clinic.working_hours)
        ? (clinic.working_hours as any)
        : {};

    const existingDocs: RagKnowledgeDoc[] = Array.isArray(currentWh.rag_knowledge_docs)
      ? currentWh.rag_knowledge_docs
      : [];

    const docId = data.id || `custom-doc-${Date.now()}`;
    const newDoc: RagKnowledgeDoc = {
      id: docId,
      title: data.title.trim(),
      category: data.category,
      content: data.content.trim(),
      keywords: data.keywords || data.title.toLowerCase().split(/\s+/),
      updated_at: new Date().toISOString(),
    };

    const docIndex = existingDocs.findIndex((d) => d.id === docId);
    let updatedDocs: RagKnowledgeDoc[];
    if (docIndex >= 0) {
      updatedDocs = [...existingDocs];
      updatedDocs[docIndex] = newDoc;
    } else {
      updatedDocs = [newDoc, ...existingDocs];
    }

    const updatedWh = {
      ...currentWh,
      rag_knowledge_docs: updatedDocs,
    };

    const { error } = await supabaseAdmin
      .from("clinics")
      .update({ working_hours: updatedWh } as any)
      .eq("id", clinic.id);

    if (error) throw new Error(error.message);

    return {
      success: true,
      doc: newDoc,
      totalDocs: getAllClinicKnowledgeDocs({ ...clinic, working_hours: updatedWh }).length,
    };
  });

/**
 * Delete a custom RAG Knowledge document.
 */
export const deleteAiKnowledgeDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      id: z.string().min(1),
    }),
  )
  .handler(async ({ context, data }) => {
    const clinic = await getMyManagedClinic(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const currentWh =
      typeof clinic.working_hours === "object" && clinic.working_hours && !Array.isArray(clinic.working_hours)
        ? (clinic.working_hours as any)
        : {};

    const existingDocs: RagKnowledgeDoc[] = Array.isArray(currentWh.rag_knowledge_docs)
      ? currentWh.rag_knowledge_docs
      : [];

    const updatedDocs = existingDocs.filter((d) => d.id !== data.id);

    const updatedWh = {
      ...currentWh,
      rag_knowledge_docs: updatedDocs,
    };

    const { error } = await supabaseAdmin
      .from("clinics")
      .update({ working_hours: updatedWh } as any)
      .eq("id", clinic.id);

    if (error) throw new Error(error.message);

    return {
      success: true,
      id: data.id,
    };
  });

/**
 * Save Guardrail settings for the WhatsApp AI Assistant.
 */
export const saveGuardrailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      blockOffTopic: z.boolean(),
      maskConfidential: z.boolean(),
      disallowPrescriptions: z.boolean(),
      strictness: z.enum(["strict", "balanced"]),
      offTopicMessage: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const clinic = await getMyManagedClinic(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const currentWh =
      typeof clinic.working_hours === "object" && clinic.working_hours && !Array.isArray(clinic.working_hours)
        ? (clinic.working_hours as any)
        : {};

    const updatedWh = {
      ...currentWh,
      guardrail_settings: data,
    };

    const { error } = await supabaseAdmin
      .from("clinics")
      .update({ working_hours: updatedWh } as any)
      .eq("id", clinic.id);

    if (error) throw new Error(error.message);

    return {
      success: true,
      settings: data,
    };
  });

/**
 * Reset session memory for the simulator or specified phone.
 */
export const clearAiSessionMemoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      patientPhone: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const clinic = await getMyManagedClinic(context.supabase, context.userId);
    const phone = data.patientPhone?.trim() || "+919876543210";
    clearSessionMemory(clinic.id, phone);
    return { success: true };
  });
