import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const OrgInput = z.object({ organizationId: z.string().uuid() });

/* ------------------------------------------------------------------ analytics */

export const getMarketingAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => OrgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { marketingAnalytics } = await import("./marketing-studio.server");
    return marketingAnalytics((context as any).supabase, data.organizationId);
  });

/* ------------------------------------------------------------------- coupons */

const couponSchema = OrgInput.extend({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .transform((v) => v.toUpperCase().replace(/\s+/g, "")),
  title: z.string().trim().min(2).max(120),
  discountType: z.enum(["percentage", "flat"]),
  discountValue: z.number().int().min(1).max(100000),
  minSpend: z.number().int().min(0).max(1000000).default(0),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  maxUsage: z.number().int().min(1).max(1000000).default(100),
  isActive: z.boolean().default(true),
});

export const listMarketingCoupons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => OrgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context as any).supabase
      .from("marketing_coupons")
      .select("*")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const saveMarketingCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => couponSchema.parse(i))
  .handler(async ({ data, context }) => {
    const payload = {
      organization_id: data.organizationId,
      code: data.code,
      title: data.title,
      discount_type: data.discountType,
      discount_value: data.discountValue,
      min_spend: data.minSpend,
      valid_until: data.validUntil ?? null,
      max_usage: data.maxUsage,
      is_active: data.isActive,
    };
    const sb = (context as any).supabase;
    const q = data.id
      ? sb.from("marketing_coupons").update(payload).eq("id", data.id).select("id").maybeSingle()
      : sb.from("marketing_coupons").insert(payload).select("id").maybeSingle();
    const { data: row, error } = await q;
    if (error) {
      throw new Error(
        error.message.includes("duplicate") ? "A coupon with that code already exists" : error.message,
      );
    }
    return { id: row?.id as string | undefined };
  });

export const deleteMarketingCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context as any).supabase.from("marketing_coupons").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------- loyalty */

export const getLoyaltyOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => OrgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { loyaltyOverview } = await import("./marketing-studio.server");
    return loyaltyOverview((context as any).supabase, data.organizationId);
  });

export const saveLoyaltyProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    OrgInput.extend({
      id: z.string().uuid().optional(),
      name: z.string().trim().min(2).max(80),
      stampsRequired: z.number().int().min(1).max(50),
      rewardDescription: z.string().trim().min(2).max(200),
      active: z.boolean().default(true),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    const payload = {
      organization_id: data.organizationId,
      name: data.name,
      stamps_required: data.stampsRequired,
      reward_description: data.rewardDescription,
      active: data.active,
    };
    const { error } = data.id
      ? await sb.from("loyalty_programs").update(payload).eq("id", data.id)
      : await sb.from("loyalty_programs").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ----------------------------------------------------------------- referrals */

export const getReferralOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => OrgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { referralOverview } = await import("./marketing-studio.server");
    return referralOverview((context as any).supabase, data.organizationId);
  });

export const createReferralLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    OrgInput.extend({
      label: z.string().trim().min(2).max(80),
      targetPath: z.string().trim().min(1).max(200).default("/"),
      utmSource: z.string().trim().max(40).default("referral"),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    const slug =
      data.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 24) || "ref";
    const unique = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await sb.from("campaign_links").insert({
      organization_id: data.organizationId,
      slug: unique,
      label: data.label,
      target_path: data.targetPath,
      utm_source: data.utmSource,
      utm_medium: "referral",
      utm_campaign: slug,
    });
    if (error) throw new Error(error.message);
    return { slug: unique };
  });

/* ------------------------------------------------------------------- reviews */

export const getReviewsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => OrgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { reviewsOverview } = await import("./marketing-studio.server");
    return reviewsOverview((context as any).supabase, data.organizationId);
  });

