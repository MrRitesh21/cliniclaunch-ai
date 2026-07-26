import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Coupon validation (server-authoritative) ----------
export const validateCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      code: z.string().trim().min(1).max(64),
      plan_id: z.string().min(1),
      billing_cycle: z.enum(["monthly", "yearly"]),
      base_amount: z.number().int().positive(), // in rupees
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.code.toUpperCase();
    const { data: row } = await supabaseAdmin
      .from("coupon_codes")
      .select("*")
      .eq("code", code)
      .eq("is_active", true)
      .maybeSingle();
    if (!row) throw new Error("Invalid coupon code");
    const c = row as {
      code: string; discount_type: string; discount_value: number;
      max_uses: number | null; uses_count: number | null;
      expires_at: string | null; applicable_plan: string | null;
      razorpay_offer_id?: string | null;
    };
    if (c.expires_at && new Date(c.expires_at) < new Date()) throw new Error("Coupon has expired");
    if (c.max_uses != null && (c.uses_count ?? 0) >= c.max_uses) throw new Error("Coupon usage limit reached");
    if (c.applicable_plan && c.applicable_plan !== "all" && c.applicable_plan !== data.plan_id) {
      throw new Error("Coupon not applicable to this plan");
    }
    let discount_rupees = 0;
    if (c.discount_type === "percent") {
      discount_rupees = Math.round((data.base_amount * c.discount_value) / 100);
    } else if (c.discount_type === "fixed" || c.discount_type === "amount") {
      discount_rupees = Math.min(c.discount_value, data.base_amount);
    } else {
      throw new Error("Unsupported coupon type");
    }
    const final_rupees = Math.max(0, data.base_amount - discount_rupees);
    return {
      code: c.code,
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      discount_rupees,
      final_rupees,
      razorpay_offer_id: c.razorpay_offer_id ?? null,
    };
  });

