import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { billingRpc, createBillingService, type BillingTransport } from "@/lib/billing.server";

const organization = z.object({ organization_id: z.string().uuid() });
const checkout = z.object({
  organization_id: z.string().uuid(),
  plan_id: z.string().min(1).max(64),
  billing_cycle: z.enum(["monthly", "yearly"]),
  coupon_code: z.string().trim().min(1).max(64).optional(),
});
const callback = z.object({
  subscription_id: z.string().regex(/^sub_[A-Za-z0-9]{1,64}$/),
  payment_id: z.string().regex(/^pay_[A-Za-z0-9]{1,64}$/),
  signature: z.string().regex(/^[a-f0-9]{64}$/),
  organization_id: z.string().uuid().optional(),
  attempt_id: z.string().uuid().optional(),
});
async function service(transport: unknown) {
  const [{ supabaseAdmin }, provider] = await Promise.all([
    import("@/integrations/supabase/client.server"),
    import("@/lib/razorpay.server"),
  ]);
  // Local explicit RPC interface pending generated Supabase schema regeneration.
  return createBillingService(
    transport as BillingTransport,
    supabaseAdmin as unknown as BillingTransport,
    provider,
  );
}

export const startRazorpaySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => checkout.parse(i))
  .handler(async ({ data, context }) => {
    if (!process.env.RAZORPAY_KEY_ID?.trim())
      throw new Error("Razorpay checkout key is not configured");
    return {
      ...(await (await service(context.supabase)).start(data)),
      key_id: process.env.RAZORPAY_KEY_ID,
    };
  });

/** Deprecated ₹1/14-day mandate path is intentionally closed. Free trial uses provisionClinicTrial only. */
export const startOnboardingTrialSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => checkout.parse(i))
  .handler(async () => {
    throw new Error(
      "Use provisionClinicTrial for the server-owned 30-day free trial; no provider payment is required",
    );
  });

export const activateRazorpaySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => callback.parse(i))
  .handler(async ({ data, context }) => (await service(context.supabase)).activate(data));

export const verifySubscriptionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        subscription_id: z.string().regex(/^sub_[A-Za-z0-9]{1,64}$/),
        organization_id: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => (await service(context.supabase)).status(data));

export const cancelRazorpaySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => organization.extend({ reason: z.string().trim().max(500).optional() }).parse(i))
  .handler(async ({ data, context }) =>
    (await service(context.supabase)).cancel(data.organization_id, data.reason),
  );

/** Resume is only for a provider merchant-paused mandate; never creates an overlapping subscription. */
export const resumeRazorpaySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => organization.parse(i))
  .handler(async ({ data, context }) => (await service(context.supabase)).resume(data.organization_id));

export const changeRazorpaySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => checkout.omit({ coupon_code: true }).parse(i))
  .handler(async ({ data, context }) => (await service(context.supabase)).change(data));

export const reconcileRecurringSubscriptionCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => organization.extend({command_id:z.string().uuid()}).parse(i))
  .handler(async ({ data, context }) =>
    (await service(context.supabase)).reconcileCommand(data.organization_id,data.command_id));

export const getSubscriptionRenewalQuote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => organization.parse(i))
  .handler(async ({ data, context }) => (await service(context.supabase)).renewal(data.organization_id));

export const getSubscriptionInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => organization.extend({invoice_id:z.string().uuid()}).parse(i))
  .handler(async ({ data, context }) => z.object({
    id:z.string().uuid(),organization_id:z.string().uuid(),invoice_number:z.string(),
    payment_id:z.string(),provider_invoice_id:z.string(),provider_subscription_id:z.string(),
    amount_paise:z.number().int().positive().safe(),currency:z.literal("INR"),amount_unit:z.literal("paise"),
    status:z.literal("paid"),paid_at:z.string().nullable(),period_start:z.string().nullable(),period_end:z.string().nullable(),
    provider_plan_id:z.string().nullable(),plan_id:z.string().nullable(),billing_cycle:z.enum(["monthly","yearly"]).nullable(),authority_version:z.literal("clinicx-v1"),
  }).parse(await billingRpc(context.supabase as unknown as BillingTransport,"clinicx_invoice_detail",{p_org:data.organization_id,p_invoice:data.invoice_id})));