export const saveReviewReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({ id: z.string().uuid(), reply: z.string().trim().min(2).max(1500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context as any).supabase
      .from("reviews")
      .update({ reply: data.reply })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const generateReviewReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        author: z.string().trim().max(80),
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().max(2000),
        clinicName: z.string().trim().max(120).default("our clinic"),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { callAI } = await import("./ai.server");
    const reply = await callAI({
      system:
        "You write short, warm, professional replies from an Indian healthcare clinic to patient reviews. " +
        "Never diagnose, never mention medical details, never promise outcomes. 2-3 sentences, no emojis, no hashtags.",
      user: `Clinic: ${data.clinicName}\nReviewer: ${data.author}\nRating: ${data.rating}/5\nReview: ${data.comment}\n\nWrite the clinic's public reply.`,
    });
    return { reply: reply.trim().replace(/^["']|["']$/g, "") };
  });

/* --------------------------------------------------------------- automations */

export const listMarketingAutomations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => OrgInput.parse(i))
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    const { data: rows, error } = await sb
      .from("marketing_automations")
      .select("*")
      .eq("organization_id", data.organizationId)
      .order("created_at");
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const seedMarketingAutomations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => OrgInput.parse(i))
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    const { DEFAULT_AUTOMATIONS } = await import("./marketing-studio.server");
    const { data: existing } = await sb
      .from("marketing_automations")
      .select("template_key")
      .eq("organization_id", data.organizationId);
    const have = new Set(((existing ?? []) as any[]).map((r) => r.template_key));
    const rows = DEFAULT_AUTOMATIONS.filter((a) => !have.has(a.template_key)).map((a) => ({
      ...a,
      organization_id: data.organizationId,
      is_active: true,
    }));
    if (rows.length === 0) return { inserted: 0 };
    const { error } = await sb.from("marketing_automations").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

export const toggleMarketingAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: z.string().uuid(), isActive: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context as any).supabase
      .from("marketing_automations")
      .update({ is_active: data.isActive })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------- settings + integrations */

const settingsShape = z.object({
  senderName: z.string().trim().max(120).default(""),
  senderEmail: z.string().trim().max(160).default(""),
  waPhone: z.string().trim().max(20).default(""),
  optOutFooter: z.boolean().default(true),
  reviewLink: z.string().trim().max(500).default(""),
});

export const getMarketingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => OrgInput.parse(i))
  .handler(async ({ data, context }) => {
    const sb = (context as any).supabase;
    const [orgRes, waRes, campRes, clinicRes] = await Promise.all([
      sb
        .from("organizations")
        .select("name, marketing_settings, google_business_profile_url")
        .eq("id", data.organizationId)
        .maybeSingle(),
      sb.from("whatsapp_logs").select("id", { count: "exact", head: true }).eq("organization_id", data.organizationId),
      sb
        .from("marketing_campaigns")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", data.organizationId),
      sb.from("clinics").select("slug, is_published, custom_domain").eq("organization_id", data.organizationId).limit(1),
    ]);

    const raw = (orgRes.data?.marketing_settings ?? {}) as Record<string, unknown>;
    const clinic = ((clinicRes.data ?? []) as any[])[0] ?? null;

    return {
      orgName: (orgRes.data?.name ?? "") as string,
      settings: settingsShape.parse({
        senderName: raw.senderName ?? orgRes.data?.name ?? "",
        senderEmail: raw.senderEmail ?? "",
        waPhone: raw.waPhone ?? "",
        optOutFooter: raw.optOutFooter ?? true,
        reviewLink: raw.reviewLink ?? "",
      }),
      status: {
        whatsappMessages: waRes.count ?? 0,
        campaigns: campRes.count ?? 0,
        gmbConnected: Boolean(orgRes.data?.google_business_profile_url),
        gmbUrl: (orgRes.data?.google_business_profile_url ?? null) as string | null,
        siteLive: Boolean(clinic?.is_published),
        clinicSlug: (clinic?.slug ?? null) as string | null,
        customDomain: (clinic?.custom_domain ?? null) as string | null,
      },
    };
  });

export const saveMarketingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => OrgInput.extend({ settings: settingsShape }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context as any).supabase
      .from("organizations")
      .update({ marketing_settings: data.settings })
      .eq("id", data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
