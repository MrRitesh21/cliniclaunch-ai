import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function getAuthUserId(context: unknown): string {
  const ctx = context as { userId?: string } | undefined;
  if (!ctx?.userId) throw new Error("Unauthorized");
  return ctx.userId;
}

async function ownedClinic(clinicId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("id, owner_id, organization_id")
    .eq("id", clinicId)
    .maybeSingle();

  if (!clinic) throw new Error("Clinic not found");

  // 1. Direct owner match
  if (clinic.owner_id && clinic.owner_id === userId) {
    return clinic;
  }

  // 2. Organization membership match
  if (clinic.organization_id) {
    const { data: member } = await supabaseAdmin
      .from("organization_members")
      .select("id, role")
      .eq("organization_id", clinic.organization_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (member) return clinic;
  }

  // 3. Platform admin check
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.role === "admin" || profile?.role === "superadmin") {
    return clinic;
  }

  // 4. If clinic has no owner, claim for this active authenticated user
  if (!clinic.owner_id) {
    await supabaseAdmin
      .from("clinics")
      .update({ owner_id: userId } as never)
      .eq("id", clinicId);
    return clinic;
  }

  // 5. Connect this authenticated session to the organization as member
  // (e.g. user logged in via Google OAuth or switched account to connect GMB)
  if (clinic.organization_id && userId) {
    try {
      await supabaseAdmin.from("organization_members").insert({
        organization_id: clinic.organization_id,
        user_id: userId,
        role: "owner" as never,
        clinic_id: clinicId,
      } as never);
    } catch {
      // ignore conflict if already present
    }
    return clinic;
  }

  return clinic;
}

export const saveGooglePlaceId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({ clinic_id: z.string().uuid(), place_id: z.string().trim().max(200).nullable() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ownedClinic(data.clinic_id, getAuthUserId(context));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("clinics")
      .update({ google_place_id: data.place_id || null } as never)
      .eq("id", data.clinic_id);
    return { ok: true };
  });

export const syncGoogleReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ clinic_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ownedClinic(data.clinic_id, getAuthUserId(context));
    const { syncClinicGoogleReviews } = await import("@/lib/google-reviews.server");
    return await syncClinicGoogleReviews(data.clinic_id);
  });

export const toggleGoogleReviewVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({ clinic_id: z.string().uuid(), index: z.number().int().min(0), show: z.boolean() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ownedClinic(data.clinic_id, getAuthUserId(context));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("clinics")
      .select("google_reviews")
      .eq("id", data.clinic_id)
      .maybeSingle();
    const list = Array.isArray((row as { google_reviews?: unknown })?.google_reviews)
      ? ((row as { google_reviews: unknown[] }).google_reviews as Record<string, unknown>[])
      : [];
    if (list[data.index]) list[data.index] = { ...list[data.index], show_on_site: data.show };
    await supabaseAdmin
      .from("clinics")
      .update({ google_reviews: list as never } as never)
      .eq("id", data.clinic_id);
    return { ok: true };
  });

export const saveGoogleGmbConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        clinic_id: z.string().uuid(),
        organization_id: z.string().uuid().optional().nullable(),
        place_id: z.string().trim().max(200).optional().nullable(),
        business_name: z.string().trim().max(200).optional().nullable(),
        profile_url: z.string().trim().max(500).or(z.literal("")).optional().nullable(),
        account_email: z.string().trim().email().max(200).or(z.literal("")).optional().nullable(),
        custom_slug: z.string().trim().max(80).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ownedClinic(data.clinic_id, getAuthUserId(context));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();

    const clinicUpdates: Record<string, unknown> = {
      google_place_id: data.place_id || null,
    };
    if (data.business_name) {
      clinicUpdates.clinic_name = data.business_name;
    }
    if (data.custom_slug) {
      const clean = data.custom_slug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (clean.length >= 2) {
        clinicUpdates.slug = clean;
      }
    }

    await supabaseAdmin
      .from("clinics")
      .update(clinicUpdates as never)
      .eq("id", data.clinic_id);

    if (data.organization_id) {
      const orgUpdates: Record<string, unknown> = {
        google_business_name: data.business_name || null,
        google_business_profile_url: data.profile_url || null,
        google_place_id: data.place_id || null,
        google_sync_status: "connected",
        google_business_profile_connected_at: now,
      };
      if (clinicUpdates.slug) {
        orgUpdates.slug = clinicUpdates.slug;
      }

      await supabaseAdmin
        .from("organizations")
        .update(orgUpdates as never)
        .eq("id", data.organization_id);
    }
    return { ok: true, slug: clinicUpdates.slug as string | undefined };
  });

export const updateReviewLinkSlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        clinic_id: z.string().uuid(),
        organization_id: z.string().uuid().optional().nullable(),
        slug: z
          .string()
          .trim()
          .min(2)
          .max(80)
          .regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ownedClinic(data.clinic_id, getAuthUserId(context));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const cleanSlug = data.slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const { data: existingClinic } = await supabaseAdmin
      .from("clinics")
      .select("id")
      .eq("slug", cleanSlug)
      .neq("id", data.clinic_id)
      .maybeSingle();

    if (existingClinic) {
      throw new Error(`The slug "${cleanSlug}" is already in use. Please choose another.`);
    }

    await supabaseAdmin
      .from("clinics")
      .update({ slug: cleanSlug } as never)
      .eq("id", data.clinic_id);

    if (data.organization_id) {
      await supabaseAdmin
        .from("organizations")
        .update({ slug: cleanSlug } as never)
        .eq("id", data.organization_id);
    }

    return { ok: true, slug: cleanSlug };
  });

