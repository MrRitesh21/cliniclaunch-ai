import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "./admin-auth.functions";

// ==========================================
// Public Referral Endpoints (Allowlisted)
// ==========================================

export const getPublicReferralInfo = createServerFn({ method: "GET" })
  .validator(z.object({ code: z.string() }))
  .handler(async ({ data }) => {
    const { getPublicReferralInfoImpl } = await import("./referral.server");
    return getPublicReferralInfoImpl(data.code);
  });

export const trackReferralClick = createServerFn({ method: "POST" })
  .validator(
    z.object({
      code: z.string(),
      userAgent: z.string().optional(),
      referrer: z.string().optional(),
      landingPage: z.string().optional(),
      visitorId: z.string().optional(),
      sessionId: z.string().optional(),
    })
  )
  .handler(async ({ data }) => {
    const { recordReferralClickImpl } = await import("./referral.server");
    return recordReferralClickImpl(data);
  });

export const trackReferralSignup = createServerFn({ method: "POST" })
  .validator(
    z.object({
      referralCode: z.string(),
      email: z.string().email(),
      fullName: z.string().optional().nullable(),
      userId: z.string().optional().nullable(),
    })
  )
  .handler(async ({ data }) => {
    const { recordReferralConversionImpl } = await import("./referral.server");
    return recordReferralConversionImpl(data);
  });

export const linkReferralOnboarding = createServerFn({ method: "POST" })
  .validator(
    z.object({
      referralCode: z.string().optional().nullable(),
      userId: z.string(),
      clinicId: z.string(),
      clinicName: z.string(),
      organizationId: z.string(),
    })
  )
  .handler(async ({ data }) => {
    const { linkReferralOnboardingImpl } = await import("./referral.server");
    return linkReferralOnboardingImpl(data);
  });

// ==========================================
// Admin Referral Endpoints (Guarded)
// ==========================================

export const listReferralCreators = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .validator(
    z
      .object({
        search: z.string().optional(),
        status: z.string().optional(),
      })
      .optional()
  )
  .handler(async ({ data }) => {
    const { listReferralCreatorsImpl } = await import("./referral.server");
    return listReferralCreatorsImpl(data);
  });

export const getReferralStats = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async () => {
    const { getReferralStatsImpl } = await import("./referral.server");
    return getReferralStatsImpl();
  });

export const createReferralCreator = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(
    z.object({
      code: z.string().min(2).max(40),
      creator_name: z.string().min(1).max(120),
      creator_phone: z.string().optional().nullable(),
      creator_email: z.string().optional().nullable(),
      instagram_handle: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      trial_days: z.number().int().min(1).max(90).default(14),
    })
  )
  .handler(async ({ data }) => {
    const { createReferralCreatorImpl } = await import("./referral.server");
    return createReferralCreatorImpl(data);
  });

export const updateReferralCreator = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(
    z.object({
      id: z.string(),
      code: z.string().min(2).max(40).optional(),
      creator_name: z.string().min(1).max(120).optional(),
      creator_phone: z.string().optional().nullable(),
      creator_email: z.string().optional().nullable(),
      instagram_handle: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      trial_days: z.number().int().min(1).max(90).optional(),
      status: z.enum(["active", "paused", "archived"]).optional(),
    })
  )
  .handler(async ({ data }) => {
    const { updateReferralCreatorImpl } = await import("./referral.server");
    return updateReferralCreatorImpl(data.id, data);
  });

export const deleteReferralCreator = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { deleteReferralCreatorImpl } = await import("./referral.server");
    return deleteReferralCreatorImpl(data.id);
  });

export const listReferralConversions = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .validator(z.object({ limit: z.number().optional() }).optional())
  .handler(async ({ data }) => {
    const { listReferralConversionsImpl } = await import("./referral.server");
    return listReferralConversionsImpl(data?.limit ?? 100);
  });

export const listReferralClicks = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .validator(z.object({ limit: z.number().optional() }).optional())
  .handler(async ({ data }) => {
    const { listReferralClicksImpl } = await import("./referral.server");
    return listReferralClicksImpl(data?.limit ?? 100);
  });
