import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Admin authentication is handled entirely by Supabase Auth + the `user_roles`
// table (see admin.login.tsx, _admin/route.tsx and getAdminMe in
// admin-auth.functions.ts). The legacy loginAdmin/checkAdminSession/logoutAdmin
// server functions (custom SHA-256 + admin_sessions cookie) have been retired.

export const getAdminStats = createServerFn({ method: "GET" })
  .handler(async () => {
    const { getAdminStatsImpl } = await import("./admin.server");
    return getAdminStatsImpl();
  });

export const listAdminDoctors = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      search: z.string().optional(),
      plan: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().optional(),
    }).optional()
  )
  .handler(async ({ data: input }) => {
    const { listAdminDoctorsImpl } = await import("./admin.server");
    return listAdminDoctorsImpl(input);
  });

export const getDoctorDetails = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data: input }) => {
    const { getDoctorDetailsImpl } = await import("./admin.server");
    return getDoctorDetailsImpl(input);
  });

export const updateDoctorProfile = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      doctorName: z.string().optional(),
      clinicName: z.string().optional(),
      specialization: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      city: z.string().optional(),
      planId: z.string().nullable().optional(),
      status: z.string().optional(),
      periodEnd: z.string().nullable().optional(),
    })
  )
  .handler(async ({ data: input }) => {
    const { updateDoctorProfileImpl } = await import("./admin.server");
    return updateDoctorProfileImpl(input);
  });

export const changeDoctorPlan = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      clinicId: z.string(),
      planId: z.string(),
      extendDays: z.number().optional(),
      grantFreeMonth: z.boolean().optional(),
      cancelSub: z.boolean().optional(),
    })
  )
  .handler(async ({ data: input }) => {
    const { changeDoctorPlanImpl } = await import("./admin.server");
    return changeDoctorPlanImpl(input);
  });

export const issueRefund = createServerFn({ method: "POST" })
  .inputValidator(z.object({ clinicId: z.string(), amount: z.number(), reason: z.string() }))
  .handler(async ({ data: input }) => {
    const { issueRefundImpl } = await import("./admin.server");
    return issueRefundImpl(input);
  });

export const toggleDoctorSuspension = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string(), reason: z.string().optional() }))
  .handler(async ({ data: input }) => {
    const { toggleDoctorSuspensionImpl } = await import("./admin.server");
    return toggleDoctorSuspensionImpl(input);
  });

export const deleteDoctorAccount = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data: input }) => {
    const { deleteDoctorAccountImpl } = await import("./admin.server");
    return deleteDoctorAccountImpl(input);
  });

export const clearDoctorPatientsData = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data: input }) => {
    const { clearDoctorPatientsDataImpl } = await import("./admin.server");
    return clearDoctorPatientsDataImpl(input);
  });

export const listAdminSubscriptions = createServerFn({ method: "GET" })
  .handler(async () => {
    const { listAdminSubscriptionsImpl } = await import("./admin.server");
    return listAdminSubscriptionsImpl();
  });

export const getAdminPlans = createServerFn({ method: "GET" })
  .handler(async () => {
    const { getAdminPlansImpl } = await import("./admin.server");
    return getAdminPlansImpl();
  });

export const updatePlanDetails = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      monthlyPrice: z.number(),
      yearlyPrice: z.number(),
      features: z.array(z.string()),
      moduleIds: z.array(z.string()).optional(),
      discountedMonthlyPrice: z.number().nullable().optional(),
      discountedYearlyPrice: z.number().nullable().optional(),
    })
  )
  .handler(async ({ data: input }) => {
    const { updatePlanDetailsImpl } = await import("./admin.server");
    return updatePlanDetailsImpl(input);
  });

export const listCoupons = createServerFn({ method: "GET" })
  .handler(async () => {
    const { listCouponsImpl } = await import("./admin.server");
    return listCouponsImpl();
  });

export const createCoupon = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      code: z.string().toUpperCase(),
      discountType: z.enum(["percent", "fixed"]),
      discountValue: z.number().int().min(1),
      maxUses: z.number().int().min(1),
      expiresAt: z.string().optional(),
      applicablePlan: z.string().optional(),
      razorpayOfferId: z.string().optional(),
    })
  )
  .handler(async ({ data: input }) => {
    const { createCouponImpl } = await import("./admin.server");
    return createCouponImpl(input);
  });

export const toggleCouponActive = createServerFn({ method: "POST" })
  .inputValidator(z.object({ code: z.string(), active: z.boolean() }))
  .handler(async ({ data: input }) => {
    const { toggleCouponActiveImpl } = await import("./admin.server");
    return toggleCouponActiveImpl(input);
  });

export const listTransactions = createServerFn({ method: "GET" })
  .handler(async () => {
    const { listTransactionsImpl } = await import("./admin.server");
    return listTransactionsImpl();
  });

