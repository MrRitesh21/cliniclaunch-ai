import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type LedgerRow = {
  id: string;
  entry_type: "revenue" | "expense";
  entry_date: string;
  source: string | null;
  service_category: string | null;
  expense_category: string | null;
  payment_mode: string | null;
  patient_id: string | null;
  patient_name: string | null;
  doctor_id: string | null;
  doctor_name: string | null;
  appointment_id: string | null;
  invoice_number: string | null;
  vendor: string | null;
  gross_amount: number;
  discount: number;
  tax_amount: number;
  net_amount: number;
  notes: string | null;
};

const RangeInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  organizationId: z.string().uuid(),
  clinicId: z.string().uuid().nullable().optional(),
});

/** Throws unless the caller is a member of the given organization. */
async function assertOrgMember(supabase: any, userId: string, organizationId: string) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Unauthorized");
  if (!data) throw new Error("Unauthorized");
}

function sum(rows: LedgerRow[], key: "net_amount" | "tax_amount" = "net_amount") {
  return rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);
}

function groupBy(rows: LedgerRow[], pick: (r: LedgerRow) => string | null) {
  const map = new Map<string, { key: string; amount: number; count: number }>();
  for (const r of rows) {
    const k = pick(r) || "unspecified";
    const cur = map.get(k) ?? { key: k, amount: 0, count: 0 };
    cur.amount += Number(r.net_amount ?? 0);
    cur.count += 1;
    map.set(k, cur);
  }
  return [...map.values()]
    .map((g) => ({ ...g, average: g.count ? Math.round(g.amount / g.count) : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function fetchLedger(
  supabase: any,
  organizationId: string,
  from: string,
  to: string,
  clinicId?: string | null,
): Promise<LedgerRow[]> {
  let q = supabase
    .from("finance_ledger")
    .select(
      "id, entry_type, entry_date, source, service_category, expense_category, payment_mode, patient_id, patient_name, doctor_id, doctor_name, appointment_id, invoice_number, vendor, gross_amount, discount, tax_amount, net_amount, notes",
    )
    .eq("organization_id", organizationId)
    .gte("entry_date", from)
    .lte("entry_date", to)
    .order("entry_date", { ascending: false })
    .limit(50000);
  if (clinicId) q = q.eq("clinic_id", clinicId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as LedgerRow[];
}

/** Everything the revenue dashboard, P&L and analytics screens need, in one call. */
export const getFinanceOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RangeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { organizationId, from, to, clinicId } = data;

    const rows = await fetchLedger(supabase, organizationId, from, to, clinicId);
    const revenue = rows.filter((r) => r.entry_type === "revenue");
    const expenses = rows.filter((r) => r.entry_type === "expense");

    const today = dayKey(new Date());
    const yesterday = dayKey(new Date(Date.now() - 864e5));
    const inDay = (d: string) => revenue.filter((r) => r.entry_date === d);

    // Period comparison windows relative to the selected range length
    const spanDays = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 864e5) + 1);
    const prevFrom = dayKey(new Date(new Date(from).getTime() - spanDays * 864e5));
    const prevTo = dayKey(new Date(new Date(from).getTime() - 864e5));
    const prevRows = await fetchLedger(supabase, organizationId, prevFrom, prevTo, clinicId);
    const prevRevenue = sum(prevRows.filter((r) => r.entry_type === "revenue"));
    const prevExpense = sum(prevRows.filter((r) => r.entry_type === "expense"));

    // Appointment mix over the same window
    let apptQ = supabase
      .from("appointments")
      .select("id, status, appointment_date, patient_id")
      .eq("organization_id", organizationId)
      .gte("appointment_date", from)
      .lte("appointment_date", to)
      .limit(50000);
    if (clinicId) apptQ = apptQ.eq("clinic_id", clinicId);
    const { data: appts } = await apptQ;
    const apptRows = (appts ?? []) as Array<{ id: string; status: string; patient_id: string | null }>;
    const countStatus = (s: string) => apptRows.filter((a) => a.status === s).length;

    const revenueByAppointment = new Map(revenue.filter((r) => r.appointment_id).map((r) => [r.appointment_id!, r.net_amount]));
    const lostValue = (status: string) => {
      const avg = revenue.length ? sum(revenue) / revenue.length : 0;
      return Math.round(countStatus(status) * avg);
    };

    // Daily timeline
    const timelineMap = new Map<string, { date: string; revenue: number; expense: number }>();
    for (const r of rows) {
      const cur = timelineMap.get(r.entry_date) ?? { date: r.entry_date, revenue: 0, expense: 0 };
      if (r.entry_type === "revenue") cur.revenue += Number(r.net_amount);
      else cur.expense += Number(r.net_amount);
      timelineMap.set(r.entry_date, cur);
    }
    const timeline = [...timelineMap.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ ...d, profit: d.revenue - d.expense }));

    const totalRevenue = sum(revenue);
    const totalExpense = sum(expenses);
    const cashRevenue = sum(revenue.filter((r) => (r.payment_mode ?? "cash") === "cash"));
    const uniquePatients = new Set(revenue.map((r) => r.patient_id).filter(Boolean)).size;
    const repeatPatients = (() => {
      const counts = new Map<string, number>();
      for (const r of revenue) if (r.patient_id) counts.set(r.patient_id, (counts.get(r.patient_id) ?? 0) + 1);
      return [...counts.values()].filter((c) => c > 1).length;
    })();

    const pct = (now: number, before: number) => (before === 0 ? (now > 0 ? 100 : 0) : Math.round(((now - before) / before) * 100));

    return {
      kpis: {
        today: sum(inDay(today)),
        yesterday: sum(inDay(yesterday)),
        rangeRevenue: totalRevenue,
        rangeExpense: totalExpense,
        netProfit: totalRevenue - totalExpense,
        margin: totalRevenue ? Math.round(((totalRevenue - totalExpense) / totalRevenue) * 100) : 0,
        revenueGrowth: pct(totalRevenue, prevRevenue),
        expenseGrowth: pct(totalExpense, prevExpense),
        profitGrowth: pct(totalRevenue - totalExpense, prevRevenue - prevExpense),
        transactions: revenue.length,
        averageTicket: revenue.length ? Math.round(totalRevenue / revenue.length) : 0,
        cashRatio: totalRevenue ? Math.round((cashRevenue / totalRevenue) * 100) : 0,
        digitalRatio: totalRevenue ? 100 - Math.round((cashRevenue / totalRevenue) * 100) : 0,
        expenseRatio: totalRevenue ? Math.round((totalExpense / totalRevenue) * 100) : 0,
        revenuePerPatient: uniquePatients ? Math.round(totalRevenue / uniquePatients) : 0,
        uniquePatients,
        repeatRate: uniquePatients ? Math.round((repeatPatients / uniquePatients) * 100) : 0,
      },
      sources: groupBy(revenue, (r) => r.source),
      services: groupBy(revenue, (r) => r.service_category),
      doctors: groupBy(
        revenue.filter((r) => r.doctor_name),
        (r) => r.doctor_name,
      ),
      paymentModes: groupBy(revenue, (r) => r.payment_mode),
      expenseCategories: groupBy(expenses, (r) => r.expense_category),
      vendors: groupBy(expenses, (r) => r.vendor).slice(0, 10),
      timeline,
      appointments: {
        total: apptRows.length,
        completed: countStatus("completed"),
        cancelled: countStatus("cancelled"),
        noShow: countStatus("no_show"),
        pending: countStatus("pending"),
        confirmed: countStatus("confirmed"),
        completedRevenue: Math.round([...revenueByAppointment.values()].reduce((s, v) => s + Number(v), 0)),
        cancellationLoss: lostValue("cancelled"),
        noShowLoss: lostValue("no_show"),
      },
      range: { from, to, prevFrom, prevTo },
    };
  });