export const startRazorpaySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      plan_id: z.string().min(1),
      billing_cycle: z.enum(["monthly", "yearly"]),
      organization_id: z.string().uuid(),
      coupon_code: z.string().trim().min(1).max(64).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Owner check
    const { data: orgRow } = await supabaseAdmin
      .from("organizations")
      .select("id, name")
      .eq("id", data.organization_id)
      .maybeSingle();
    if (!orgRow) throw new Error("Organization not found");
    const { data: member } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("organization_id", data.organization_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member || !["owner", "admin"].includes((member as { role?: string }).role ?? "")) {
      throw new Error("Only owners/admins can start a subscription");
    }

    const { data: plan } = await supabaseAdmin.from("plans").select("*").eq("id", data.plan_id).maybeSingle();
    if (!plan) throw new Error("Plan not found");
    const p = plan as { id: string; name: string; monthly_price: number; yearly_price: number };
    let rupees = data.billing_cycle === "monthly" ? p.monthly_price : p.yearly_price;
    if (!rupees || rupees <= 0) throw new Error("This plan cannot be purchased");

    // Apply coupon server-side (never trust client discount).
    // IMPORTANT: coupons discount only the FIRST billing cycle. The Razorpay
    // plan / autopay mandate is always created at the FULL plan price so that
    // every subsequent renewal charges the normal amount.
    let couponCode: string | null = null;
    let discountRupees = 0;
    let razorpayOfferId: string | null = null;
    if (data.coupon_code) {
      const code = data.coupon_code.toUpperCase();
      const { data: row } = await supabaseAdmin
        .from("coupon_codes")
        .select("*")
        .eq("code", code)
        .eq("is_active", true)
        .maybeSingle();
      if (!row) throw new Error("Invalid coupon code");
      const c = row as { code: string; discount_type: string; discount_value: number; max_uses: number | null; uses_count: number | null; expires_at: string | null; applicable_plan: string | null; razorpay_offer_id?: string | null };
      if (c.expires_at && new Date(c.expires_at) < new Date()) throw new Error("Coupon has expired");
      if (c.max_uses != null && (c.uses_count ?? 0) >= c.max_uses) throw new Error("Coupon usage limit reached");
      if (c.applicable_plan && c.applicable_plan !== "all" && c.applicable_plan !== data.plan_id) {
        throw new Error("Coupon not applicable to this plan");
      }
      if (c.discount_type === "percent") discountRupees = Math.round((rupees * c.discount_value) / 100);
      else discountRupees = Math.min(c.discount_value, rupees);
      // Cap discount so at least ₹1 is charged on the first cycle.
      discountRupees = Math.min(discountRupees, rupees - 1);
      couponCode = c.code;
      razorpayOfferId = c.razorpay_offer_id ?? null;
    }

    const { createOrGetPlan, createSubscription } = await import("@/lib/razorpay.server");
    // Plan is always at FULL price — coupon never affects the mandate amount.
    const amountPaise = Math.round(rupees * 100);
    const planKey = `${p.id}_${data.billing_cycle}_${amountPaise}`;
    const rzpPlanId = await createOrGetPlan(planKey, {
      name: `${p.name} · ${data.billing_cycle}`,
      amount_paise: amountPaise,
      interval: data.billing_cycle,
    });

    // First-cycle discount via Razorpay Offer (only applies to cycle 1).
    let offerId: string | null = null;
    let upfrontAmountPaise: number | undefined;
    let startAt: number | undefined;

    if (couponCode && discountRupees > 0) {
      if (razorpayOfferId) {
        offerId = razorpayOfferId;
      } else {
        // Fallback: collect the discounted price upfront and shift subscription start date by 1 cycle.
        const finalRupees = Math.max(1, rupees - discountRupees);
        upfrontAmountPaise = Math.round(finalRupees * 100);
        
        const nowSecs = Math.floor(Date.now() / 1000);
        const cycleSeconds = data.billing_cycle === "yearly" 
          ? 365 * 24 * 60 * 60 
          : 30 * 24 * 60 * 60; // 30 days
        startAt = nowSecs + cycleSeconds;
      }
    }
    // Fetch billing notify contact separately (columns are `public_email`/`public_phone`/`owner_id`).
    const { data: clinicRow } = await supabaseAdmin
      .from("clinics")
      .select("public_email, public_phone, owner_id")
      .eq("organization_id", data.organization_id)
      .limit(1)
      .maybeSingle();
    const contact = (clinicRow as { public_email?: string | null; public_phone?: string | null; owner_id?: string | null } | null) ?? {};
    const sub = await createSubscription(rzpPlanId, {
      organization_id: data.organization_id,
      doctor_id: contact.owner_id || "",
      plan_id: data.plan_id,
      billing_cycle: data.billing_cycle,
      ...(couponCode ? { coupon_code: couponCode } : {}),
      ...(offerId ? { __offer_id: offerId } : {}),
      ...(contact.public_email ? { notify_email: contact.public_email } : {}),
      ...(contact.public_phone ? { notify_phone: contact.public_phone } : {}),
    }, {
      startAt,
      upfrontAmountPaise,
    });

    // Persist local pending subscription
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin
        .from("subscriptions")
        .update({
          plan_id: data.plan_id,
          billing_cycle: data.billing_cycle,
          status: "pending",
          gateway: "razorpay" as never,
          gateway_subscription_id: sub.id as never,
        } as never)
        .eq("id", (existing as { id: string }).id);
    } else {
      await supabaseAdmin.from("subscriptions").insert({
        organization_id: data.organization_id,
        plan_id: data.plan_id,
        billing_cycle: data.billing_cycle,
        status: "pending",
        gateway: "razorpay",
        gateway_subscription_id: sub.id,
      } as never);
    }

    return {
      subscription_id: sub.id,
      short_url: sub.short_url,
      key_id: process.env.RAZORPAY_KEY_ID!,
    };
  });

export const startOnboardingTrialSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      plan_id: z.string().min(1),
      billing_cycle: z.enum(["monthly", "yearly"]),
      organization_id: z.string().uuid(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: plan } = await supabaseAdmin.from("plans").select("*").eq("id", data.plan_id).maybeSingle();
    if (!plan) throw new Error("Plan not found");
    const p = plan as { id: string; name: string; monthly_price: number; yearly_price: number };
    let rupees = data.billing_cycle === "monthly" ? p.monthly_price : p.yearly_price;
    if (!rupees || rupees <= 0) throw new Error("This plan cannot be purchased");

    const { createOrGetPlan, createSubscription } = await import("@/lib/razorpay.server");
    const amountPaise = Math.round(rupees * 100);
    const planKey = `${p.id}_${data.billing_cycle}_${amountPaise}`;
    const rzpPlanId = await createOrGetPlan(planKey, {
      name: `${p.name} · ${data.billing_cycle}`,
      amount_paise: amountPaise,
      interval: data.billing_cycle,
    });

    const nowSecs = Math.floor(Date.now() / 1000);
    const startAt = nowSecs + 14 * 24 * 60 * 60; // 14 days
    const upfrontAmountPaise = 100; // ₹1

    const { data: clinicRow } = await supabaseAdmin
      .from("clinics")
      .select("owner_id")
      .eq("organization_id", data.organization_id)
      .limit(1)
      .maybeSingle();
    const doctorId = clinicRow?.owner_id || null;

    const sub = await createSubscription(rzpPlanId, {
      organization_id: data.organization_id,
      doctor_id: doctorId || "",
      plan_id: data.plan_id,
      billing_cycle: data.billing_cycle,
      coupon_code: "Trial Activation",
    }, {
      startAt,
      upfrontAmountPaise,
    });

    // Persist local pending subscription using upsert on organization_id
    await supabaseAdmin.from("subscriptions").upsert({
      organization_id: data.organization_id,
      plan_id: data.plan_id,
      billing_cycle: data.billing_cycle,
      status: "pending",
      gateway: "razorpay" as never,
      gateway_subscription_id: sub.id as never,
    } as never, { onConflict: "organization_id" });

    return {
      subscription_id: sub.id,
      short_url: sub.short_url,
      key_id: process.env.RAZORPAY_KEY_ID!,
    };
  });