export const listFeatureFlags = createServerFn({ method: "GET" })
  .handler(async () => {
    const { listFeatureFlagsImpl } = await import("./admin.server");
    return listFeatureFlagsImpl();
  });

export const toggleFeatureFlag = createServerFn({ method: "POST" })
  .inputValidator(z.object({ key: z.string(), enabled: z.boolean() }))
  .handler(async ({ data: input }) => {
    const { toggleFeatureFlagImpl } = await import("./admin.server");
    return toggleFeatureFlagImpl(input);
  });

export const updateFeatureFlagOverrides = createServerFn({ method: "POST" })
  .inputValidator(z.object({ key: z.string(), plans: z.array(z.string()), doctorIds: z.array(z.string()) }))
  .handler(async ({ data: input }) => {
    const { updateFeatureFlagOverridesImpl } = await import("./admin.server");
    return updateFeatureFlagOverridesImpl(input);
  });

export const listAnnouncements = createServerFn({ method: "GET" })
  .handler(async () => {
    const { listAnnouncementsImpl } = await import("./admin.server");
    return listAnnouncementsImpl();
  });

export const createAnnouncement = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      title: z.string(),
      body: z.string(),
      type: z.enum(["info", "warning", "success", "maintenance"]),
      targetPlans: z.array(z.string()),
    })
  )
  .handler(async ({ data: input }) => {
    const { createAnnouncementImpl } = await import("./admin.server");
    return createAnnouncementImpl(input);
  });

export const toggleAnnouncementActive = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string(), active: z.boolean() }))
  .handler(async ({ data: input }) => {
    const { toggleAnnouncementActiveImpl } = await import("./admin.server");
    return toggleAnnouncementActiveImpl(input);
  });

export const listEmailCampaigns = createServerFn({ method: "GET" })
  .handler(async () => {
    const { listEmailCampaignsImpl } = await import("./admin.server");
    return listEmailCampaignsImpl();
  });

export const createEmailCampaign = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string(),
      subject: z.string(),
      bodyHtml: z.string(),
      targetSegment: z.string(),
      status: z.enum(["draft", "sent"]),
    })
  )
  .handler(async ({ data: input }) => {
    const { createEmailCampaignImpl } = await import("./admin.server");
    return createEmailCampaignImpl(input);
  });

export const getDatabaseStats = createServerFn({ method: "GET" })
  .handler(async () => {
    const { getDatabaseStatsImpl } = await import("./admin.server");
    return getDatabaseStatsImpl();
  });

export const runDatabaseCleanup = createServerFn({ method: "POST" })
  .inputValidator(z.object({ tool: z.enum(["unverified", "sessions", "archive"]) }))
  .handler(async ({ data: input }) => {
    const { runDatabaseCleanupImpl } = await import("./admin.server");
    return runDatabaseCleanupImpl(input);
  });

export const listSupportTickets = createServerFn({ method: "GET" })
  .handler(async () => {
    const { listSupportTicketsImpl } = await import("./admin.server");
    return listSupportTicketsImpl();
  });

export const getSupportTicket = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data: input }) => {
    const { getSupportTicketImpl } = await import("./admin.server");
    return getSupportTicketImpl(input);
  });

export const replySupportTicket = createServerFn({ method: "POST" })
  .inputValidator(z.object({ ticketId: z.string(), body: z.string() }))
  .handler(async ({ data: input }) => {
    const { replySupportTicketImpl } = await import("./admin.server");
    return replySupportTicketImpl(input);
  });

export const updateTicketStatus = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string(), status: z.string(), priority: z.string() }))
  .handler(async ({ data: input }) => {
    const { updateTicketStatusImpl } = await import("./admin.server");
    return updateTicketStatusImpl(input);
  });

export const listAuditLogs = createServerFn({ method: "GET" })
  .handler(async () => {
    const { listAuditLogsImpl } = await import("./admin.server");
    return listAuditLogsImpl();
  });

export const listAdminUsers = createServerFn({ method: "GET" })
  .handler(async () => {
    const { listAdminUsersImpl } = await import("./admin.server");
    return listAdminUsersImpl();
  });

// Grants an admin role (super_admin | support) to an EXISTING ClinicX account,
// identified by email. Admins are ordinary Supabase Auth users flagged in
// user_roles — there is no separate password to set here.
export const createAdminUser = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email(), role: z.enum(["super_admin", "support"]) }))
  .handler(async ({ data: input }) => {
    const { createAdminUserImpl } = await import("./admin.server");
    return createAdminUserImpl(input);
  });

export const deleteAdminUser = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data: input }) => {
    const { deleteAdminUserImpl } = await import("./admin.server");
    return deleteAdminUserImpl(input);
  });

