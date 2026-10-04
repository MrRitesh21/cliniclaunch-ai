import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ownedClinic(clinicId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("clinics").select("id, owner_id").eq("id", clinicId).maybeSingle();
  if (!data) throw new Error("Clinic not found");
  if ((data as { owner_id?: string | null }).owner_id !== userId) throw new Error("Unauthorized");
  return data;
}

export const saveGooglePlaceId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({ clinic_id: z.string().uuid(), place_id: z.string().trim().max(200).nullable() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ownedClinic(data.clinic_id, context.userId);
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
    await ownedClinic(data.clinic_id, context.userId);
    const { syncClinicGoogleReviews } = await import("@/lib/google-reviews.server");
    return await syncClinicGoogleReviews(data.clinic_id);
  });

export const toggleGoogleReviewVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({ clinic_id: z.string().uuid(), index: z.number().int().min(0), show: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await ownedClinic(data.clinic_id, context.userId);
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