import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CHANNELS = ["whatsapp", "email", "sms", "push", "voice"] as const;
const STATUSES = ["draft", "scheduled", "running", "paused", "completed", "cancelled"] as const;

const campaignSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2, "Name is required").max(120),
  channel: z.enum(CHANNELS),
  type: z.string().trim().max(40).default("promotional"),
  status: z.enum(STATUSES).default("draft"),
  subject: z.string().trim().max(200).optional().or(z.literal("")),
  body: z.string().trim().min(1, "Message is required").max(4000),
  ctaText: z.string().trim().max(60).optional().or(z.literal("")),
  ctaUrl: z.string().trim().max(500).optional().or(z.literal("")),
  audienceSegment: z.string().trim().max(40).default("all_patients"),
  templateKey: z.string().trim().max(60).optional().or(z.literal("")),
  scheduledAt: z.string().datetime().optional().nullable(),
  spend: z.number().min(0).max(10_000_000).default(0),
});

export const listCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ organizationId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: rows, error } = await supabase
      .from("marketing_campaigns")
      .select("*")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const saveCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => campaignSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const row = {
      organization_id: data.organizationId,
      name: data.name,
      channel: data.channel,
      type: data.type,
      status: data.scheduledAt ? "scheduled" : data.status,
      subject: data.subject || null,
      body: data.body,
      cta_text: data.ctaText || null,
      cta_url: data.ctaUrl || null,
      audience_segment: data.audienceSegment,
      template_key: data.templateKey || null,
      scheduled_at: data.scheduledAt ?? null,
      spend: data.spend,
    };

    if (data.id) {
      const { data: updated, error } = await supabase
        .from("marketing_campaigns")
        .update(row)
        .eq("id", data.id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return updated;
    }

    const { data: inserted, error } = await supabase
      .from("marketing_campaigns")
      .insert(row)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const deleteCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context as any).supabase
      .from("marketing_campaigns")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: src, error } = await supabase
      .from("marketing_campaigns")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !src) throw new Error(error?.message ?? "Campaign not found");
    const {
      id: _id,
      created_at: _c,
      updated_at: _u,
      sent_at: _s,
      ...rest
    } = src as Record<string, unknown>;
    const { data: copy, error: insErr } = await supabase
      .from("marketing_campaigns")
      .insert({
        ...rest,
        name: `${src.name} (Copy)`,
        status: "draft",
        scheduled_at: null,
        recipient_count: 0,
        delivered_count: 0,
        opened_count: 0,
        clicked_count: 0,
        booked_count: 0,
        revenue_generated: 0,
      })
      .select("*")
      .maybeSingle();
    if (insErr) throw new Error(insErr.message);
    return copy;
  });

/** Sends the campaign now through the clinic's connected WhatsApp session. */
export const dispatchCampaignNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { dispatchCampaign } = await import("./campaigns.server");
    return dispatchCampaign((context as any).supabase, data.id);
  });

/* ---------------------------------- links --------------------------------- */

const linkSchema = z.object({
  organizationId: z.string().uuid(),
  clinicId: z.string().uuid().optional().nullable(),
  campaignId: z.string().uuid().optional().nullable(),
  label: z.string().trim().max(80).optional().or(z.literal("")),
  targetPath: z.string().trim().max(200).default("/"),
  utmSource: z.string().trim().max(60).default("whatsapp"),
  utmMedium: z.string().trim().max(60).default("campaign"),
  utmCampaign: z.string().trim().max(80).default(""),
  utmContent: z.string().trim().max(80).optional().or(z.literal("")),
});

function randomSlug() {
  return Math.random().toString(36).slice(2, 8);
}

export const createCampaignLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => linkSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: row, error } = await supabase
      .from("campaign_links")
      .insert({
        organization_id: data.organizationId,
        clinic_id: data.clinicId ?? null,
        campaign_id: data.campaignId ?? null,
        slug: randomSlug(),
        label: data.label || null,
        target_path: data.targetPath || "/",
        utm_source: data.utmSource,
        utm_medium: data.utmMedium,
        utm_campaign: data.utmCampaign || null,
        utm_content: data.utmContent || null,
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const listCampaignLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ organizationId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context as any).supabase
      .from("campaign_links")
      .select("*")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });
