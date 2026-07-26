import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ValueType = "money_saved" | "money_gained" | "time_saved_minutes";

/**
 * Authenticated logger. For internal server-side use, prefer calling the
 * `logValueEventAdmin` helper from `value-tracking.server.ts` inside a handler.
 */
export const logValueEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      organizationId: string;
      moduleKey: string;
      eventType: string;
      valueType: ValueType;
      valueAmount: number;
      description?: string;
      relatedId?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("value_events").insert({
      organization_id: data.organizationId,
      module_key: data.moduleKey,
      event_type: data.eventType,
      value_type: data.valueType,
      value_amount: data.valueAmount,
      description: data.description ?? null,
      related_id: data.relatedId ?? null,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

const HOURLY_RATE_PER_MIN = 1000 / 60; // ₹1000/hr doctor's time

export type PeriodKey = "this_week" | "this_month" | "last_30_days" | "all_time" | "last_month";

function getPeriodRange(period: PeriodKey): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now);
  const from = new Date(now);
  switch (period) {
    case "this_week": {
      const d = from.getDay();
      from.setDate(from.getDate() - d);
      from.setHours(0, 0, 0, 0);
      break;
    }
    case "this_month":
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      break;
    case "last_month": {
      from.setMonth(from.getMonth() - 1, 1);
      from.setHours(0, 0, 0, 0);
      to.setDate(1);
      to.setHours(0, 0, 0, 0);
      to.setMilliseconds(-1);
      break;
    }
    case "last_30_days":
      from.setDate(from.getDate() - 30);
      break;
    case "all_time":
      from.setFullYear(2000, 0, 1);
      break;
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export interface ModuleSummary {
  moneyGained: number;
  moneySaved: number;
  timeSavedMinutes: number;
  eventCount: number;
  recentEvents: Array<{
    id: string;
    event_type: string;
    value_type: string;
    value_amount: number;
    description: string | null;
    created_at: string;
  }>;
}

export interface ValueSummary {
  period: PeriodKey;
  totalMoneyGained: number;
  totalMoneySaved: number;
  totalTimeSavedMinutes: number;
  totalTimeSavedHours: number;
  totalValueDelivered: number;
  amountPaid: number;
  roiMultiplier: number;
  byModule: Record<string, ModuleSummary>;
  benchmarks: Record<
    string,
    {
      competitor_name: string | null;
      competitor_monthly_cost: number;
      description: string | null;
    }
  >;
}

export const getValueSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; period?: PeriodKey }) => ({
    organizationId: input.organizationId,
    period: (input.period ?? "this_month") as PeriodKey,
  }))
  .handler(async ({ data, context }): Promise<ValueSummary> => {
    const { from, to } = getPeriodRange(data.period);

    // Fetch value events, subscriptions, benchmarks, clinics, appointments, and modules in parallel
    const [eventsRes, subRes, benchRes, clinicRes, modulesRes] = await Promise.all([
      context.supabase
        .from("value_events")
        .select("id, module_key, event_type, value_type, value_amount, description, created_at")
        .eq("organization_id", data.organizationId)
        .gte("created_at", from)
        .lte("created_at", to)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("subscriptions")
        .select("plan_id, plans(monthly_price)")
        .eq("organization_id", data.organizationId)
        .maybeSingle(),
      context.supabase
        .from("module_value_benchmarks")
        .select("module_key, competitor_name, competitor_monthly_cost, description"),
      context.supabase
        .from("clinics")
        .select("id, consultation_fee")
        .eq("organization_id", data.organizationId)
        .maybeSingle(),
      context.supabase
        .from("organization_modules")
        .select("module_id")
        .eq("organization_id", data.organizationId),
    ]);

    const clinicId = clinicRes.data?.id;
    const events = eventsRes.data ?? [];
    const installedModules = (modulesRes.data ?? []).map((m) => m.module_id);

    // Always synthesize value events from system usage (completed appointments, whatsapp logs, reviews, invoices)
    let finalEvents = [...events];
    if (clinicId) {
      // Fetch appointments, whatsapp logs, reviews, invoices in parallel
      const [apptsRes, waLogsRes, reviewsRes, invoicesRes] = await Promise.all([
        context.supabase
          .from("appointments")
          .select("id, status, scheduled_at, appointment_type, patient_phone, patient_name, source")
          .eq("clinic_id", clinicId)
          .gte("scheduled_at", from)
          .lte("scheduled_at", to),
        installedModules.includes("whatsapp")
          ? context.supabase
              .from("whatsapp_logs")
              .select("id, created_at, patient_name, patient_phone")
              .eq("organization_id", data.organizationId)
              .gte("created_at", from)
              .lte("created_at", to)
          : Promise.resolve({ data: [] }),
        installedModules.includes("reviews")
          ? context.supabase
              .from("reviews")
              .select("id, created_at, reviewer_name, rating")
              .eq("organization_id", data.organizationId)
              .gte("created_at", from)
              .lte("created_at", to)
          : Promise.resolve({ data: [] }),
        installedModules.includes("billing")
          ? context.supabase
              .from("invoices")
              .select("id, created_at, amount, invoice_number")
              .eq("organization_id", data.organizationId)
              .gte("created_at", from)
              .lte("created_at", to)
          : Promise.resolve({ data: [] }),
      ]);

      const appointments = apptsRes.data ?? [];
      const waLogs = waLogsRes.data ?? [];
      const reviewsList = reviewsRes.data ?? [];
      const invoicesList = invoicesRes.data ?? [];

      // 1. Generate value from appointments history
      for (const appt of appointments) {
        // Gained revenue from completed appointments
        if (appt.status === "completed") {
          const fee = Number(clinicRes.data?.consultation_fee) || 500;
          finalEvents.push({
            id: `appt-gain-${appt.id}`,
            module_key:
              appt.appointment_type === "online" ? "online_consultation" : "website_builder",
            event_type: "consultation_completed",
            value_type: "money_gained",
            value_amount: fee,
            description: `Revenue from completed appointment (${appt.patient_name})`,
            created_at: appt.scheduled_at ?? new Date().toISOString(),
          });
        }

        // Time saved by letting patients book online instead of manual calls (10 mins)
        if (appt.source !== "walkin") {
          finalEvents.push({
            id: `appt-time-${appt.id}`,
            module_key: "website_builder",
            event_type: "online_booking",
            value_type: "time_saved_minutes",
            value_amount: 10,
            description: `Staff time saved via automated online slot booking (${appt.patient_name})`,
            created_at: appt.scheduled_at ?? new Date().toISOString(),
          });
        }
      }

      // 2. Generate value from WhatsApp automation logs
      for (const log of waLogs) {
        // Time saved sending reminders manually (5 mins)
        finalEvents.push({
          id: `wa-time-${log.id}`,
          module_key: "whatsapp_automation",
          event_type: "whatsapp_reminder",
          value_type: "time_saved_minutes",
          value_amount: 5,
          description: `Time saved via automated WhatsApp reminder to ${log.patient_name ?? "patient"}`,
          created_at: log.created_at,
        });
        // Cost saved compared to manual outreach campaigns
        finalEvents.push({
          id: `wa-cost-${log.id}`,
          module_key: "whatsapp_automation",
          event_type: "whatsapp_reminder",
          value_type: "money_saved",
          value_amount: 8, // ₹8 per reminder benchmark cost
          description: "Cost saved vs manual outreach campaigns",
          created_at: log.created_at,
        });
      }

      // 3. Generate value from Reviews automation
      for (const rev of reviewsList) {
        finalEvents.push({
          id: `rev-${rev.id}`,
          module_key: "reviews_automation",
          event_type: "review_collected",
          value_type: "money_saved",
          value_amount: 200, // ₹200 worth of SEO marketing value per review
          description: `Review collected from ${rev.reviewer_name} (${rev.rating} stars)`,
          created_at: rev.created_at,
        });
      }

      // 4. Generate value from Invoices automation
      for (const inv of invoicesList) {
        finalEvents.push({
          id: `inv-${inv.id}`,
          module_key: "billing_invoicing",
          event_type: "invoice_generated",
          value_type: "time_saved_minutes",
          value_amount: 5,
          description: `Auto-generated digital invoice (${inv.invoice_number})`,
          created_at: inv.created_at,
        });
        finalEvents.push({
          id: `inv-cost-${inv.id}`,
          module_key: "billing_invoicing",
          event_type: "invoice_generated",
          value_type: "money_saved",
          value_amount: 15, // ₹15 saved in paper/print cost
          description: `Saved paper & billing operations cost`,
          created_at: inv.created_at,
        });
      }
    }

    const byModule: Record<string, ModuleSummary> = {};
    let totalMoneyGained = 0;
    let totalMoneySaved = 0;
    let totalTimeSavedMinutes = 0;

    for (const e of finalEvents) {
      const m = (byModule[e.module_key] ??= {
        moneyGained: 0,
        moneySaved: 0,
        timeSavedMinutes: 0,
        eventCount: 0,
        recentEvents: [],
      });
      m.eventCount++;
      const amt = Number(e.value_amount) || 0;
      if (e.value_type === "money_gained") {
        m.moneyGained += amt;
        totalMoneyGained += amt;
      } else if (e.value_type === "money_saved") {
        m.moneySaved += amt;
        totalMoneySaved += amt;
      } else if (e.value_type === "time_saved_minutes") {
        m.timeSavedMinutes += amt;
        totalTimeSavedMinutes += amt;
      }
      if (m.recentEvents.length < 5) m.recentEvents.push(e);
    }

    const amountPaid =
      (subRes.data as { plans?: { monthly_price?: number } } | null)?.plans?.monthly_price ?? 0;
    const totalValueDelivered = Math.round(
      totalMoneyGained + totalMoneySaved + totalTimeSavedMinutes * HOURLY_RATE_PER_MIN,
    );
    const roiMultiplier =
      amountPaid > 0 ? Math.round((totalValueDelivered / amountPaid) * 10) / 10 : 0;

    const benchmarks: ValueSummary["benchmarks"] = {};
    for (const b of benchRes.data ?? []) {
      benchmarks[b.module_key] = {
        competitor_name: b.competitor_name,
        competitor_monthly_cost: b.competitor_monthly_cost,
        description: b.description,
      };
    }

    return {
      period: data.period,
      totalMoneyGained,
      totalMoneySaved,
      totalTimeSavedMinutes,
      totalTimeSavedHours: Math.round((totalTimeSavedMinutes / 60) * 10) / 10,
      totalValueDelivered,
      amountPaid,
      roiMultiplier,
      byModule,
      benchmarks,
    };
  });

/** Map from installed module ids (short) → benchmark/event module_key (long). */
export const MODULE_KEY_ALIAS: Record<string, string> = {
  whatsapp: "whatsapp_automation",
  reviews: "reviews_automation",
  loyalty: "loyalty_rewards",
  billing: "billing_invoicing",
  inventory: "inventory",
  marketing: "marketing_suite",
  staff: "staff_management",
  consultation: "online_consultation",
  website_builder: "website_builder",
  analytics: "analytics_pro",
};

export const MODULE_LABEL: Record<string, string> = {
  whatsapp_automation: "WhatsApp Automation",
  reviews_automation: "Reviews Automation",
  loyalty_rewards: "Loyalty & Rewards",
  billing_invoicing: "Billing & Invoicing",
  inventory: "Inventory",
  marketing_suite: "Marketing Suite",
  staff_management: "Staff Management",
  online_consultation: "Online Consultation",
  website_builder: "Website Builder",
  analytics_pro: "Analytics Pro",
};
