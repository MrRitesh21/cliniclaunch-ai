import type { SubscriptionSnapshot } from "@/lib/subscription.server";

/** Presentation only. Actual access is ALWAYS snapshot.can_read/can_write. */
export function trialMessage(s: SubscriptionSnapshot): string {
  if (s.effective_state === "grace_period")
    return "Trial expired. Existing clinic data is read-only during your grace period. Billing, account management and export remain available.";
  if (
    !s.can_read &&
    s.effective_state !== "trialing" &&
    s.effective_state !== "active" &&
    s.effective_state !== "past_due"
  )
    return "Clinic operations are paused. Choose a plan or export your clinic data. Expiry does not delete your records.";
  if (s.effective_state === "past_due")
    return "Payment failed. Please update your payment method to keep clinic operations active.";
  if (s.effective_state !== "trialing") return "Your ClinicX subscription";
  const start = Date.parse(s.subscription?.trial_started_at ?? "");
  const end = Date.parse(s.subscription?.trial_ends_at ?? "");
  const now = Date.parse(s.server_now);
  if (![start, end, now].every(Number.isFinite)) return "Your ClinicX free trial";
  const day = Math.max(0, Math.floor((now - start) / 86400000));
  const left = Math.max(0, Math.ceil((end - now) / 86400000));
  if (day >= 21)
    return `Your ClinicX trial ends in ${left} ${left === 1 ? "day" : "days"}. Compare plans when you're ready.`;
  if (day >= 15)
    return "You're halfway through your ClinicX trial. Explore your clinic activity below.";
  if (day >= 7) return "Your first week with ClinicX — see your clinic activity below.";
  if (day === 0) return "Welcome to ClinicX. Your 30-day free trial has started.";
  return "Complete your clinic setup to get the most from ClinicX.";
}

export interface ActivationClinic {
  clinic_name?: string | null;
  doctor_name?: string | null;
  specialization?: string | null;
  working_hours?: unknown;
  is_published?: boolean;
  booking_enabled?: boolean;
  invoicing_configured?: boolean;
  consultation_fee?: number | null;
}
export function activationSteps(u: SubscriptionSnapshot["usage"] | undefined | null, clinic: ActivationClinic | null) {
  const usage = u ?? ({} as Partial<NonNullable<SubscriptionSnapshot["usage"]>>);
  const doctorsCount = usage.doctors ?? 0;
  const patientsCount = usage.patients ?? 0;
  const appointmentsCount = usage.appointments ?? 0;
  const prescriptionsCount = usage.prescriptions ?? 0;

  const wh = clinic?.working_hours as {
    start?: string;
    end?: string;
    days?: unknown[];
    billing_configured?: boolean;
    billing_settings?: unknown;
  } | null;
  const hours = !!wh?.start && !!wh.end && Array.isArray(wh.days) && wh.days.length > 0;
  const isBillingConfigured =
    (typeof clinic?.consultation_fee === "number" && clinic.consultation_fee > 0) ||
    wh?.billing_configured === true ||
    wh?.billing_settings != null ||
    clinic?.invoicing_configured === true;

  const hasDoctor =
    doctorsCount > 0 ||
    Boolean(clinic?.doctor_name && clinic.doctor_name.trim().length > 0);

  return [
    {
      key: "profile",
      label: "Complete clinic profile",
      done:
        !!clinic?.clinic_name?.trim() &&
        !!clinic?.doctor_name?.trim() &&
        !!clinic?.specialization?.trim(),
      to: "/dashboard/settings",
    },
    { key: "doctor", label: "Add doctor", done: hasDoctor, to: "/dashboard/doctors" },
    { key: "hours", label: "Set clinic hours", done: hours, to: "/dashboard/settings" },
    { key: "patient", label: "Add first patient", done: patientsCount > 0, to: "/dashboard/patients" },
    {
      key: "appointment",
      label: "Create appointment",
      done: appointmentsCount > 0,
      to: "/dashboard/appointments",
    },
    {
      key: "prescription",
      label: "Create prescription",
      done: prescriptionsCount > 0,
      to: "/dashboard/prescriptions",
    },
    {
      key: "billing",
      label: "Configure billing & OPD fees",
      done: isBillingConfigured,
      to: "/dashboard/finance?tab=settings",
    },
    {
      key: "booking",
      label: "Configure online booking",
      done: clinic?.is_published === true && hours,
      to: "/dashboard/settings",
    },
  ];
}

