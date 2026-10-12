import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "./admin-auth.functions";

export const crmLeadStageEnum = z.enum([
  "new",
  "outreach_sent",
  "demo_sent",
  "followup_1",
  "followup_2",
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
    }),
  )
  .handler(async ({ data }) => {
    const { createCrmLeadImpl } = await import("./crm.server");
    return createCrmLeadImpl(data);
  });

export const updateCrmLead = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(
    z.object({
      id: z.string(),
      status: crmLeadStageEnum.optional(),
      notes: z.string().max(1000).optional().nullable(),
      deal_value: z.number().optional(),
      clinic_name: z.string().max(120).optional().nullable(),
      specialty: z.string().max(80).optional().nullable(),
      city: z.string().max(80).optional().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const { updateCrmLeadImpl } = await import("./crm.server");
    return updateCrmLeadImpl(data);
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
    const demoUrl = data.demoUrl || buildDemoUrl({
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
 * Public Lead Capture Endpoint for Landing Page / Contact Page.
 * Captures doctors & clinic owners interested in ClinicX.
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
    const { createCrmLeadImpl, buildDemoUrl } = await import("./crm.server");
    const lead = await createCrmLeadImpl({
      name: data.name,
      phone: data.phone,
      clinic_name: data.clinic_name,
      city: data.city,
      specialty: data.specialty,
      primary_goal: data.primary_goal,
      source: data.source,
      deal_value: 999,
    });

    const demoUrl = buildDemoUrl({
      doctorName: data.name,
      clinicName: data.clinic_name,
      specialty: data.specialty,
      city: data.city,
    });

    return { ok: true, leadId: lead.id, demoUrl };
  });