/** Unpaid / partially paid invoices with ageing buckets. */
export const getOutstanding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ organizationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: rows, error } = await supabase
      .from("patient_invoices")
      .select("id, invoice_number, patient_name, patient_id, issue_date, due_date, total, amount_paid, status")
      .eq("organization_id", data.organizationId)
      .in("status", ["sent", "partial", "draft"])
      .order("issue_date", { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);

    const now = Date.now();
    const list = (rows ?? []).map((r: any) => {
      const due = r.due_date ? new Date(r.due_date).getTime() : new Date(r.issue_date).getTime();
      const daysOverdue = Math.max(0, Math.floor((now - due) / 864e5));
      const balance = Number(r.total) - Number(r.amount_paid);
      return {
        ...r,
        balance,
        daysOverdue,
        bucket: daysOverdue === 0 ? "current" : daysOverdue <= 7 ? "1-7" : daysOverdue <= 15 ? "8-15" : daysOverdue <= 30 ? "16-30" : "30+",
      };
    }).filter((r: any) => r.balance > 0);

    return {
      list,
      total: list.reduce((s: number, r: any) => s + r.balance, 0),
      buckets: ["current", "1-7", "8-15", "16-30", "30+"].map((b) => ({
        bucket: b,
        amount: list.filter((r: any) => r.bucket === b).reduce((s: number, r: any) => s + r.balance, 0),
        count: list.filter((r: any) => r.bucket === b).length,
      })),
    };
  });

