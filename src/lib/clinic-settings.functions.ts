import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const updateClinicSettingsServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        clinicSlug: z.string().optional(),
        updates: z.record(z.unknown()),
      })
      .parse(input),
  )
  .handler(async ({ data: input }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Prohibit modifying the public demo clinic via server function if requested
    if (input.clinicSlug === "demo-clinic") {
      return { ok: false, message: "Demo clinic cannot be modified." };
    }

    const { error } = await (supabaseAdmin as any)
      .from("clinics")
      .update(input.updates)
      .eq("id", input.clinicId);

    if (error) {
      throw new Error(`Failed to save settings: ${error.message}`);
    }

    return { ok: true };
  });

export const setClinicPublishedStatusServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        clinicId: z.string().min(1),
        clinicSlug: z.string().optional(),
        isPublished: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data: input }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { redisCache } = await import("./redis");

    // Prohibit modifying the public demo clinic
    if (input.clinicSlug === "demo-clinic" || input.clinicSlug === "demo") {
      return { ok: false, message: "Demo clinic cannot be modified." };
    }

    const now = new Date().toISOString();
    const { error } = await (supabaseAdmin as any)
      .from("clinics")
      .update({
        is_published: input.isPublished,
        published_at: input.isPublished ? now : null,
        updated_at: now,
      })
      .eq("id", input.clinicId);

    if (error) {
      throw new Error(`Failed to update publish status: ${error.message}`);
    }

    // Immediately bust all clinic Redis caches so website and API update instantly
    if (input.clinicSlug) {
      try {
        await Promise.allSettled([
          redisCache.del(`clinic:slug:${input.clinicSlug}`),
          redisCache.del(`clinic:public_data:${input.clinicSlug}`),
          redisCache.del(`clinic:tpl:${input.clinicSlug}`),
        ]);
      } catch (cacheErr) {
        console.error("[setClinicPublishedStatusServerFn] Cache bust error:", cacheErr);
      }
    }

    return {
      ok: true,
      isPublished: input.isPublished,
      publishedAt: input.isPublished ? now : null,
    };
  });
