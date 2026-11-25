/**
 * @module gbp.functions
 * @description TanStack Start server functions for Google Business Profile Management & Automation.
 *
 * All functions validate input with Zod and enforce user authentication & clinic ownership.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function getAuthUserId(context: unknown): string {
  const ctx = context as { userId?: string } | undefined;
  if (!ctx?.userId) throw new Error("Unauthorized");
  return ctx.userId;
}

// ============================================================================
// 1. Integration Readiness & OAuth
// ============================================================================

export const getGbpReadinessStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ clinic_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const userId = getAuthUserId(context);
    const { getGbpReadiness } = await import("@/lib/gbp.server");
    return await getGbpReadiness(data.clinic_id, userId);
  });

export const getGbpOAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        clinic_id: z.string().uuid(),
        organization_id: z.string().uuid().optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const userId = getAuthUserId(context);
    const { generateGoogleOAuthUrl } = await import("@/lib/gbp.server");
    const url = await generateGoogleOAuthUrl(data.clinic_id, userId, data.organization_id);
    return { url };
  });

export const getGbpCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        clinic_id: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const userId = getAuthUserId(context);
    const { getGoogleOAuthConfigForClient } = await import("@/lib/gbp.server");
    return await getGoogleOAuthConfigForClient(data.clinic_id, userId);
  });

export const saveGbpCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        clinic_id: z.string().uuid(),
        google_client_id: z.string().trim(),
        google_client_secret: z.string().trim().optional(),
        google_maps_api_key: z.string().trim().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const userId = getAuthUserId(context);
    const { saveGoogleOAuthConfig } = await import("@/lib/gbp.server");
    return await saveGoogleOAuthConfig(data.clinic_id, userId, {
      clientId: data.google_client_id,
      clientSecret: data.google_client_secret,
      mapsApiKey: data.google_maps_api_key,
    });
  });

export const disconnectGbpAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ clinic_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const userId = getAuthUserId(context);
    const { disconnectGoogleProfile } = await import("@/lib/gbp.server");
    return await disconnectGoogleProfile(data.clinic_id, userId);
  });

// ============================================================================
// 2. AI SEO Profile Optimizer
// ============================================================================

export const generateGbpSeoOptimization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        clinic_id: z.string().uuid(),
        focus_keywords: z.string().max(300).optional().nullable(),
        tone: z.string().max(80).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const userId = getAuthUserId(context);
    const { generateSeoProfileOptimization } = await import("@/lib/gbp.server");
    return await generateSeoProfileOptimization({
      clinicId: data.clinic_id,
      userId,
      focusKeywords: data.focus_keywords,
      tone: data.tone,
    });
  });

// ============================================================================
// 3. Review Growth Manager
// ============================================================================

export const getReviewGrowthLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ clinic_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const userId = getAuthUserId(context);
    const { assertClinicAccess, buildClinicReviewLinks } = await import("@/lib/gbp.server");
    const clinic = await assertClinicAccess(data.clinic_id, userId);
    return buildClinicReviewLinks({
      placeId: clinic.google_place_id,
      slug: clinic.slug,
      clinicName: clinic.clinic_name,
    });
  });

export const sendPatientReviewRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        clinic_id: z.string().uuid(),
        patient_name: z.string().trim().min(1).max(100),
        phone: z.string().trim().min(10).max(20),
        patient_id: z.string().uuid().optional().nullable(),
        appointment_id: z.string().uuid().optional().nullable(),
        custom_message: z.string().max(500).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const userId = getAuthUserId(context);
    const { createAndSendReviewRequest } = await import("@/lib/gbp.server");
    return await createAndSendReviewRequest({
      clinicId: data.clinic_id,
      userId,
      patientName: data.patient_name,
      phone: data.phone,
      patientId: data.patient_id,
      appointmentId: data.appointment_id,
      customMessage: data.custom_message,
    });
  });

export const listReviewRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ clinic_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const userId = getAuthUserId(context);
    const { assertClinicAccess } = await import("@/lib/gbp.server");
    await assertClinicAccess(data.clinic_id, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("review_requests")
      .select("*")
      .eq("clinic_id", data.clinic_id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return rows || [];
  });

export const trackReviewClick = createServerFn({ method: "POST" })
  .validator((i: unknown) => z.object({ request_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { enforcePolicy, callerIp } = await import("./scale.server");
    await enforcePolicy("consult_ip", `${await callerIp()}:${data.request_id}`);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("review_requests")
      .select("id, click_count")
      .eq("id", data.request_id)
      .maybeSingle();

    if (row) {
      await supabaseAdmin
        .from("review_requests")
        .update({
          click_count: (row.click_count || 0) + 1,
          last_clicked_at: new Date().toISOString(),
          status: "clicked",
        } as never)
        .eq("id", data.request_id);
    }
    return { ok: true };
  });

// ============================================================================
// 4. AI Review Management & Responses
// ============================================================================

export const generateAiReviewReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        clinic_id: z.string().uuid(),
        reviewer_name: z.string().trim().max(100),
        rating: z.number().int().min(1).max(5),
        comment: z.string().max(2000).optional().nullable(),
        doctor_name: z.string().max(100).optional().nullable(),
        clinic_name: z.string().max(150).optional().nullable(),
        tone: z.string().max(80).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const userId = getAuthUserId(context);
    const { assertClinicAccess, generateSmartReviewReply } = await import("@/lib/gbp.server");
    await assertClinicAccess(data.clinic_id, userId);

    return await generateSmartReviewReply({
      clinicId: data.clinic_id,
      reviewerName: data.reviewer_name,
      rating: data.rating,
      comment: data.comment,
      doctorName: data.doctor_name,
      clinicName: data.clinic_name,
      tone: data.tone,
    });
  });

export const publishReviewReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        clinic_id: z.string().uuid(),
        review_id: z.string().uuid(),
        reply_text: z.string().trim().min(2).max(2000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const userId = getAuthUserId(context);
    const { publishReviewReplyToGoogle } = await import("@/lib/gbp.server");
    return await publishReviewReplyToGoogle({
      clinicId: data.clinic_id,
      userId,
      reviewId: data.review_id,
      replyText: data.reply_text,
    });
  });

// ============================================================================
// 5. Daily AI SEO Posts
// ============================================================================

export const generateGbpDailyPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        clinic_id: z.string().uuid(),
        post_type: z.enum(["STANDARD", "OFFER", "EVENT"]),
        custom_topic: z.string().max(300).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const userId = getAuthUserId(context);
    const { generateDailyGmbPostAi } = await import("@/lib/gbp.server");
    return await generateDailyGmbPostAi({
      clinicId: data.clinic_id,
      userId,
      postType: data.post_type,
      customTopic: data.custom_topic,
    });
  });

export const saveGbpPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        clinic_id: z.string().uuid(),
        post_type: z.enum(["STANDARD", "OFFER", "EVENT"]),
        title: z.string().max(200).optional().nullable(),
        summary: z.string().min(5).max(1500),
        call_to_action: z.record(z.unknown()).optional(),
        event_data: z.record(z.unknown()).optional(),
        offer_data: z.record(z.unknown()).optional(),
        media_urls: z.array(z.string().url()).optional(),
        hashtags: z.array(z.string()).optional(),
        scheduled_at: z.string().datetime().optional().nullable(),
        status: z.enum(["draft", "scheduled", "published"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const userId = getAuthUserId(context);
    const { createGbpPostRecord } = await import("@/lib/gbp.server");
    return await createGbpPostRecord({
      clinicId: data.clinic_id,
      userId,
      postType: data.post_type,
      title: data.title,
      summary: data.summary,
      callToAction: data.call_to_action,
      eventData: data.event_data,
      offerData: data.offer_data,
      mediaUrls: data.media_urls,
      hashtags: data.hashtags,
      scheduledAt: data.scheduled_at,
      status: data.status,
    });
  });

export const listGbpPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ clinic_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const userId = getAuthUserId(context);
    const { assertClinicAccess } = await import("@/lib/gbp.server");
    await assertClinicAccess(data.clinic_id, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("gbp_posts")
      .select("*")
      .eq("clinic_id", data.clinic_id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return rows || [];
  });

// ============================================================================
// 6. AI Photo Scheduler
// ============================================================================

export const getGbpPhotoScheduler = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ clinic_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const userId = getAuthUserId(context);
    const { getPhotoSchedulerIdeas } = await import("@/lib/gbp.server");
    return await getPhotoSchedulerIdeas(data.clinic_id, userId);
  });

// ============================================================================
// 7. Performance Analytics
// ============================================================================

export const getGbpAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        clinic_id: z.string().uuid(),
        period: z.enum(["7d", "30d", "90d"]).optional().default("30d"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const userId = getAuthUserId(context);
    const { getGbpPerformanceReport } = await import("@/lib/gbp.server");
    return await getGbpPerformanceReport(data.clinic_id, userId, data.period);
  });

// ============================================================================
// 8. Background Jobs
// ============================================================================

export const triggerGbpBackgroundJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ clinic_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const userId = getAuthUserId(context);
    const { assertClinicAccess, executeGbpScheduledJobs } = await import("@/lib/gbp.server");
    await assertClinicAccess(data.clinic_id, userId);
    return await executeGbpScheduledJobs();
  });