/** Category suggestion: vendor memory first, then AI, then keyword rules. */
export const suggestExpenseCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        vendor: z.string().trim().min(1).max(160),
        notes: z.string().trim().max(500).optional(),
        amount: z.number().nonnegative().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { vendorKey, keywordCategory } = await import("./finance.server");
    const key = vendorKey(data.vendor);

    const { data: memory } = await supabase
      .from("vendor_categories")
      .select("category, hits")
      .eq("organization_id", data.organizationId)
      .eq("vendor_key", key)
      .maybeSingle();
    if (memory?.category) return { category: memory.category as string, source: "memory" as const };

    const guess = keywordCategory(`${data.vendor} ${data.notes ?? ""}`);
    return { category: (guess ?? "Other") as string, source: "rules" as const };
  });

/** OCR a bill image or PDF into structured expense fields. */
export const scanBill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        fileDataUrl: z.string().startsWith("data:").max(12_000_000),
        mime: z.string().max(100),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { aiScanBill } = await import("./finance.server");
    return aiScanBill(data.fileDataUrl, data.mime);
  });

const ExpenseInput = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  clinicId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  vendor: z.string().trim().max(160).optional().nullable(),
  amount: z.number().positive().max(100_000_000),
  gstAmount: z.number().nonnegative().max(100_000_000).default(0),
  category: z.string().trim().min(1).max(60),
  categorySource: z.enum(["manual", "ai", "memory", "keyword", "ocr"]).default("manual"),
  paymentMode: z.string().trim().min(1).max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  billUrl: z.string().url().max(1000).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  reason: z.string().trim().max(300).optional(),
});

