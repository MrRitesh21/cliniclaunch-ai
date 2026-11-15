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
  const { data } = await supabaseAdmin
    .from("clinics")
    .select("id, owner_id")
    .eq("id", clinicId)
    .maybeSingle();
  if (!data) throw new Error("Clinic not found");
  if ((data as { owner_id?: string | null }).owner_id !== userId) throw new Error("Unauthorized");
  return data;
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
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ownedClinic(data.clinic_id, getAuthUserId(context));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();

    await supabaseAdmin
      .from("clinics")
      .update({
        google_place_id: data.place_id || null,
      } as never)
      .eq("id", data.clinic_id);

    if (data.organization_id) {
      await supabaseAdmin
        .from("organizations")
        .update({
          google_business_name: data.business_name || null,
          google_business_profile_url: data.profile_url || null,
          google_place_id: data.place_id || null,
          google_sync_status: "connected",
          google_business_profile_connected_at: now,
        } as never)
        .eq("id", data.organization_id);
    }
    return { ok: true };
  });

export const disconnectGoogleGmb = createServerFn({ method: "POST" })
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

    await supabaseAdmin
      .from("clinics")
      .update({ google_place_id: null } as never)
      .eq("id", data.clinic_id);

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
    }
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
