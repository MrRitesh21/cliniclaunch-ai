import { z } from "zod";

const count = z.number().finite().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const money = z.number().finite().nonnegative();
const date = z.string().datetime({ offset: true });
const nullableDate = date.nullable();
const nullableText = z.string().nullable();
const cohort = z.enum(["production", "test", "internal", "fraud"]);
export const adminCustomerPageInput = z
  .object({
    page: z.number().int().min(0).max(100000).default(0),
    pageSize: z.number().int().min(1).max(100).default(50),
    filter: z
      .enum(["trialing", "ending_soon", "paid", "expired_trial", "past_due", "excluded"])
      .optional(),
  })
  .optional();
export const adminCustomerInput = z.object({
  clinicId: z.string().uuid(),
  paymentPage: z.number().int().min(0).max(100000).default(0),
  eventPage: z.number().int().min(0).max(100000).default(0),
  pageSize: z.number().int().min(1).max(100).default(50),
});
export const adminBillingStatsSchema = z.object({
  asOf: date,
  timezone: z.literal("UTC"),
  totalClinics: count,
  totalDoctors: count,
  totalCustomers: count,
  excludedClinics: count,
  newThisWeek: count,
  newSignupsToday: count,
  paidCustomers: count,
  activeSubs: count,
  trialSubs: count,
  trialsEndingSoon: count,
  expiredTrials: count,
  mrr: money,
  arr: money,
  averageRevenuePerClinic: money.nullable(),
  eligibleCompletedTrials: count,
  convertedTrials: count,
  conversionRate: money.max(100).nullable(),
  openingPaidCustomers: count,
  churnedCustomers: count,
  expiredThisMonth: count,
  churnRate: money.max(100).nullable(),
  failedPayments: count,
  failedPaymentCustomers: count,
  legacyUnverifiedSubscriptions: count,
  planDistribution: z.array(z.object({ planId: z.string(), customers: count })),
  statusDistribution: z.array(z.object({ status: z.string(), customers: count })),
  recentClinics: z.array(
    z.object({
      id: z.string().uuid(),
      clinic_name: z.string(),
      doctor_name: z.string(),
      specialization: nullableText,
      address: nullableText,
      created_at: date,
      slug: z.string(),
    }),
  ),
  expiringSubs: z.array(
    z.object({
      id: z.string().uuid(),
      organization_id: z.string().uuid(),
      status: z.string(),
      trial_ends_at: nullableDate,
      current_period_end: nullableDate,
      plan_id: nullableText,
    }),
  ),
  signupsDaily: z.array(z.object({ date: z.string(), count })),
  recentTransactions: z.array(
    z.object({
      id: z.string().uuid(),
      plan: z.string(),
      billing_cycle: z.string(),
      amount: money,
      created_at: date,
    }),
  ),
});
export const adminCustomerPageSchema = z.object({
  totalCount: count,
  page: count,
  pageSize: count,
  hasMore: z.boolean(),
  asOf: date,
  timezone: z.literal("UTC"),
  subscriptions: z.array(
    z.object({
      id: z.string().uuid(),
      clinicId: z.string().uuid(),
      subscriptionId: z.string().uuid().nullable(),
      organizationId: nullableText,
      clinicName: z.string(),
      doctorName: z.string(),
      joined: date,
      planId: nullableText,
      plan: z.string(),
      storedStatus: nullableText,
      status: z.string(),
      start: nullableDate,
      end: nullableDate,
      renewalDate: nullableDate,
      trialStart: nullableDate,
      trialEnd: nullableDate,
      graceEnd: nullableDate,
      billingCycle: nullableText,
      cancelAtPeriodEnd: z.boolean().nullable(),
      razorpayId: z.string(),
      accessSource: nullableText,
      cohort,
      paid: z.boolean(),
      amount: money.nullable(),
      monthlyRecurringInr: money.nullable(),
    }),
  ),
});
const subscription = z.object({
  id: z.string().uuid(),
  plan_id: nullableText,
  status: z.string(),
  billing_cycle: z.string(),
  trial_started_at: nullableDate,
  trial_ends_at: nullableDate,
  grace_ends_at: nullableDate,
  current_period_start: nullableDate,
  current_period_end: nullableDate,
  cancel_at_period_end: z.boolean(),
  access_source: z.string(),
});
const payment = z.object({
  id: z.string().uuid(),
  payment_id: z.string(),
  invoice_id: z.string(),
  amount_paise: count,
  plan_id: z.string(),
  billing_cycle: z.string(),
  period_start: date,
  period_end: date,
  created_at: date,
  status: z.literal("captured"),
  currency: z.literal("INR"),
});
const event = z.object({
  id: z.string().uuid(),
  kind: z.string(),
  effective_at: date,
  recorded_at: date,
});
const page = <T extends z.ZodTypeAny>(record: T) =>
  z.object({
    records: z.array(record),
    total: count,
    page: count,
    pageSize: count,
    hasMore: z.boolean(),
  });
export const adminCustomerSchema = z.object({
  asOf: date,
  timezone: z.literal("UTC"),
  clinic: z.object({
    id: z.string().uuid(),
    organization_id: z.string().uuid(),
    clinic_name: z.string(),
    doctor_name: z.string(),
    owner_id: nullableText,
    email: nullableText,
  }),
  plan: z
    .object({ id: z.string(), name: z.string(), monthly_price: money, yearly_price: money })
    .nullable(),
  owner: z.object({ id: nullableText, email: nullableText, name: nullableText }),
  subscription: subscription.nullable(),
  effectiveState: z.string(),
  cohort,
  usage: z.record(z.union([z.number().finite(), z.string(), z.array(z.string()), z.null()])),
  payments: page(payment),
  events: page(event),
  legacyPaymentsNotVerified: count,
});

/** Fail closed: no unknown payload, nonfinite counts, partial zero fallback or PHI. */
export function parseAdminBilling<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error("Invalid admin billing response");
  return parsed.data;
}
export function utcDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? `${parsed.toISOString().replace("T", " ").slice(0, 19)} UTC`
    : "—";
}