/** Create or update an expense, remember the vendor's category, and write the audit trail. */
export const saveExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExpenseInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertOrgMember(supabase, userId, data.organizationId);
    const { vendorKey } = await import("./finance.server");

    const payload = {
      organization_id: data.organizationId,
      clinic_id: data.clinicId,
      title: data.title,
      vendor: data.vendor || null,
      amount: data.amount,
      gst_amount: data.gstAmount,
      category: data.category,
      category_source: data.categorySource,
      payment_mode: data.paymentMode,
      date: data.date,
      bill_url: data.billUrl || null,
      notes: data.notes || null,
      created_by: userId,
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let before: unknown = null;
    let id = data.id;
    if (id) {
      const { data: prev } = await supabaseAdmin.from("expenses").select("*").eq("id", id).maybeSingle();
      before = prev ?? null;
      const { error } = await supabaseAdmin.from("expenses").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await supabaseAdmin.from("expenses").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      id = created.id;
    }

    if (data.vendor) {
      const key = vendorKey(data.vendor);
      const { data: existing } = await supabase
        .from("vendor_categories")
        .select("id, hits")
        .eq("organization_id", data.organizationId)
        .eq("vendor_key", key)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("vendor_categories")
          .update({ category: data.category, hits: Number(existing.hits ?? 0) + 1, vendor_label: data.vendor })
          .eq("id", existing.id);
      } else {
        await supabase.from("vendor_categories").insert({
          organization_id: data.organizationId,
          vendor_key: key,
          vendor_label: data.vendor,
          category: data.category,
        });
      }
    }

    await supabase.from("finance_audit").insert({
      organization_id: data.organizationId,
      actor_id: userId,
      action: data.id ? "update" : "create",
      entity_type: "expense",
      entity_id: id,
      amount: data.amount,
      reason: data.reason ?? null,
      before_data: before as any,
      after_data: payload as any,
    });

    return { id };
  });

export const listExpenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertOrgMember(supabase, userId, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("expenses" as any)
      .select("*")
      .eq("organization_id", data.organizationId)
      .order("date", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        id: z.string().uuid(),
        reason: z.string().trim().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertOrgMember(supabase, userId, data.organizationId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin
      .from("expenses")
      .select("*")
      .eq("id", data.id)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (!before) throw new Error("Expense not found");
    const { error } = await supabaseAdmin
      .from("expenses")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("finance_audit").insert({
      organization_id: data.organizationId,
      actor_id: userId,
      action: "delete",
      entity_type: "expense",
      entity_id: data.id,
      amount: before?.amount ?? null,
      reason: data.reason ?? null,
      before_data: before ?? null,
    });
    return { ok: true };
  });

/** Cash position for a given day, plus any existing closing record. */
export const getCashDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        clinicId: z.string().uuid().nullable().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const rows = await fetchLedger(supabase, data.organizationId, data.date, data.date, data.clinicId);
    const cashIn = sum(rows.filter((r) => r.entry_type === "revenue" && (r.payment_mode ?? "cash") === "cash"));
    const cashOut = sum(rows.filter((r) => r.entry_type === "expense" && (r.payment_mode ?? "cash") === "cash"));

    let q = supabase
      .from("cash_book")
      .select("*")
      .eq("organization_id", data.organizationId)
      .eq("book_date", data.date);
    q = data.clinicId ? q.eq("clinic_id", data.clinicId) : q.is("clinic_id", null);
    const { data: closing } = await q.maybeSingle();

    return { cashIn, cashOut, expected: cashIn - cashOut, closing: closing ?? null, entries: rows };
  });

export const closeCashDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        clinicId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        expected: z.number(),
        actual: z.number().nonnegative(),
        cashExpenses: z.number().nonnegative().default(0),
        notes: z.string().trim().max(1000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const row = {
      organization_id: data.organizationId,
      clinic_id: data.clinicId,
      book_date: data.date,
      expected_cash: data.expected,
      actual_cash: data.actual,
      difference: data.actual - data.expected,
      cash_expenses: data.cashExpenses,
      notes: data.notes || null,
      closed_by: userId,
      closed_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("cash_book")
      .upsert(row, { onConflict: "organization_id,clinic_id,book_date" });
    if (error) throw new Error(error.message);

    await supabase.from("finance_audit").insert({
      organization_id: data.organizationId,
      actor_id: userId,
      action: "close_cash_day",
      entity_type: "cash_book",
      amount: data.actual,
      after_data: row as any,
    });
    return { difference: row.difference };
  });