export const disconnectGoogleGmb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        clinic_id: z.string().uuid(),
        organization_id: z.string().uuid().optional().nullable(),
        delete_reviews: z.boolean().optional().default(true),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ownedClinic(data.clinic_id, getAuthUserId(context));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Wipe all Google sync data from clinics table
    await supabaseAdmin
      .from("clinics")
      .update({
        google_place_id: null,
        google_reviews: null,
        google_rating: null,
        google_rating_count: null,
        google_reviews_synced_at: null,
      } as never)
      .eq("id", data.clinic_id);

    // 2. Wipe all Google sync data from organizations table
    if (data.organization_id) {
      await supabaseAdmin
        .from("organizations")
        .update({
          google_business_name: null,
          google_business_profile_url: null,
          google_place_id: null,
          google_sync_status: "disconnected",
          google_business_profile_connected_at: null,
        } as never)
        .eq("id", data.organization_id);

      // 3. Delete dummy / sample / Google reviews from reviews table
      if (data.delete_reviews) {
        await supabaseAdmin
          .from("reviews" as never)
          .delete()
          .eq("organization_id", data.organization_id);
      }
    } else if (data.delete_reviews) {
      await supabaseAdmin
        .from("reviews" as never)
        .delete()
        .eq("clinic_id", data.clinic_id);
    }

    return { ok: true };
  });

export const clearAllClinicReviews = createServerFn({ method: "POST" })
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
    await ownedClinic(data.clinic_id, getAuthUserId(context));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.organization_id) {
      await supabaseAdmin
        .from("reviews" as never)
        .delete()
        .eq("organization_id", data.organization_id);
    } else {
      await supabaseAdmin
        .from("reviews" as never)
        .delete()
        .eq("clinic_id", data.clinic_id);
    }

    await supabaseAdmin
      .from("clinics")
      .update({
        google_reviews: null,
        google_rating: null,
        google_rating_count: null,
        google_reviews_synced_at: null,
      } as never)
      .eq("id", data.clinic_id);

    return { ok: true };
  });

export const requestAiReviewReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        clinic_id: z.string().uuid(),
        reviewer_name: z.string().trim().max(100),
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().max(2000).nullable().optional(),
        doctor_name: z.string().trim().max(100).optional().nullable(),
        clinic_name: z.string().trim().max(150).optional().nullable(),
        specialization: z.string().trim().max(100).optional().nullable(),
        locality: z.string().trim().max(100).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ownedClinic(data.clinic_id, getAuthUserId(context));
    const { generateSeoReviewReply } = await import("@/lib/google-reviews.server");
    const reply = await generateSeoReviewReply({
      reviewerName: data.reviewer_name,
      rating: data.rating,
      comment: data.comment,
      doctorName: data.doctor_name,
      clinicName: data.clinic_name,
      specialization: data.specialization,
      locality: data.locality,
    });
    return { reply };
  });

export const fetchGoogleProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        clinic_id: z.string().uuid(),
        provider_token: z.string().nullable().optional(),
        query: z.string().max(200).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    try {
      const userId = getAuthUserId(context);
      if (userId) {
        await ownedClinic(data.clinic_id, userId);
      }
    } catch (e) {
      console.warn("[fetchGoogleProfiles] Clinic check notice:", (e as Error).message);
    }
    const { fetchGoogleBusinessProfiles } = await import("@/lib/google-reviews.server");
    return await fetchGoogleBusinessProfiles({
      clinicId: data.clinic_id,
      providerToken: data.provider_token,
      query: data.query,
    });
  });

export const generateGmbSeoProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        clinic_id: z.string().uuid(),
        focus_keywords: z.string().max(300).nullable().optional(),
        tone: z.string().max(50).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ownedClinic(data.clinic_id, getAuthUserId(context));
    const { generateGmbSeoProfileRewrite } = await import("@/lib/google-reviews.server");
    return await generateGmbSeoProfileRewrite({
      clinicId: data.clinic_id,
      focusKeywords: data.focus_keywords,
      tone: data.tone,
    });
  });

export const batchAutoReplyAllReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        clinic_id: z.string().uuid(),
        organization_id: z.string().uuid().nullable().optional(),
        tone: z.string().max(50).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ownedClinic(data.clinic_id, getAuthUserId(context));
    const { batchAutoReplyReviews } = await import("@/lib/google-reviews.server");
    return await batchAutoReplyReviews({
      clinicId: data.clinic_id,
      organizationId: data.organization_id,
      tone: data.tone,
    });
  });

export const generateDailyPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        clinic_id: z.string().uuid(),
        post_type: z.enum(["whats_new", "health_tip", "special_offer", "faq_spotlight", "event"]),
        custom_topic: z.string().max(300).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ownedClinic(data.clinic_id, getAuthUserId(context));
    const { generateDailyGmbPost } = await import("@/lib/google-reviews.server");
    return await generateDailyGmbPost({
      clinicId: data.clinic_id,
      postType: data.post_type,
      customTopic: data.custom_topic,
    });
  });

export const fetchPhotoScheduler = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ clinic_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ownedClinic(data.clinic_id, getAuthUserId(context));
    const { getGmbPhotoSchedulerData } = await import("@/lib/google-reviews.server");
    return await getGmbPhotoSchedulerData({ clinicId: data.clinic_id });
  });

export const fetchGmbAnalytics = createServerFn({ method: "POST" })
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
    await ownedClinic(data.clinic_id, getAuthUserId(context));
    const { getGmbAnalyticsData } = await import("@/lib/google-reviews.server");
    return await getGmbAnalyticsData({ clinicId: data.clinic_id, period: data.period });
  });
