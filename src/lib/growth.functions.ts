import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { CAMPAIGN_APPS } from "@/features/marketing/data/campaignApps";

const OrgInput = z.object({ organizationId: z.string().uuid() });

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Shopify-style growth home: today's sales, 30-day trend and the
 * leads → bookings → revenue funnel, all from live clinic data.
 */
export const getGrowthOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrgInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const orgId = data.organizationId;
    const today = dayKey(new Date());
    const from = dayKey(new Date(Date.now() - 29 * 864e5));

    const [ledgerRes, leadsRes, apptRes, reviewRes, campRes, patientRes] = await Promise.all([
      supabase
        .from("finance_ledger")
        .select("entry_date, entry_type, net_amount, source")
        .eq("organization_id", orgId)
        .eq("entry_type", "revenue")
        .gte("entry_date", from)
        .lte("entry_date", today)
        .limit(5000),
      supabase
        .from("leads")
        .select("id, status, source, created_at")
        .eq("organization_id", orgId)
        .gte("created_at", `${from}T00:00:00Z`)
        .limit(2000),
      supabase
        .from("appointments")
        .select("id, status, source, appointment_date")
        .eq("organization_id", orgId)
        .gte("appointment_date", from)
        .limit(3000),
      supabase.from("reviews").select("rating, status").eq("organization_id", orgId).limit(2000),
      supabase
        .from("marketing_campaigns")
        .select("id, name, channel, status, recipient_count, delivered_count, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase.from("patients").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    ]);

    const ledger = (ledgerRes.data ?? []) as Array<{ entry_date: string; net_amount: number; source: string | null }>;
    const leads = (leadsRes.data ?? []) as Array<{ status: string | null; source: string | null; created_at: string }>;
    const appts = (apptRes.data ?? []) as Array<{ status: string | null; source: string | null; appointment_date: string }>;
    const reviews = (reviewRes.data ?? []) as Array<{ rating: number | null; status: string | null }>;

    const byDay = new Map<string, number>();
    for (let i = 29; i >= 0; i--) byDay.set(dayKey(new Date(Date.now() - i * 864e5)), 0);
    for (const r of ledger) {
      const k = r.entry_date?.slice(0, 10);
      if (k && byDay.has(k)) byDay.set(k, (byDay.get(k) ?? 0) + Number(r.net_amount ?? 0));
    }
    const series = [...byDay.entries()].map(([date, revenue]) => ({ date, revenue: Math.round(revenue) }));

    const revenue30 = Math.round(series.reduce((s, d) => s + d.revenue, 0));
    const revenueToday = Math.round(series.at(-1)?.revenue ?? 0);
    const prev15 = series.slice(0, 15).reduce((s, d) => s + d.revenue, 0);
    const last15 = series.slice(15).reduce((s, d) => s + d.revenue, 0);
    const trendPct = prev15 > 0 ? Math.round(((last15 - prev15) / prev15) * 100) : 0;

    const bookings = appts.length;
    const completed = appts.filter((a) => a.status === "completed").length;
    const noShow = appts.filter((a) => a.status === "no_show").length;
    const cancelled = appts.filter((a) => a.status === "cancelled").length;
    const convertedLeads = leads.filter((l) => (l.status ?? "").toLowerCase() === "converted").length;

    const sourceMap = new Map<string, number>();
    for (const l of leads) sourceMap.set(l.source || "direct", (sourceMap.get(l.source || "direct") ?? 0) + 1);

    const approved = reviews.filter((r) => r.status === "approved");
    const avgRating = approved.length
      ? Math.round((approved.reduce((s, r) => s + Number(r.rating ?? 0), 0) / approved.length) * 10) / 10
      : 0;

    return {
      sales: {
        today: revenueToday,
        last30: revenue30,
        trendPct,
        avgTicket: completed ? Math.round(revenue30 / completed) : 0,
        series,
      },
      funnel: {
        leads: leads.length,
        bookings,
        completed,
        convertedLeads,
        noShow,
        cancelled,
        leadToBooking: leads.length ? Math.round((bookings / leads.length) * 100) : 0,
        bookingToVisit: bookings ? Math.round((completed / bookings) * 100) : 0,
      },
      channels: [...sourceMap.entries()]
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      reputation: { reviews: approved.length, avgRating, pending: reviews.length - approved.length },
      patients: patientRes.count ?? 0,
      campaigns: (campRes.data ?? []) as Array<{
        id: string;
        name: string;
        channel: string | null;
        status: string | null;
        recipient_count: number | null;
        delivered_count: number | null;
        created_at: string;
      }>,
    };
  });

/** Marketplace listing: available modules + which ones this org installed. */
export const listGrowthApps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrgInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const [mods, installed, camps] = await Promise.all([
      supabase.from("modules").select("*").eq("is_available", true).order("sort_order"),
      supabase.from("organization_modules").select("module_id").eq("organization_id", data.organizationId),
      supabase
        .from("marketing_campaigns")
        .select("id, name, status")
        .eq("organization_id", data.organizationId)
        .limit(200),
    ]);

    const installedIds = ((installed.data ?? []) as Array<{ module_id: string }>).map((m) => m.module_id);
    const campaignNames = new Set(((camps.data ?? []) as Array<{ name: string }>).map((c) => c.name));

    return {
      modules: (mods.data ?? []) as Array<{
        id: string;
        name: string;
        description: string | null;
        category: string;
        icon: string | null;
        is_core: boolean | null;
        min_plan: string | null;
      }>,
      installedIds,
      campaignApps: CAMPAIGN_APPS.map((a) => ({ ...a, installed: campaignNames.has(a.name) })),
    };
  });

export const setGrowthAppInstalled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    OrgInput.extend({ moduleId: z.string().min(1).max(60), install: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (data.install) {
      const { error } = await supabase
        .from("organization_modules")
        .insert({ organization_id: data.organizationId, module_id: data.moduleId, installed_by: userId });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("organization_modules")
        .delete()
        .eq("organization_id", data.organizationId)
        .eq("module_id", data.moduleId);
      if (error) throw new Error(error.message);
    }
    return { ok: true, installed: data.install };
  });

/** 1-click install of a pre-built campaign app as a ready-to-send campaign. */
export const installCampaignApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrgInput.extend({ appId: z.string().min(1).max(60) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const app = CAMPAIGN_APPS.find((a) => a.id === data.appId);
    if (!app) throw new Error("Unknown campaign app");

    const { count } = await supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", data.organizationId);

    const { data: row, error } = await supabase
      .from("marketing_campaigns")
      .insert({
        organization_id: data.organizationId,
        name: app.name,
        channel: app.channel,
        subject: app.subject ?? null,
        body: app.body,
        status: "draft",
        recipient_count: count ?? 0,
        delivered_count: 0,
        audience_filter: { app_id: app.id, category: app.category },
        created_by: userId,
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);

    return { ok: true, campaignId: (row as { id: string } | null)?.id ?? null, recipients: count ?? 0 };
  });