/** AI narrative insights + a linear-trend forecast for the next month. */
export const getFinanceIntelligence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        clinicId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { aiInsights, forecast } = await import("./finance.server");

    const to = dayKey(new Date());
    const from = dayKey(new Date(Date.now() - 365 * 864e5));
    const rows = await fetchLedger(supabase, data.organizationId, from, to, data.clinicId);
    const revenue = rows.filter((r) => r.entry_type === "revenue");
    const expenses = rows.filter((r) => r.entry_type === "expense");

    // Monthly series for the forecast
    const monthly = new Map<string, { revenue: number; expense: number; patients: Set<string> }>();
    for (const r of rows) {
      const m = r.entry_date.slice(0, 7);
      const cur = monthly.get(m) ?? { revenue: 0, expense: 0, patients: new Set<string>() };
      if (r.entry_type === "revenue") {
        cur.revenue += Number(r.net_amount);
        if (r.patient_id) cur.patients.add(r.patient_id);
      } else cur.expense += Number(r.net_amount);
      monthly.set(m, cur);
    }
    const months = [...monthly.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const revSeries = months.map(([, v]) => v.revenue);
    const expSeries = months.map(([, v]) => v.expense);
    const patSeries = months.map(([, v]) => v.patients.size);

    const revF = forecast(revSeries);
    const expF = forecast(expSeries);
    const patF = forecast(patSeries);

    const weekday = [0, 0, 0, 0, 0, 0, 0];
    for (const r of revenue) weekday[new Date(r.entry_date).getDay()] += Number(r.net_amount);

    const summary = {
      months: months.map(([m, v]) => ({ month: m, revenue: Math.round(v.revenue), expense: Math.round(v.expense) })),
      revenueByWeekday: weekday.map(Math.round),
      topExpenseCategories: groupBy(expenses, (r) => r.expense_category).slice(0, 6),
      topRevenueSources: groupBy(revenue, (r) => r.source).slice(0, 6),
      paymentModes: groupBy(revenue, (r) => r.payment_mode),
    };

    let insights: Array<{ title: string; detail: string; severity: string }> = [];
    let insightError: string | null = null;
    try {
      insights = await aiInsights(summary);
    } catch (e) {
      insightError = (e as Error).message;
    }

    const annualProfit = revSeries.reduce((a, b) => a + b, 0) - expSeries.reduce((a, b) => a + b, 0);
    const taxable = Math.max(0, annualProfit);
    const estimatedTax =
      taxable <= 300000 ? 0 : taxable <= 700000 ? (taxable - 300000) * 0.05 : taxable <= 1000000 ? 20000 + (taxable - 700000) * 0.1 : 50000 + (taxable - 1000000) * 0.3;

    return {
      insights,
      insightError,
      forecast: {
        revenue: revF,
        expense: expF,
        patients: patF,
        profit: Math.round(revF.predicted - expF.predicted),
      },
      tax: {
        annualProfit: Math.round(annualProfit),
        estimatedAnnualTax: Math.round(estimatedTax),
        quarterlyAdvance: Math.round(estimatedTax / 4),
      },
      monthly: summary.months,
    };
  });

