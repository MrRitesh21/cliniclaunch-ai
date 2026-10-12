import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "./admin-auth.functions";

export const crmLeadStageEnum = z.enum([
  "new",
  "outreach_sent",
  "demo_sent",
  "followup_1",
  "followup_2",
  "in_conversation",
  "converted",
  "lost",
]);

export const listCrmLeads = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .validator(
    z
      .object({
        search: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().optional(),
      })
      .optional(),
  )
  .handler(async ({ data }) => {
    const { listCrmLeadsImpl } = await import("./crm.server");
    return listCrmLeadsImpl(data);
  });

export const getCrmStats = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async () => {
    const { getCrmStatsImpl } = await import("./crm.server");
    return getCrmStatsImpl();
  });

export const createCrmLead = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(
    z.object({
      name: z.string().min(2).max(100),
      phone: z.string().min(8).max(20),
      email: z.string().email().optional().or(z.literal("")),
      clinic_name: z.string().max(120).optional().or(z.literal("")),
      city: z.string().max(80).optional().or(z.literal("")),
      specialty: z.string().max(80).optional().or(z.literal("")),
      primary_goal: z.string().max(200).optional().or(z.literal("")),
      source: z.string().default("manual"),
      notes: z.string().max(1000).optional().or(z.literal("")),
      deal_value: z.number().optional(),
      autonomous_enabled: z.boolean().optional(),
      trigger_outreach_now: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { createCrmLeadImpl, triggerAutonomousLeadOutreachImpl } = await import("./crm.server");
    const lead = await createCrmLeadImpl(data);
    if (data.trigger_outreach_now) {
      triggerAutonomousLeadOutreachImpl(lead.id).catch((err) => {
        console.warn("[CRM] Autonomous outreach trigger on manual lead creation failed:", err);
      });
    }
    return lead;
  });

export const updateCrmLead = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(
    z.object({
      id: z.string(),
      name: z.string().min(2).optional(),
      phone: z.string().min(8).optional(),
      email: z.string().email().optional().nullable().or(z.literal("")),
      status: crmLeadStageEnum.optional(),
      notes: z.string().max(1000).optional().nullable(),
      deal_value: z.number().optional(),
      clinic_name: z.string().max(120).optional().nullable(),
      specialty: z.string().max(80).optional().nullable(),
      city: z.string().max(80).optional().nullable(),
      autonomous_enabled: z.boolean().optional(),
      has_replied: z.boolean().optional(),
      last_reply_message: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const { updateCrmLeadImpl } = await import("./crm.server");
    return updateCrmLeadImpl(data);
  });

export const getPlatformAiAgentSettings = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async () => {
    const { getPlatformAiConfig } = await import("./platform-ai-agent.server");
    return getPlatformAiConfig();
  });

export const updatePlatformAiAgentSettings = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(
    z.object({
      enabled: z.boolean().optional(),
      agent_name: z.string().min(1).optional(),
      agent_role: z.string().optional(),
      system_prompt: z.string().min(10).optional(),
      auto_reply_enabled: z.boolean().optional(),
      auto_capture_leads: z.boolean().optional(),
      model_provider: z.string().optional(),
      model: z.string().optional(),
      temperature: z.number().min(0).max(1).optional(),
      pricing_info: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { savePlatformAiConfig } = await import("./platform-ai-agent.server");
    return savePlatformAiConfig(data);
  });

export const deleteCrmLead = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { deleteCrmLeadImpl } = await import("./crm.server");
    return deleteCrmLeadImpl(data.id);
  });

export const generateCrmPitch = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(
    z.object({
      doctorName: z.string(),
      clinicName: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      specialty: z.string().optional().nullable(),
      tone: z.enum([
        "app_store_comprehensive",
        "hourly_followup_1",
        "hourly_followup_2",
        "hourly_followup_3",
        "hourly_followup_4",
        "warm_intro",
        "demo_delivery",
        "opd_problem_solver",
        "followup_1",
        "followup_2",
        "closing_offer",
      ]),
      demoUrl: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const { generateFounderPitch, buildDemoUrl } = await import("./crm.server");
    const demoUrl =
      data.demoUrl ||
      buildDemoUrl({
        doctorName: data.doctorName,
        clinicName: data.clinicName,
        specialty: data.specialty,
        city: data.city,
      });
    const pitch = generateFounderPitch({ ...data, demoUrl });
    return { pitch, demoUrl };
  });

export const sendCrmOutreach = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(
    z.object({
      leadId: z.string(),
      phone: z.string(),
      message: z.string().min(1),
      newStatus: crmLeadStageEnum.optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { sendCrmOutreachWhatsappImpl } = await import("./crm.server");
    return sendCrmOutreachWhatsappImpl(data);
  });

/**
 * Bulk imports leads from CSV and triggers autonomous paced outreach.
 */
export const importCrmLeadsCsv = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(
    z.object({
      csvText: z.string().min(5),
      startAutonomousOutreach: z.boolean().default(true),
    }),
  )
  .handler(async ({ data }) => {
    const { importCrmLeadsCsvImpl } = await import("./crm.server");
    return importCrmLeadsCsvImpl(data);
  });

/**
 * Triggers autonomous outreach immediately for a single lead.
 */
export const triggerLeadOutreach = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(z.object({ leadId: z.string() }))
  .handler(async ({ data }) => {
    const { triggerAutonomousLeadOutreachImpl } = await import("./crm.server");
    return triggerAutonomousLeadOutreachImpl(data.leadId);
  });

/**
 * Runs due hourly follow-up drips for leads that have not replied yet.
 */
export const runAutonomousBatch = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .handler(async () => {
    const { runAutonomousOutreachBatchImpl } = await import("./crm.server");
    return runAutonomousOutreachBatchImpl();
  });

/**
 * Public Lead Capture Endpoint for Landing Page / Contact Page.
 * Captures doctors & clinic owners interested in ClinicX.
 * Automatically initiates autonomous WhatsApp outreach.
 */
export const publicLeadCaptureSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  phone: z.string().trim().min(8, "Valid phone number is required").max(20),
  clinic_name: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  specialty: z.string().trim().max(80).optional().or(z.literal("")),
  primary_goal: z.string().trim().max(200).optional().or(z.literal("")),
  source: z.string().default("landing_page"),
});

export const submitPlatformLead = createServerFn({ method: "POST" })
  .validator((input: unknown) => publicLeadCaptureSchema.parse(input))
  .handler(async ({ data }) => {
    const { createCrmLeadImpl, buildDemoUrl, triggerAutonomousLeadOutreachImpl } = await import("./crm.server");
    const lead = await createCrmLeadImpl({
      name: data.name,
      phone: data.phone,
      clinic_name: data.clinic_name,
      city: data.city,
      specialty: data.specialty,
      primary_goal: data.primary_goal,
      source: data.source,
      deal_value: 999,
      autonomous_enabled: true,
    });

    const demoUrl = buildDemoUrl({
      doctorName: data.name,
      clinicName: data.clinic_name,
      specialty: data.specialty,
      city: data.city,
    });

    // Autonomous outreach trigger: Ritesh Human AI sends comprehensive App Store pitch immediately
    triggerAutonomousLeadOutreachImpl(lead.id).catch((err) => {
      console.warn("[CRM] Autonomous outreach trigger on public lead failed:", err);
    });

    return { ok: true, leadId: lead.id, demoUrl };
  });
