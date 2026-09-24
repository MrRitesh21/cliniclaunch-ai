// Server-only implementation for the admin-managed website template library.
import { sanitizeTemplateHtml, scopeTemplateCss, compileCustomTemplate } from "./html-template";
import { redisCache } from "./redis";

const TPL_COLUMNS =
  "id, slug, name, description, kind, preview_image_url, swatch, variants, theme_color, html_body, css_body, is_global, is_active, sort_order, created_at, updated_at";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function requireAdmin() {
  const { getVerifiedAdmin } = await import("./admin.server");
  const me = await getVerifiedAdmin();
  if (!me) throw new Error("Not authorized");
  return me;
}

async function invalidateTemplateCaches(slug?: string | null) {
  await redisCache.flushPattern("clinic:tpl:*");
  if (slug) await redisCache.del(`clinic:slug:${slug}`);
  else await redisCache.flushPattern("clinic:slug:*");
}

/** Public: template metadata a doctor can pick from (no HTML payload). */
export async function listTemplateLibraryImpl() {
  const sb = await admin();
  const { data } = await sb
    .from("site_templates")
    .select("id, slug, name, description, kind, preview_image_url, swatch, theme_color, sort_order")
    .eq("is_active", true)
    .eq("is_global", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  return data ?? [];
}

/**
 * Public: resolve which template a clinic's public site must render.
 * Priority: admin per-clinic assignment > the doctor's own library choice > none.
 * Custom HTML templates are returned already compiled + sanitized + scoped.
 */
export async function resolveClinicTemplateImpl(slug: string) {
  const sb = await admin();
  const { data: clinic } = await sb
    .from("clinics")
    .select(
      "id, slug, doctor_name, clinic_name, specialization, qualification, experience_years, bio, hero_headline, hero_subheadline, about_text, consultation_fee, public_phone, phone, public_email, email, public_address, address, avatar_url, logo_url, theme_color, services, gallery, medical_registration_no, site_template_id, is_published",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!clinic) return null;

  const { data: assignment } = await sb
    .from("clinic_template_assignments")
    .select("template_id")
    .eq("clinic_id", clinic.id)
    .maybeSingle();

  const templateId = assignment?.template_id ?? clinic.site_template_id ?? null;
  if (!templateId) return null;

  const { data: tpl } = await sb
    .from("site_templates")
    .select(TPL_COLUMNS)
    .eq("id", templateId)
    .eq("is_active", true)
    .maybeSingle();
  if (!tpl) return null;

  const { data: reviews } = await sb
    .from("reviews")
    .select("reviewer_name, rating, comment")
    .eq("clinic_id", clinic.id)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(12);

  const base = {
    id: tpl.id as string,
    slug: tpl.slug as string,
    name: tpl.name as string,
    kind: tpl.kind as "preset" | "custom_html",
    theme_color: (tpl.theme_color as string | null) ?? null,
    variants: (tpl.variants ?? {}) as Record<string, string>,
    assigned_by_admin: Boolean(assignment),
  };

  if (base.kind !== "custom_html") return { ...base, html: null, css: null };

  const compiled = compileCustomTemplate(
    { html_body: tpl.html_body, css_body: tpl.css_body },
    { ...(clinic as any), db_reviews: reviews ?? [] },
  );
  return { ...base, html: compiled.html, css: compiled.css };
}

/** Cached public resolver used by the clinic site loader. */
export async function getClinicTemplateCachedImpl(slug: string, skipCache = false) {
  if (skipCache) return resolveClinicTemplateImpl(slug);
  return redisCache.getOrSet(`clinic:tpl:${slug}`, () => resolveClinicTemplateImpl(slug), 300);
}

// ------------------------------------------------------------------ admin CRUD

export async function adminListTemplatesImpl() {
  await requireAdmin();
  const sb = await admin();
  const [{ data: templates }, { data: assignments }] = await Promise.all([
    sb
      .from("site_templates")
      .select(TPL_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    sb.from("clinic_template_assignments").select("id, clinic_id, template_id, note, created_at"),
  ]);

  const clinicIds = (assignments ?? []).map((a: any) => a.clinic_id);
  let clinics: any[] = [];
  if (clinicIds.length) {
    const { data } = await sb
      .from("clinics")
      .select("id, slug, doctor_name, clinic_name")
      .in("id", clinicIds);
    clinics = data ?? [];
  }
  const byId = new Map(clinics.map((c) => [c.id, c]));

  return {
    templates: templates ?? [],
    assignments: (assignments ?? []).map((a: any) => ({
      ...a,
      clinic: byId.get(a.clinic_id) ?? null,
    })),
  };
}

export async function adminSaveTemplateImpl(input: {
  id?: string | null;
  slug: string;
  name: string;
  description?: string | null;
  kind: "preset" | "custom_html";
  preview_image_url?: string | null;
  swatch?: string | null;
  theme_color?: string | null;
  variants?: Record<string, string> | null;
  html_body?: string | null;
  css_body?: string | null;
  is_global: boolean;
  is_active: boolean;
  sort_order?: number | null;
}) {
  const me = await requireAdmin();
  const sb = await admin();

  const row: Record<string, unknown> = {
    slug: input.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-"),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    kind: input.kind,
    preview_image_url: input.preview_image_url?.trim() || null,
    swatch: input.swatch?.trim() || null,
    theme_color: input.theme_color?.trim() || null,
    variants: input.variants ?? {},
    // Sanitize on write as well as on render — defence in depth.
    html_body: input.kind === "custom_html" ? sanitizeTemplateHtml(input.html_body ?? "") : null,
    css_body: input.kind === "custom_html" ? scopeTemplateCss(input.css_body ?? "") : null,
    is_global: input.is_global,
    is_active: input.is_active,
    sort_order: input.sort_order ?? 100,
  };

  let saved: any;
  if (input.id) {
    const { data, error } = await sb
      .from("site_templates")
      .update(row)
      .eq("id", input.id)
      .select(TPL_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    saved = data;
  } else {
    const { data, error } = await sb
      .from("site_templates")
      .insert({ ...row, created_by: me.id })
      .select(TPL_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    saved = data;
  }

  await invalidateTemplateCaches();
  return saved;
}

export async function adminDeleteTemplateImpl(id: string) {
  await requireAdmin();
  const sb = await admin();
  const { error } = await sb.from("site_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await invalidateTemplateCaches();
  return { ok: true };
}

export async function adminAssignTemplateImpl(input: {
  clinic_id: string;
  template_id: string | null;
  note?: string | null;
}) {
  const me = await requireAdmin();
  const sb = await admin();

  const { data: clinic } = await sb
    .from("clinics")
    .select("id, slug")
    .eq("id", input.clinic_id)
    .maybeSingle();
  if (!clinic) throw new Error("Clinic not found");

  if (!input.template_id) {
    await sb.from("clinic_template_assignments").delete().eq("clinic_id", input.clinic_id);
  } else {
    const { error } = await sb.from("clinic_template_assignments").upsert(
      {
        clinic_id: input.clinic_id,
        template_id: input.template_id,
        note: input.note?.trim() || null,
        assigned_by: me.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clinic_id" },
    );
    if (error) throw new Error(error.message);
  }

  await invalidateTemplateCaches(clinic.slug);
  return { ok: true };
}

export async function adminSearchClinicsImpl(q: string) {
  await requireAdmin();
  const sb = await admin();
  let query = sb
    .from("clinics")
    .select("id, slug, doctor_name, clinic_name")
    .order("created_at", { ascending: false })
    .limit(25);
  const term = q.trim();
  if (term)
    query = query.or(
      `slug.ilike.%${term}%,doctor_name.ilike.%${term}%,clinic_name.ilike.%${term}%`,
    );
  const { data } = await query;
  return data ?? [];
}

// --------------------------------------------------------------- doctor choice

export async function setClinicTemplateChoiceImpl(
  sb: any,
  userId: string,
  clinicId: string,
  templateId: string | null,
) {
  const { data: clinic, error } = await sb
    .from("clinics")
    .select("id, slug")
    .eq("id", clinicId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!clinic) throw new Error("Clinic not found or you don't have access");

  // An admin-forced template wins; refuse silently-broken UX with a clear error.
  const adminSb = await admin();
  const { data: forced } = await adminSb
    .from("clinic_template_assignments")
    .select("id")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (forced)
    throw new Error("Your template is managed by the clinicx team and can't be changed here.");

  const { error: upErr } = await sb
    .from("clinics")
    .update({ site_template_id: templateId })
    .eq("id", clinicId);
  if (upErr) throw new Error(upErr.message);

  await invalidateTemplateCaches(clinic.slug);
  return { ok: true };
}

export async function getClinicTemplateStateImpl(clinicId: string) {
  const sb = await admin();
  const [{ data: clinic }, { data: assignment }] = await Promise.all([
    sb.from("clinics").select("site_template_id").eq("id", clinicId).maybeSingle(),
    sb
      .from("clinic_template_assignments")
      .select("template_id, note")
      .eq("clinic_id", clinicId)
      .maybeSingle(),
  ]);
  return {
    selected_template_id: (assignment?.template_id ?? clinic?.site_template_id ?? null) as
      string | null,
    locked: Boolean(assignment),
    note: (assignment?.note ?? null) as string | null,
  };
}