export const cancelRazorpaySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ organization_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("organization_id", data.organization_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member || !["owner", "admin"].includes((member as { role?: string }).role ?? "")) {
      throw new Error("Only owners/admins can cancel");
    }
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("id, gateway, gateway_subscription_id")
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    if (!sub) throw new Error("No subscription");
    const s = sub as { id: string; gateway?: string | null; gateway_subscription_id?: string | null };
    if (s.gateway === "razorpay" && s.gateway_subscription_id) {
      const { cancelSubscription } = await import("@/lib/razorpay.server");
      await cancelSubscription(s.gateway_subscription_id);
      await supabaseAdmin
        .from("subscriptions")
        .update({ cancel_at_period_end: true } as never)
        .eq("id", s.id);
    } else {
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "cancelled" } as never)
        .eq("id", s.id);
    }
    return { ok: true };
  });

async function getSubscriptionWithRetry(subscriptionId: string) {
  const { getSubscription } = await import("@/lib/razorpay.server");
  let sub;
  for (let i = 0; i < 5; i++) {
    try {
      sub = await getSubscription(subscriptionId);
      if (sub.status === "active" || sub.status === "authenticated") {
        return sub;
      }
    } catch (err) {
      console.warn("Retry getSubscription error:", err);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return sub;
}

export const verifySubscriptionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ subscription_id: z.string() }).parse(i))
  .handler(async ({ data }) => {
    const sub = await getSubscriptionWithRetry(data.subscription_id);
    const active = sub && (sub.status === "active" || sub.status === "authenticated");
    if (!active) {
      throw new Error(`Subscription status is ${sub?.status ?? "created"}, not active yet.`);
    }
    return { active: true };
  });

export const activateRazorpaySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ subscription_id: z.string(), payment_id: z.string().optional() }).parse(i))
  .handler(async ({ data }) => {
    const { getPayment } = await import("@/lib/razorpay.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch subscription details directly from Razorpay API to verify (with retry)
    const sub = await getSubscriptionWithRetry(data.subscription_id);
    
    // Status can be active or authenticated (meaning checkout succeeded, mandate authorized)
    const isActive = sub && (sub.status === "active" || sub.status === "authenticated");
    if (!isActive) {
      throw new Error(`Subscription status is ${sub?.status ?? "created"}, not active yet.`);
    }

    const orgId = sub.notes?.organization_id;
    const planId = sub.notes?.plan_id;
    const billingCycle = sub.notes?.billing_cycle;

    if (!orgId) {
      throw new Error("No organization_id found in subscription notes");
    }

    const isTrial = sub.status === "authenticated";
    const patch: Record<string, unknown> = {
      status: isTrial ? "trialing" : "active",
      gateway: "razorpay" as never,
      gateway_subscription_id: sub.id as never,
      ...(planId ? { plan_id: planId } : {}),
      ...(billingCycle ? { billing_cycle: billingCycle } : {}),
    };

    if (sub.current_start) {
      patch.current_period_start = new Date(sub.current_start * 1000).toISOString();
    } else if (isTrial) {
      patch.current_period_start = new Date().toISOString();
    }
    if (sub.current_end) {
      patch.current_period_end = new Date(sub.current_end * 1000).toISOString();
      if (isTrial) {
        patch.trial_ends_at = patch.current_period_end;
      }
    } else if (isTrial && sub.start_at) {
      const trialEndDate = new Date(sub.start_at * 1000).toISOString();
      patch.current_period_end = trialEndDate;
      patch.trial_ends_at = trialEndDate;
    }

    // Update in database immediately
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("subscriptions")
        .update(patch as never)
        .eq("id", (existing as { id: string }).id);
    } else {
      await supabaseAdmin.from("subscriptions").insert({
        organization_id: orgId,
        ...patch,
      } as never);
    }

    const { data: clinic } = await supabaseAdmin
      .from("clinics")
      .select("owner_id")
      .eq("organization_id", orgId)
      .maybeSingle();
    const doctorId = clinic?.owner_id || null;

    // Generate Invoice immediately on activation if a payment_id is provided
    if (data.payment_id) {
      const invNum = `RZP-${data.payment_id.slice(-8).toUpperCase()}`;
      
      // Check if invoice already exists to avoid duplicates
      const { data: existingInvoice } = await supabaseAdmin
        .from("invoices")
        .select("id")
        .eq("invoice_number", invNum)
        .maybeSingle();

      if (!existingInvoice) {
        try {
          const payment = await getPayment(data.payment_id);
          if (payment && (payment.status === "captured" || payment.status === "authorized")) {
            await supabaseAdmin.from("transactions").insert({
              doctor_id: doctorId,
              amount: payment.amount / 100,
              currency: payment.currency,
              status: "captured",
              gateway: "razorpay",
              plan: planId || null,
              billing_cycle: billingCycle || null,
              gateway_payment_id: payment.id,
              gateway_order_id: payment.order_id ?? null,
            } as never);

            await supabaseAdmin.from("invoices").insert({
              organization_id: orgId,
              amount: payment.amount / 100,
              invoice_number: invNum,
              status: "paid",
              paid_at: new Date().toISOString(),
            } as never);
          }
        } catch (err) {
          console.error("Error generating instant invoice in activation function:", err);
        }
      }
    } else if (isTrial) {
      // Record a transaction for the ₹1 trial setup when payment_id is not directly passed
      const { data: existingTrialTxs } = await supabaseAdmin
        .from("transactions")
        .select("id")
        .eq("doctor_id", doctorId)
        .eq("plan", planId || "")
        .eq("gateway_order_id", "Trial Setup")
        .limit(1);

      if (!existingTrialTxs || existingTrialTxs.length === 0) {
        await supabaseAdmin.from("transactions").insert({
          doctor_id: doctorId,
          amount: 1, // ₹1 trial
          currency: "INR",
          status: "captured",
          gateway: "razorpay",
          plan: planId || null,
          billing_cycle: billingCycle || null,
          gateway_payment_id: `TRIAL-${sub.id.slice(-6).toUpperCase()}`,
          gateway_order_id: "Trial Setup",
        } as never);
      }
    }

    return { success: true };
  });