export const getSystemSettings = createServerFn({ method: "GET" })
  .handler(async () => {
    const { getSystemSettingsImpl } = await import("./admin.server");
    return getSystemSettingsImpl();
  });

export const saveSystemSettings = createServerFn({ method: "POST" })
  .inputValidator(z.record(z.string(), z.string()))
  .handler(async ({ data: input }) => {
    const { saveSystemSettingsImpl } = await import("./admin.server");
    return saveSystemSettingsImpl(input);
  });

export const testIntegration = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    provider: z.enum(["wati", "razorpay", "openai"]),
    settings: z.record(z.string(), z.string()),
  }))
  .handler(async ({ data: input }) => {
    const { testIntegrationImpl } = await import("./admin.server");
    return testIntegrationImpl(input);
  });

// -------- Extended actions --------
export const impersonateDoctor = createServerFn({ method: "POST" })
  .inputValidator(z.object({ clinicId: z.string() }))
  .handler(async ({ data: input }) => {
    const { impersonateDoctorImpl } = await import("./admin.server");
    return impersonateDoctorImpl(input);
  });

export const resetDoctorPassword = createServerFn({ method: "POST" })
  .inputValidator(z.object({ clinicId: z.string(), password: z.string().optional() }))
  .handler(async ({ data: input }) => {
    const { resetDoctorPasswordImpl } = await import("./admin.server");
    return resetDoctorPasswordImpl(input);
  });

export const toggleClinicPublish = createServerFn({ method: "POST" })
  .inputValidator(z.object({ clinicId: z.string() }))
  .handler(async ({ data: input }) => {
    const { toggleClinicPublishImpl } = await import("./admin.server");
    return toggleClinicPublishImpl(input);
  });

export const updateSubscriptionStatus = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string(), action: z.enum(["cancel", "reactivate", "mark_expired"]) }))
  .handler(async ({ data: input }) => {
    const { updateSubscriptionStatusImpl } = await import("./admin.server");
    return updateSubscriptionStatusImpl(input);
  });

export const deleteCoupon = createServerFn({ method: "POST" })
  .inputValidator(z.object({ code: z.string() }))
  .handler(async ({ data: input }) => {
    const { deleteCouponImpl } = await import("./admin.server");
    return deleteCouponImpl(input);
  });

export const createPlan = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      slug: z.string().min(2),
      name: z.string().min(2),
      monthlyPrice: z.number().int().min(0),
      yearlyPrice: z.number().int().min(0),
      features: z.array(z.string()).optional(),
      sortOrder: z.number().int().optional(),
    })
  )
  .handler(async ({ data: input }) => {
    const { createPlanImpl } = await import("./admin.server");
    return createPlanImpl(input);
  });

export const deletePlan = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data: input }) => {
    const { deletePlanImpl } = await import("./admin.server");
    return deletePlanImpl(input);
  });

export const checkMaintenanceStatus = createServerFn({ method: "GET" })
  .handler(async () => {
    const settings = {
      maintenance_mode: "false",
      maintenance_message: "We're upgrading the platform. Back in 2 hours.",
      platform_name: "ClinicX",
      support_email: "support@clinicx.in"
    };

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("system_settings")
        .select("key, value")
        .in("key", ["maintenance_mode", "maintenance_message", "platform_name", "support_email"]);

      if (error) {
        console.error("[checkMaintenanceStatus] Error fetching system settings:", error.message);
        return settings;
      }

      (data ?? []).forEach((row: any) => {
        if (row.key === "maintenance_mode") settings.maintenance_mode = row.value;
        if (row.key === "maintenance_message") settings.maintenance_message = row.value;
        if (row.key === "platform_name") settings.platform_name = row.value;
        if (row.key === "support_email") settings.support_email = row.value;
      });
    } catch (err) {
      console.error("[checkMaintenanceStatus] Failed to load maintenance status:", err);
    }

    return settings;
  });

export const listModuleControls = createServerFn({ method: "POST" })
  .inputValidator(z.object({ orgId: z.string().uuid().optional(), search: z.string().max(100).optional() }))
  .handler(async ({ data }) => {
    const { listModuleControlsImpl } = await import("./admin.server");
    return listModuleControlsImpl(data);
  });

export const setModuleGlobal = createServerFn({ method: "POST" })
  .inputValidator(z.object({ moduleId: z.string().min(1), enabled: z.boolean() }))
  .handler(async ({ data }) => {
    const { setModuleGlobalImpl } = await import("./admin.server");
    return setModuleGlobalImpl(data);
  });

export const setOrgModuleOverride = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({ orgId: z.string().uuid(), moduleId: z.string().min(1), state: z.enum(["on", "off", "default"]) }),
  )
  .handler(async ({ data }) => {
    const { setOrgModuleOverrideImpl } = await import("./admin.server");
    return setOrgModuleOverrideImpl(data);
  });
