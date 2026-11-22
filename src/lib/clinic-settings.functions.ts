import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidUuid } from "@/lib/sso-uuid";

export const updateClinicSettingsServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
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

export const setModuleInstallationServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        organizationId: z.string().min(1),
        moduleId: z.string().min(1).max(60),
        installed: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data: input, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context as any;

    const MODULE_ALIASES: Record<string, string[]> = {
      consultation: ["consult", "video"],
      consult: ["consultation", "video"],
      website_builder: ["website"],
      website: ["website_builder"],
      qr_appointment: ["qr_checkin"],
      qr_checkin: ["qr_appointment"],
      crm: ["patients", "emr", "records"],
      patients: ["crm", "emr", "records"],
      appointments: ["visits", "queue"],
      billing: ["finance", "expenses"],
      finance: ["billing", "expenses"],
      staff: ["staff_management"],
      pharmacy: ["inventory"],
      ai_assistant: ["ai_scribe"],
      loyalty: ["loyalty_rewards", "patient_loyalty"],
      loyalty_rewards: ["loyalty", "patient_loyalty"],
      patient_loyalty: ["loyalty", "loyalty_rewards"],
      reviews: ["google_reviews", "gmb"],
    };

    const idsToHandle = Array.from(
      new Set([input.moduleId, ...(MODULE_ALIASES[input.moduleId] ?? [])])
    );

    if (isValidUuid(input.organizationId)) {
      if (input.installed) {
        // 1. Insert into organization_modules for the main moduleId
        await (supabaseAdmin as any)
          .from("organization_modules")
          .upsert(
            {
              organization_id: input.organizationId,
              module_id: input.moduleId,
              installed_by: userId || null,
            },
            { onConflict: "organization_id,module_id" }
          );

        // 2. Clear or set enabled: true in organization_module_overrides
        for (const id of idsToHandle) {
          await (supabaseAdmin as any)
            .from("organization_module_overrides")
            .upsert(
              {
                organization_id: input.organizationId,
                module_id: id,
                enabled: true,
                reason: "User installed module",
                updated_by: userId || null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "organization_id,module_id" }
            );
        }
      } else {
        // 1. Delete all aliases from organization_modules
        await (supabaseAdmin as any)
          .from("organization_modules")
          .delete()
          .eq("organization_id", input.organizationId)
          .in("module_id", idsToHandle);

        // 2. Explicitly set enabled: false in organization_module_overrides
        // This ensures useOrganization's override checks remove it from installedSet
        for (const id of idsToHandle) {
          await (supabaseAdmin as any)
            .from("organization_module_overrides")
            .upsert(
              {
                organization_id: input.organizationId,
                module_id: id,
                enabled: false,
                reason: "User uninstalled module",
                updated_by: userId || null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "organization_id,module_id" }
            );
        }
      }
    }

    return { ok: true, moduleId: input.moduleId, installed: input.installed };
  });