// Pull the latest state from Razorpay and mirror it into the local DB. Used
// by the "Verify / refresh" button on the billing page so users don't have to
// wait for the webhook to catch up after a renewal.
export const syncRazorpaySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ organization_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("organization_id", data.organization_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member) throw new Error("Not a member of this organization");

    const { data: subRow } = await supabaseAdmin
      .from("subscriptions")
      .select("id, gateway, gateway_subscription_id")
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    const s = subRow as { id: string; gateway?: string | null; gateway_subscription_id?: string | null } | null;
    if (!s || s.gateway !== "razorpay" || !s.gateway_subscription_id) {
      return { ok: false, reason: "No Razorpay subscription linked" };
    }
    const { getSubscription } = await import("@/lib/razorpay.server");
    const remote = await getSubscription(s.gateway_subscription_id);
    let localStatus: string | null = null;
    if (remote.status === "active" || remote.status === "authenticated") localStatus = "active";
    else if (remote.status === "halted" || remote.status === "pending") localStatus = "past_due";
    else if (remote.status === "completed" || remote.status === "cancelled") localStatus = "cancelled";
    else if (remote.status === "expired") localStatus = "expired";

    const patch: Record<string, unknown> = {};
    if (localStatus) patch.status = localStatus;
    if (remote.current_start) patch.current_period_start = new Date(remote.current_start * 1000).toISOString();
    if (remote.current_end) patch.current_period_end = new Date(remote.current_end * 1000).toISOString();
    if (Object.keys(patch).length > 0) {
      await supabaseAdmin.from("subscriptions").update(patch as never).eq("id", s.id);
    }

    // Clear stale banners if the sub is healthy again.
    if (localStatus === "active") {
      await (supabaseAdmin as any)
        .from("subscription_reminders")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("organization_id", data.organization_id)
        .is("dismissed_at", null)
        .in("kind", ["autopay_halted", "payment_failed", "renewal_pending"]);
    }
    return {
      ok: true,
      status: localStatus,
      current_period_end: remote.current_end ? new Date(remote.current_end * 1000).toISOString() : null,
    };
  });

// Reminders shown on the billing page.
export const listBillingReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ organization_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("organization_id", data.organization_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member) return [];
    const { data: rows } = await (supabaseAdmin as any)
      .from("subscription_reminders")
      .select("*")
      .eq("organization_id", data.organization_id)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false });
    return (rows ?? []) as Array<{
      id: string; kind: string; severity: string; title: string; body: string | null; created_at: string;
    }>;
  });

export const dismissBillingReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), organization_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("organization_id", data.organization_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    const role = (member as { role?: string } | null)?.role;
    if (!role || !["owner", "admin"].includes(role)) throw new Error("Only owners/admins can dismiss");
    await (supabaseAdmin as any)
      .from("subscription_reminders")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("organization_id", data.organization_id);
    return { ok: true };
  });