/** Budgets & Financial Goals management with current month tracking. */
export const getBudgetsAndGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ organizationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const currentMonth = dayKey(new Date()).slice(0, 7);
    const monthStart = `${currentMonth}-01`;
    const monthEnd = dayKey(new Date());

    const { data: budgets } = await supabase
      .from("finance_budgets")
      .select("*")
      .eq("organization_id", data.organizationId);

    const { data: goals } = await supabase
      .from("finance_goals")
      .select("*")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false });

    // Spending this month per expense category
    const rows = await fetchLedger(supabase, data.organizationId, monthStart, monthEnd);
    const expenses = rows.filter((r) => r.entry_type === "expense");
    const spentMap = new Map<string, number>();
    for (const e of expenses) {
      const cat = e.expense_category || "Miscellaneous";
      spentMap.set(cat, (spentMap.get(cat) ?? 0) + Number(e.net_amount));
    }

    const budgetList = (budgets ?? []).map((b: any) => {
      const spent = spentMap.get(b.category) ?? 0;
      const limit = Number(b.monthly_limit);
      return {
        ...b,
        spentThisMonth: spent,
        pct: limit > 0 ? Math.round((spent / limit) * 100) : 0,
      };
    });

    // Current month progress for financial goals
    const revenues = rows.filter((r) => r.entry_type === "revenue");
    const totalMonthRev = sum(revenues);
    const totalMonthExp = sum(expenses);
    const monthProfit = totalMonthRev - totalMonthExp;
    const patientCount = new Set(revenues.map((r) => r.patient_id).filter(Boolean)).size;
    const apptCount = revenues.length;
    const avgBill = apptCount > 0 ? Math.round(totalMonthRev / apptCount) : 0;

    const goalList = (goals ?? []).map((g: any) => {
      let currentVal = 0;
      if (g.goal_type === "revenue") currentVal = totalMonthRev;
      else if (g.goal_type === "profit") currentVal = monthProfit;
      else if (g.goal_type === "patients") currentVal = patientCount;
      else if (g.goal_type === "consultations") currentVal = apptCount;
      else if (g.goal_type === "avg_bill") currentVal = avgBill;

      const target = Number(g.target_value);
      return {
        ...g,
        current_value: currentVal,
        pct: target > 0 ? Math.min(100, Math.round((currentVal / target) * 100)) : 0,
      };
    });

    return { budgets: budgetList, goals: goalList, monthSpentTotal: totalMonthExp, monthRevenueTotal: totalMonthRev };
  });

export const saveBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        category: z.string().trim().min(1),
        monthlyLimit: z.number().nonnegative(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { error } = await supabase.from("finance_budgets").upsert(
      {
        organization_id: data.organizationId,
        category: data.category,
        monthly_limit: data.monthlyLimit,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,category" },
    );
    if (error) throw new Error(error.message);
    await supabase.from("finance_audit").insert({
      organization_id: data.organizationId,
      actor_id: userId,
      action: "set_budget",
      entity_type: "budget",
      amount: data.monthlyLimit,
      reason: `Set monthly budget for ${data.category} to ₹${data.monthlyLimit}`,
    });
    return { ok: true };
  });

export const saveGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        organizationId: z.string().uuid(),
        goalType: z.enum(["revenue", "profit", "patients", "consultations", "avg_bill"]),
        period: z.string().default("monthly"),
        targetValue: z.number().positive(),
        label: z.string().trim().max(100).optional(),
        isActive: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const payload = {
      organization_id: data.organizationId,
      goal_type: data.goalType,
      period: data.period,
      target_value: data.targetValue,
      label: data.label || null,
      is_active: data.isActive,
    };
    if (data.id) {
      const { error } = await supabase.from("finance_goals").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("finance_goals").insert(payload);
      if (error) throw new Error(error.message);
    }
    await supabase.from("finance_audit").insert({
      organization_id: data.organizationId,
      actor_id: userId,
      action: data.id ? "update_goal" : "create_goal",
      entity_type: "goal",
      amount: data.targetValue,
      reason: `Goal set for ${data.goalType}: ${data.targetValue}`,
    });
    return { ok: true };
  });

/** Immutable Audit Trail logs viewer. */
export const getAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        limit: z.number().min(1).max(500).default(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: logs, error } = await supabase
      .from("finance_audit")
      .select("*")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { logs: logs ?? [] };
  });