export const listSubscriptionBillingPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => organization.extend({
    kind:z.enum(["payments","invoices","legacy_invoices"]),limit:z.number().int().min(1).max(100).default(50),
    cursor:z.object({created_at:z.string().datetime({offset:true}),id:z.string().uuid()}).nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => z.object({
    kind:z.enum(["payments","invoices","legacy_invoices"]),currency:z.literal("INR"),amount_unit:z.enum(["paise","unclassified"]),
    entries:z.array(z.record(z.union([z.string(),z.number().finite(),z.boolean(),z.null()]))),has_more:z.boolean(),
    next_cursor:z.object({created_at:z.string(),id:z.string().uuid()}).nullable(),
  }).parse(await billingRpc(context.supabase as unknown as BillingTransport,"clinicx_billing_history_page",{
    p_org:data.organization_id,p_kind:data.kind,p_before_time:data.cursor?.created_at??null,p_before_id:data.cursor?.id??null,p_limit:data.limit,
  })));

export const syncRazorpaySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    organization
      .extend({
        payment_id: z
          .string()
          .regex(/^pay_[A-Za-z0-9]{1,64}$/)
          .optional(),
        subscription_id: z
          .string()
          .regex(/^sub_[A-Za-z0-9]{1,64}$/)
          .optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) =>
    (await service(context.supabase)).reconcile(
      data.organization_id,
      data.payment_id,
      data.subscription_id,
    ),
  );

export const checkSubscriptionDowngrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ organization_id: z.string().uuid(), plan_id: z.string().min(1).max(64) }).parse(i),
  )
  .handler(async ({ data, context }) =>
    z
      .object({
        allowed: z.boolean(),
        usage: z.object({
          patients: z.number(),
          staff: z.number(),
          doctors: z.number(),
          pending_staff_invites: z.number(),
        }),
        violations: z.array(z.object({ limit: z.string(), used: z.number(), maximum: z.number() })),
      })
      .parse(
        await billingRpc(
          context.supabase as unknown as BillingTransport,
          "clinicx_downgrade_check",
          { p_org: data.organization_id, p_plan: data.plan_id },
        ),
      ),
  );

export const listSubscriptionPaymentHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        cursor: z.string().datetime().nullable().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) =>
    z
      .object({
        currency: z.literal("INR"),
        amount_unit: z.literal("paise"),
        payments: z.array(
          z.object({
            id: z.string(),
            payment_id: z.string(),
            amount_paise: z.number().int(),
            status: z.string(),
            created_at: z.string(),
          }),
        ),
        invoices: z.array(
          z.object({
            id: z.string(),
            invoice_number: z.string(),
            canonical_payment_id: z.string(),
            amount_paise: z.number().int(),
            status: z.string(),
            paid_at: z.string().nullable(),
            created_at: z.string(),
          }),
        ),
        legacy_invoices: z.array(
          z.object({
            id: z.string(),
            invoice_number: z.string(),
            historical_amount: z.number(),
            authority_version: z.string().nullable(),
            created_at: z.string(),
          }),
        ),
      })
      .parse(
        await billingRpc(
          context.supabase as unknown as BillingTransport,
          "clinicx_billing_history",
          { p_org: data.organization_id, p_cursor: data.cursor ?? null, p_limit: data.limit ?? 50 },
        ),
      ),
  );

export const listBillingReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => organization.parse(i))
  .handler(async ({ data, context }) =>
    z
      .array(
        z.object({
          id: z.string(),
          kind: z.string(),
          severity: z.string(),
          title: z.string(),
          body: z.string().nullable(),
          created_at: z.string(),
        }),
      )
      .parse(
        await billingRpc(
          context.supabase as unknown as BillingTransport,
          "clinicx_billing_reminders",
          { p_org: data.organization_id },
        ),
      ),
  );

export const dismissBillingReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ organization_id: z.string().uuid(), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await billingRpc(
      context.supabase as unknown as BillingTransport,
      "clinicx_dismiss_billing_reminder",
      { p_org: data.organization_id, p_id: data.id },
    );
    return { ok: true };
  });

// Existing coupon UI can display a clear gate; discounts must not be improvised with upfront addon/setup payments.
export const validateCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        code: z.string().trim().min(1).max(64),
        plan_id: z.string().min(1),
        billing_cycle: z.enum(["monthly", "yearly"]),
        base_amount: z.number().int().positive(),
      })
      .parse(i),
  )
  .handler(async () => {
    throw new Error(
      "Discount checkout is unavailable until provider offers and canonical first-cycle amounts are reconciled",
    );
  });