export interface PriceCatalog {
  monthly_price: number;
  yearly_price: number;
  discounted_monthly_price?: number | null;
  discounted_yearly_price?: number | null;
}
export function pricePresentation(p: PriceCatalog, cycle: "monthly" | "yearly") {
  const validOffer = (base: number, offer?: number | null) =>
    typeof offer === "number" && offer >= 0 && offer < base ? offer : base;
  const monthly = validOffer(p.monthly_price, p.discounted_monthly_price);
  const yearly = validOffer(p.yearly_price, p.discounted_yearly_price);
  const original = cycle === "monthly" ? p.monthly_price : p.yearly_price;
  const total = cycle === "monthly" ? monthly : yearly;
  return {
    total,
    original,
    discounted: total < original,
    savings: Math.max(0, monthly * 12 - yearly),
  };
}
export function limitPresentation(used: number, limit: number | null | undefined) {
  if (limit === null) return { text: `${used.toLocaleString("en-IN")} / Unlimited`, percent: null };
  if (limit === undefined)
    return { text: `${used.toLocaleString("en-IN")} / Not configured`, percent: null };
  return {
    text: `${used.toLocaleString("en-IN")} / ${limit.toLocaleString("en-IN")}`,
    percent: limit === 0 ? (used > 0 ? 100 : 0) : Math.min(100, (used / limit) * 100),
  };
}

export const CLINIC_EXPORT_TABLES = [
  "patients",
  "appointments",
  "patient_visits",
  "patient_attachments",
  "prescriptions",
  "prescription_items",
  "patient_invoices",
  "patient_invoice_items",
  "patient_payments",
  "clinics",
  "doctors",
] as const;
type ExportTable = (typeof CLINIC_EXPORT_TABLES)[number];
type ExportPage = {
  table: string;
  records: Record<string, unknown>[];
  next_cursor: string | null;
  has_more: boolean;
};
export async function collectClinicBackup(
  organizationId: string,
  fetchPage: (request: {
    organizationId: string;
    table: ExportTable;
    cursor: string | null;
    limit: number;
  }) => Promise<ExportPage>,
) {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const counts: Record<string, number> = {};
  for (const table of CLINIC_EXPORT_TABLES) {
    let cursor: string | null = null;
    const cursors = new Set<string>();
    const records = new Map<string, Record<string, unknown>>();
    for (;;) {
      const page = await fetchPage({ organizationId, table, cursor, limit: 500 });
      if (page.table !== table) throw new Error("Export table response mismatch");
      for (const row of page.records) {
        if (typeof row.id !== "string") throw new Error("Export record identifier missing");
        records.set(row.id, row);
      }
      if (!page.has_more) break;
      if (!page.next_cursor || page.next_cursor === cursor || cursors.has(page.next_cursor))
        throw new Error("Export cursor did not advance");
      cursor = page.next_cursor;
      cursors.add(cursor);
    }
    tables[table] = Array.from(records.values());
    counts[table] = records.size;
  }
  return {
    format: "clinicx-json-backup-v1",
    organization_id: organizationId,
    tables,
    counts,
    total_records: Object.values(counts).reduce((sum, n) => sum + n, 0),
    consistent_snapshot: false,
  };
}

type BillingCursor = { created_at: string; id: string };
interface CompositeBillingPage {
  kind: string;
  currency: string;
  amount_unit: string;
  entries: Record<string, unknown>[];
  has_more: boolean;
  next_cursor: BillingCursor | null;
}
/** Reject malformed/nonadvancing pages before displaying canonical money. */
export function mergeBillingPage<T extends CompositeBillingPage>(previous: T | null, page: T): T {
  if (
    page.currency !== "INR" ||
    page.amount_unit !== (page.kind === "legacy_invoices" ? "unclassified" : "paise")
  )
    throw new Error("Billing amount unit mismatch");
  if (previous && page.kind !== previous.kind) throw new Error("Billing history kind mismatch");
  const old = previous?.next_cursor;
  const next = page.next_cursor;
  if (
    page.has_more &&
    (!next ||
      !page.entries.length ||
      (old &&
        (next.created_at > old.created_at ||
          (next.created_at === old.created_at && next.id >= old.id))))
  )
    throw new Error("Billing cursor did not advance");
  const rows = new Map<string, Record<string, unknown>>();
  for (const row of [...(previous?.entries ?? []), ...page.entries]) {
    if (typeof row.id !== "string") throw new Error("Billing entry identifier missing");
    rows.set(row.id, row);
  }
  return { ...page, entries: [...rows.values()] };
}

export function recoveryRoute(path: string): boolean {
  return [
    "/dashboard/billing",
    "/dashboard/settings",
    "/dashboard/account",
    "/dashboard/export",
    "/dashboard/support",
  ].some((route) => path === route || path.startsWith(`${route}/`));
}