/** Detailed Tax & GST summary for CA export and filing reminders. */
export const getTaxReportData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RangeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const rows = await fetchLedger(supabase, data.organizationId, data.from, data.to, data.clinicId);
    const revenue = rows.filter((r) => r.entry_type === "revenue");
    const expenses = rows.filter((r) => r.entry_type === "expense");

    const outputGst = sum(revenue, "tax_amount");
    const inputGst = sum(expenses, "tax_amount");
    const gstPayable = Math.max(0, outputGst - inputGst);

    const exemptConsultations = sum(
      revenue.filter((r) => r.service_category === "consultation" || r.service_category === "followup_visit"),
    );
    const taxableProcedures = sum(
      revenue.filter((r) => r.service_category !== "consultation" && r.service_category !== "followup_visit"),
    );

    const totalRev = sum(revenue);
    const totalExp = sum(expenses);
    const netProfit = totalRev - totalExp;
    const annualProjectedProfit = Math.max(0, netProfit * (365 / Math.max(1, (new Date(data.to).getTime() - new Date(data.from).getTime()) / 864e5)));

    // New Tax Regime Slabs estimate (India AY 2026-27)
    const t = annualProjectedProfit;
    let taxEstimate = 0;
    if (t > 400000) {
      if (t <= 800000) taxEstimate = (t - 400000) * 0.05;
      else if (t <= 1200000) taxEstimate = 20000 + (t - 800000) * 0.1;
      else if (t <= 1600000) taxEstimate = 60000 + (t - 1200000) * 0.15;
      else if (t <= 2000000) taxEstimate = 120000 + (t - 1600000) * 0.2;
      else taxEstimate = 200000 + (t - 2000000) * 0.3;
    }

    const quarterlySchedule = [
      { quarter: "Q1 (15 June)", pct: "15%", amount: Math.round(taxEstimate * 0.15), dueDate: "June 15" },
      { quarter: "Q2 (15 Sept)", pct: "45%", amount: Math.round(taxEstimate * 0.45), dueDate: "September 15" },
      { quarter: "Q3 (15 Dec)", pct: "75%", amount: Math.round(taxEstimate * 0.75), dueDate: "December 15" },
      { quarter: "Q4 (15 March)", pct: "100%", amount: Math.round(taxEstimate * 1.0), dueDate: "March 15" },
    ];

    return {
      outputGst,
      inputGst,
      gstPayable,
      exemptConsultations,
      taxableProcedures,
      totalRevenue: totalRev,
      totalExpenses: totalExp,
      netProfit,
      annualProjectedProfit: Math.round(annualProjectedProfit),
      estimatedAnnualTax: Math.round(taxEstimate),
      quarterlySchedule,
      ledgerRows: rows,
    };
  });

/** Generates formatted weekly/daily WhatsApp financial summary. */
export const getWhatsAppSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organizationId: z.string().uuid(),
        period: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const days = data.period === "daily" ? 0 : data.period === "weekly" ? 6 : 29;
    const to = dayKey(new Date());
    const from = dayKey(new Date(Date.now() - days * 864e5));

    const rows = await fetchLedger(supabase, data.organizationId, from, to);
    const revenue = rows.filter((r) => r.entry_type === "revenue");
    const expenses = rows.filter((r) => r.entry_type === "expense");

    const totalRev = sum(revenue);
    const totalExp = sum(expenses);
    const profit = totalRev - totalExp;
    const patientCount = new Set(revenue.map((r) => r.patient_id).filter(Boolean)).size;
    const walkins = revenue.filter((r) => r.source === "walkin").length;
    const online = revenue.filter((r) => r.source && r.source.includes("online")).length;

    // Previous window comparison
    const prevFrom = dayKey(new Date(new Date(from).getTime() - (days + 1) * 864e5));
    const prevTo = dayKey(new Date(new Date(from).getTime() - 864e5));
    const prevRows = await fetchLedger(supabase, data.organizationId, prevFrom, prevTo);
    const prevRev = sum(prevRows.filter((r) => r.entry_type === "revenue"));
    const growth = prevRev > 0 ? Math.round(((totalRev - prevRev) / prevRev) * 100) : 0;
    const growthSign = growth >= 0 ? `+${growth}%` : `${growth}%`;

    const title = data.period === "daily" ? "Today's Clinic Summary" : data.period === "weekly" ? "This Week's Clinic Summary" : "This Month's Clinic Summary";
    const text =
      `📊 *${title}*\n\n` +
      `👨‍⚕️ Patients Seen: *${patientCount}*\n` +
      `🏥 Walk-ins: *${walkins}*\n` +
      `💻 Online / Remote: *${online}*\n\n` +
      `💰 Revenue: *₹${totalRev.toLocaleString()}*\n` +
      `💸 Expenses: *₹${totalExp.toLocaleString()}*\n` +
      `📊 Growth vs Prior Period: *${growthSign}*\n\n` +
      `_Generated automatically by Clinic Launchpad Financial Assistant._`;

    return { text, metrics: { totalRev, totalExp, profit, patientCount, walkins, online, growth } };
  });

