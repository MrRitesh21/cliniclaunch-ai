import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminAuth } from "./admin-auth.functions";

const slugSchema = z.string().min(1).max(100);
const uuid = z.string().uuid();

/** Public: template metadata for the doctor-facing picker and marketing previews. */
export const listTemplateLibrary = createServerFn({ method: "GET" }).handler(async () => {
  const { listTemplateLibraryImpl } = await import("./site-templates.server");
  return listTemplateLibraryImpl();
});

/** Public: the compiled template a clinic's public site should render (if any). */
export const getClinicSiteTemplate = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ slug: slugSchema, preview: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { getClinicTemplateCachedImpl } = await import("./site-templates.server");
    return getClinicTemplateCachedImpl(data.slug, data.preview === true);
  });

/** Doctor: which template is active for their clinic + whether admin locked it. */
export const getClinicTemplateState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ clinic_id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: clinic } = await context.supabase.from("clinics").select("id").eq("id", data.clinic_id).maybeSingle();
    if (!clinic) throw new Error("Clinic not found or you don't have access");
    const { getClinicTemplateStateImpl } = await import("./site-templates.server");
    return getClinicTemplateStateImpl(data.clinic_id);
  });

/** Doctor: pick a template from the global library (RLS scopes the update). */
export const setClinicTemplateChoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ clinic_id: uuid, template_id: uuid.nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { setClinicTemplateChoiceImpl } = await import("./site-templates.server");
    return setClinicTemplateChoiceImpl(context.supabase, context.userId, data.clinic_id, data.template_id);
  });

// ------------------------------------------------------------------ admin only

export const adminListTemplates = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async () => {
    const { adminListTemplatesImpl } = await import("./site-templates.server");
    return adminListTemplatesImpl();
  });

export const adminSaveTemplate = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: uuid.nullish(),
        slug: z.string().trim().min(2).max(60),
        name: z.string().trim().min(2).max(120),
        description: z.string().trim().max(500).nullish(),
        kind: z.enum(["preset", "custom_html"]),
        preview_image_url: z.string().trim().max(1000).nullish(),
        swatch: z.string().trim().max(200).nullish(),
        theme_color: z.string().trim().max(30).nullish(),
        variants: z.record(z.string(), z.string()).nullish(),
        html_body: z.string().max(500_000).nullish(),
        css_body: z.string().max(200_000).nullish(),
        is_global: z.boolean(),
        is_active: z.boolean(),
        sort_order: z.number().int().min(0).max(9999).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { adminSaveTemplateImpl } = await import("./site-templates.server");
    return adminSaveTemplateImpl(data as any);
  });

export const adminDeleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data }) => {
    const { adminDeleteTemplateImpl } = await import("./site-templates.server");
    return adminDeleteTemplateImpl(data.id);
  });

export const adminAssignTemplate = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator((input: unknown) =>
    z.object({ clinic_id: uuid, template_id: uuid.nullable(), note: z.string().trim().max(300).nullish() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { adminAssignTemplateImpl } = await import("./site-templates.server");
    return adminAssignTemplateImpl(data);
  });

export const adminSearchClinics = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .validator((input: unknown) => z.object({ q: z.string().max(120).default("") }).parse(input))
  .handler(async ({ data }) => {
    const { adminSearchClinicsImpl } = await import("./site-templates.server");
    return adminSearchClinicsImpl(data.q);
  });