/** Synchronize all clinic modules (Appointments, Invoices, Expenses, Pharmacy) into the double-entry Finance Ledger. */
export const syncAllClinicModulesToLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ organizationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { organizationId } = data;

    let apptCount = 0;
    let invCount = 0;
    let expCount = 0;

    // 1. Sync Completed & Paid Appointments into Finance Ledger
    const { data: appts } = await supabase
      .from("appointments")
      .select("id, clinic_id, patient_id, doctor_id, appointment_date, status, consultation_fee, payment_status, created_at")
      .eq("organization_id", organizationId)
      .in("status", ["completed", "confirmed"])
      .limit(1000);

    if (appts && appts.length > 0) {
      for (const a of appts) {
        const fee = Number(a.consultation_fee) || 500;
        const entryDate = a.appointment_date || a.created_at.slice(0, 10);

        // Check if ledger entry already exists for this appointment
        const { data: existing } = await supabase
          .from("finance_ledger")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("appointment_id", a.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from("finance_ledger").insert({
            organization_id: organizationId,
            clinic_id: a.clinic_id,
            entry_type: "revenue",
            entry_date: entryDate,
            source: "appointment_consultation",
            service_category: "OPD Consultation",
            payment_mode: a.payment_status === "paid" ? "upi" : "cash",
            patient_id: a.patient_id,
            doctor_id: a.doctor_id,
            appointment_id: a.id,
            gross_amount: fee,
            discount: 0,
            tax_amount: 0,
            net_amount: fee,
            notes: `OPD Consultation Revenue (Status: ${a.status})`,
          });
          apptCount++;
        }
      }
    }

    // 2. Sync Expenses into Finance Ledger
    const { data: expenses } = await supabase
      .from("expenses")
      .select("id, clinic_id, title, vendor, amount, gst_amount, category, payment_mode, date, bill_url, notes")
      .eq("organization_id", organizationId)
      .limit(1000);

    if (expenses && expenses.length > 0) {
      for (const e of expenses) {
        const { data: existing } = await supabase
          .from("finance_ledger")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("notes", `Expense ID: ${e.id}`)
          .maybeSingle();

        if (!existing) {
          await supabase.from("finance_ledger").insert({
            organization_id: organizationId,
            clinic_id: e.clinic_id,
            entry_type: "expense",
            entry_date: e.date,
            source: "clinic_expense",
            expense_category: e.category || "Miscellaneous",
            payment_mode: e.payment_mode || "cash",
            vendor: e.vendor || null,
            gross_amount: Number(e.amount),
            discount: 0,
            tax_amount: Number(e.gst_amount) || 0,
            net_amount: Number(e.amount),
            notes: `Expense ID: ${e.id}`,
          });
          expCount++;
        }
      }
    }

    return {
      syncedAppointments: apptCount,
      syncedExpenses: expCount,
      syncedInvoices: invCount,
      message: `Cross-module sync completed: ${apptCount} appointments & ${expCount} expenses synced into double-entry ledger!`,
    };
  });


