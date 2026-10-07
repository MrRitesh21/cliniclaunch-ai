import { z } from "zod";
import { verifyCapturedSubscriptionPayment } from "./payment-verification.ts";
import type * as Razorpay from "./razorpay.server.ts";

export type BillingRpcName =
  | "clinicx_enqueue_billing_event"
  | "clinicx_claim_billing_events"
  | "clinicx_retry_billing_event"
  | "clinicx_begin_checkout"
  | "clinicx_bind_checkout"
  | "clinicx_checkout_context"
  | "clinicx_provider_context"
  | "clinicx_settle_payment"
  | "clinicx_checkout_uncertain"
  | "clinicx_billing_lifecycle"
  | "clinicx_billing_history"
  | "clinicx_billing_reminders"
  | "clinicx_dismiss_billing_reminder"
  | "clinicx_billing_current"
  | "clinicx_downgrade_check"
  | "clinicx_reserve_recurring"
  | "clinicx_finish_recurring"
  | "clinicx_recurring_command_context"
  | "clinicx_recurring_command_state"
  | "clinicx_charge_quote"
  | "clinicx_known_provider_plan"
  | "clinicx_renewal_context"
  | "clinicx_invoice_detail"
  | "clinicx_billing_history_page"
  | "clinicx_recovery_context"
  | "clinicx_recover_and_settle"
  | "clinicx_recover_terminal_command"
  | "clinicx_claim_recurring_recovery"
  | "clinicx_stage_recurring_review"
  | "clinicx_capture_quote"
  | "clinicx_recurring_recovery_command";
export interface BillingTransport {
  rpc(
    name: BillingRpcName,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
}
export type BillingProvider = Pick<
  typeof Razorpay,
  | "createOrGetPlan"
  | "createSubscription"
  | "verifySubscriptionCheckoutSignature"
  | "getPayment"
  | "getSubscription"
  | "getPlan"
  | "getInvoice"
  | "cancelSubscription"
> & Partial<Pick<typeof Razorpay, "scheduleSubscriptionChange" | "getScheduledSubscriptionChange" | "resumeSubscription" | "getSubscriptionInvoices">>;
const commandSchema = z.object({
  id: z.string().uuid(), organization_id: z.string().uuid(), actor_id: z.string(),
  provider_subscription_id: z.string().regex(/^sub_[A-Za-z0-9]{1,64}$/),
  kind: z.enum(["change", "cancel", "resume"]),
  state: z.enum(["reserved", "uncertain", "scheduled", "applied", "confirmed", "aborted", "superseded"]),
  plan_id: z.string(), billing_cycle: z.enum(["monthly", "yearly"]),
  provider_plan_id: z.string().regex(/^plan_[A-Za-z0-9]{1,64}$/),
  previous_provider_plan_id: z.string().regex(/^plan_[A-Za-z0-9]{1,64}$/),
  amount_paise: z.number().int().positive().safe(), paid_through: z.string(),
  effective_at: z.string().nullable().optional(), reason: z.string().nullable(),
});
const recurringEvidenceSchema = z.object({
  id: z.string(), plan_id: z.string(), status: z.string(), quantity: z.number().int().optional(),
  has_scheduled_changes: z.boolean().optional(), change_scheduled_at: z.number().int().nullable().optional(),
  offer_id: z.string().nullable().optional(),
});
const renewalQuoteSchema = z.object({ provider_subscription_id: z.string().nullable(),
  provider_plan_id: z.string(), plan_id: z.string(), billing_cycle: z.enum(["monthly", "yearly"]),
  amount_paise: z.number().int().positive().safe(), cancel_at_period_end: z.boolean(),
  command_state: z.string().nullable(), reason: z.string().nullable(),
  paid_through: z.string().nullable().optional(), terminal_verified:z.boolean().optional(),
  pending_change: z.object({ id: z.string().uuid(), plan_id: z.string(), billing_cycle: z.enum(["monthly", "yearly"]),
    provider_plan_id: z.string(), amount_paise: z.number().int().positive().safe(), effective_at: z.string() }).nullable(),
});
const attemptSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  actor_id: z.string(),
  plan_id: z.string(),
  billing_cycle: z.enum(["monthly", "yearly"]),
  provider_plan_id: z.string().regex(/^plan_[A-Za-z0-9]{1,64}$/),
  amount_paise: z.number().int().positive().safe(),
  provider_subscription_id: z
    .string()
    .regex(/^sub_[A-Za-z0-9]{1,64}$/)
    .nullable(),
  state: z.enum(["creating", "pending", "settled", "failed", "needs_reconciliation"]),
});
export interface CheckoutCallback {
  subscription_id: string;
  payment_id: string;
  signature: string;
  organization_id?: string;
  attempt_id?: string;
}
export async function billingRpc(
  transport: BillingTransport,
  name: BillingRpcName,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await transport.rpc(name, args);
  if (error) throw new Error(`Billing authority: ${error.message}`);
  if (data == null) throw new Error("Missing billing authority response");
  return data;
}

/** Caller transport carries the verified JWT; admin transport is used only after local ownership or signed webhook binding. */
export function createBillingService(
  actor: BillingTransport,
  admin: BillingTransport,
  provider: BillingProvider,
) {
  async function finishCommand(c: z.infer<typeof commandSchema>, readback: unknown) {
    const committed = commandSchema.parse(await billingRpc(admin, "clinicx_finish_recurring", {
      p_command:c.id,p_actor:c.actor_id,p_remote:recurringEvidenceSchema.parse(readback),
    }));
    if (committed.id !== c.id || committed.organization_id !== c.organization_id || committed.actor_id !== c.actor_id ||
        committed.provider_subscription_id !== c.provider_subscription_id || committed.kind !== c.kind ||
        committed.plan_id !== c.plan_id || committed.billing_cycle !== c.billing_cycle ||
        committed.provider_plan_id !== c.provider_plan_id || committed.amount_paise !== c.amount_paise ||
        committed.state !== (c.kind === "change" ? "scheduled" : "confirmed"))
      throw new Error("Committed recurring command mismatch; reconciliation required");
    return committed;
  }
  async function context(
    subscriptionId: string,
    organizationId?: string,
    attemptId?: string,
    webhook = false,
  ) {
    const a = attemptSchema.parse(
      await billingRpc(
        webhook ? admin : actor,
        webhook ? "clinicx_provider_context" : "clinicx_checkout_context",
        {
          p_subscription: subscriptionId,
          ...(!webhook ? { p_org: organizationId ?? null, p_attempt: attemptId ?? null } : {}),
        },
      ),
    );
    if (
      a.provider_subscription_id !== subscriptionId ||
      (organizationId && a.organization_id !== organizationId) ||
      (attemptId && a.id !== attemptId)
    )
      throw new Error("Checkout binding mismatch");
    return a;
  }
  async function capture(a: z.infer<typeof attemptSchema>, paymentId: string, eventId: string) {
    const subscriptionId = a.provider_subscription_id;
    if (!subscriptionId) throw new Error("Checkout not bound");
    const payment = await provider.getPayment(paymentId);
    if (payment.id !== paymentId) throw new Error("Payment ID mismatch");
    // Authorization/mandate setup never activates paid access or creates financial rows.
    if (payment.status !== "captured")
      return { success: false, active: false, pending: true, reason: "capture_pending" } as const;
    if (!payment.invoice_id) throw new Error("Canonical subscription invoice required");
    const [subscription, invoiceRaw] = await Promise.all([
      provider.getSubscription(subscriptionId),
      provider.getInvoice(payment.invoice_id),
    ]);
    // This independently fetched invoice owns the charge period, even after the mandate changes plan.
    const invoice = z.object({ id: z.string(), amount: z.number().int().positive(),
      currency: z.literal("INR"), status: z.literal("paid"),
      billing_start: z.number().int().positive(), billing_end: z.number().int().positive() }).parse(invoiceRaw);
    const recovery = z.object({ command: commandSchema.nullable() }).parse(
      await billingRpc(admin, "clinicx_recovery_context", {p_subscription: subscriptionId}),
    ).command;
    if (recovery && (recovery.organization_id !== a.organization_id || recovery.provider_subscription_id !== subscriptionId))
      throw new Error("Recovery tenant/mandate mismatch");
    const appliedCandidate = recovery?.kind === "change" && subscription.plan_id === recovery.provider_plan_id &&
      subscription.status === "active" && subscription.quantity === 1 && !subscription.offer_id && subscription.has_scheduled_changes === false;
    const recoverCharge = appliedCandidate && invoice.billing_start >= Date.parse(recovery!.paid_through)/1000 && invoice.amount === recovery!.amount_paise;
    const quote = z.object({ provider_plan_id: z.string().regex(/^plan_[A-Za-z0-9]{1,64}$/),
      amount_paise: z.number().int().positive().safe(), billing_cycle: z.enum(["monthly", "yearly"]) })
      .parse(recoverCharge ? recovery : await billingRpc(admin, "clinicx_capture_quote", {
        p_subscription: subscriptionId, p_payment:payment.id,p_invoice:invoice.id,
        p_start: invoice.billing_start,p_end:invoice.billing_end,p_amount: invoice.amount,
      }));
    if (subscription.plan_id !== a.provider_plan_id && !appliedCandidate &&
        await billingRpc(admin, "clinicx_known_provider_plan", {p_subscription: subscriptionId,p_plan: subscription.plan_id}) !== true)
      throw new Error("Untracked provider subscription plan");
    if (appliedCandidate && !recoverCharge) {
      const currentPlan = await provider.getPlan(recovery!.provider_plan_id);
      if (currentPlan.id !== recovery!.provider_plan_id || currentPlan.item?.amount !== recovery!.amount_paise ||
          currentPlan.item.currency !== "INR" || currentPlan.period !== recovery!.billing_cycle || currentPlan.interval !== 1)
        throw new Error("Recovery current provider quote mismatch");
    }
    const plan = await provider.getPlan(quote.provider_plan_id);
    const verified = verifyCapturedSubscriptionPayment({
      expected: {
        paymentId,
        subscriptionId,
        providerPlanId: quote.provider_plan_id,
        currentProviderPlanId: subscription.plan_id,
        amountPaise: quote.amount_paise,
        planAmountPaise: quote.amount_paise,
        interval: quote.billing_cycle,
        purpose: "subscription_charge",
      },
      payment,
      subscription,
      plan,
      invoice: invoiceRaw,
    });
    if (!verified.ok) throw new Error(`Payment verification: ${verified.reason}`);
    // Invoice period belongs to THIS charge; subscription.current_end may now refer to a later renewal.
    if (invoice.amount !== quote.amount_paise || invoice.billing_end <= invoice.billing_start)
      throw new Error("Canonical invoice mismatch");
    const evidence = {
      payment_id:payment.id,subscription_id:subscriptionId,provider_plan_id:plan.id,invoice_id:invoice.id,
      amount_paise:payment.amount,currency:payment.currency,status:payment.status,
      period_start:invoice.billing_start,period_end:invoice.billing_end,
    };
    let settled: unknown;
    if (recoverCharge) {
      const snapshot = {command_id:recovery!.id,actor_id:recovery!.actor_id,organization_id:recovery!.organization_id,
        subscription,invoice:invoiceRaw,payment,plan};
      // Staging validates the snapshot and returns a pending review ONLY for genuinely equal-price ambiguity.
      const review = z.object({requires_review:z.boolean(),approved:z.boolean().optional()}).parse(
        await billingRpc(admin,"clinicx_stage_recurring_review",{p_command:recovery!.id,p_snapshot:snapshot}),
      );
      if (review.requires_review && !review.approved)
        return {success:false,active:false,pending:true,reason:"operator_review_required"} as const;
      settled = await billingRpc(admin,"clinicx_recover_and_settle",{p_event:eventId,p_command:recovery!.id,p_snapshot:snapshot,p_evidence:evidence});
    } else settled = await billingRpc(admin,"clinicx_settle_payment",{p_event:eventId,p_evidence:evidence});
    const result = z.object({success:z.literal(true),organization_id:z.string(),deduped:z.boolean().optional()}).parse(settled);
    if (result.organization_id !== a.organization_id) throw new Error("Settlement tenant mismatch");
    if (recovery?.kind === "cancel" && ["cancelled","completed","expired"].includes(subscription.status))
      await billingRpc(admin,"clinicx_recover_terminal_command",{p_command:recovery.id,p_actor:recovery.actor_id,p_remote:recurringEvidenceSchema.parse(subscription)});
    return result;
  }
  async function recurring(input: {
    organization_id: string; plan_id?: string; billing_cycle?: "monthly" | "yearly"; reason?: string;
  }, kind: "change" | "cancel" | "resume") {
    const c = commandSchema.parse(await billingRpc(actor, "clinicx_reserve_recurring", {
      p_org: input.organization_id, p_kind: kind, p_plan: input.plan_id ?? null,
      p_cycle: input.billing_cycle ?? null, p_reason: input.reason ?? null,
    }));
    if (c.organization_id !== input.organization_id || c.kind !== kind || c.state !== "reserved" ||
        (kind === "change" && (c.plan_id !== input.plan_id || c.billing_cycle !== input.billing_cycle)))
      throw new Error("Recurring command binding mismatch");
    let monetaryStarted = false;
    try {
      const before = await provider.getSubscription(c.provider_subscription_id);
      if (before.id !== c.provider_subscription_id || (before.plan_id !== c.previous_provider_plan_id &&
          (kind !== "cancel" || await billingRpc(admin,"clinicx_known_provider_plan",{p_subscription:c.provider_subscription_id,p_plan:before.plan_id}) !== true)))
        throw new Error("Recurring provider binding mismatch");
      if (kind === "change") {
        if (before.status !== "active" || before.payment_method !== "card" || before.quantity !== 1 ||
            before.offer_id || before.has_scheduled_changes !== false)
          throw new Error("In-place updates require an active card mandate, quantity 1, no offer or untracked schedule; UPI/eMandate changes require controlled replacement after expiry");
        const plan = await provider.getPlan(c.provider_plan_id);
        if (plan.id !== c.provider_plan_id || plan.period !== c.billing_cycle || plan.interval !== 1 ||
            plan.item?.currency !== "INR" || plan.item.amount !== c.amount_paise)
          throw new Error("Recurring target quote mismatch");
        if (!provider.scheduleSubscriptionChange || !provider.getScheduledSubscriptionChange)
          throw new Error("Provider schedule adapter unavailable");
        monetaryStarted = true;
        const response = await provider.scheduleSubscriptionChange(c.provider_subscription_id, c.provider_plan_id);
        if (response.id !== c.provider_subscription_id) throw new Error("Schedule response binding mismatch");
        const readback = await provider.getScheduledSubscriptionChange(c.provider_subscription_id);
        if (readback.id !== c.provider_subscription_id || readback.plan_id !== c.provider_plan_id ||
            readback.has_scheduled_changes !== true || readback.quantity !== 1 || readback.offer_id ||
            !Number.isSafeInteger(readback.change_scheduled_at) ||
            readback.change_scheduled_at! < Date.parse(c.paid_through) / 1000)
          throw new Error("Schedule readback mismatch; reconciliation required");
        return await finishCommand(c, readback);
      }
      if (kind === "resume" && (before.status !== "paused" || before.pause_initiated_by !== "self"))
        throw new Error("Only a merchant-paused subscription can resume; cancelled mandates cannot be reactivated or replaced during paid-through access");
      if (kind === "cancel" && !["active", "authenticated", "paused", "pending", "halted", "cancelled"].includes(before.status))
        throw new Error("Provider subscription cannot be cancelled in this state");
      if (kind === "cancel" && before.status !== "cancelled") {
        // Definitive stop now, NOT an unproven has_scheduled_changes cancellation signal.
        // ClinicX separately retains all captured paid-through access.
        monetaryStarted = true;
        const response = await provider.cancelSubscription(c.provider_subscription_id, false);
        if (response.id !== c.provider_subscription_id) throw new Error("Cancellation response mismatch");
      } else if (kind === "resume") {
        if (!provider.resumeSubscription) throw new Error("Provider resume adapter unavailable");
        monetaryStarted = true;
        const response = await provider.resumeSubscription(c.provider_subscription_id);
        if (response.id !== c.provider_subscription_id) throw new Error("Resume response mismatch");
      }
      const readback = await provider.getSubscription(c.provider_subscription_id);
      if (readback.id !== c.provider_subscription_id || (readback.plan_id !== c.previous_provider_plan_id &&
          (kind !== "cancel" || await billingRpc(admin,"clinicx_known_provider_plan",{p_subscription:c.provider_subscription_id,p_plan:readback.plan_id}) !== true)) ||
          readback.status !== (kind === "cancel" ? "cancelled" : "active"))
        throw new Error("Lifecycle command readback mismatch; reconciliation required");
      return await finishCommand(c, readback);
    } catch (error) {
      await billingRpc(admin, "clinicx_recurring_command_state", {
        p_command: c.id, p_actor: c.actor_id, p_state: monetaryStarted ? "uncertain" : "aborted",
      });
      throw error;
    }
  }
  async function observeTerminal(remote: Awaited<ReturnType<BillingProvider["getSubscription"]>>) {
    if (!["cancelled","completed","expired"].includes(remote.status)) return;
    const c = z.object({command:commandSchema.nullable()}).parse(await billingRpc(admin,"clinicx_recovery_context",{p_subscription:remote.id})).command;
    if (c?.kind === "cancel")
      await billingRpc(admin,"clinicx_recover_terminal_command",{p_command:c.id,p_actor:c.actor_id,p_remote:recurringEvidenceSchema.parse(remote)});
  }
  async function recoverCommand(c: z.infer<typeof commandSchema>) {
    if (!["reserved", "uncertain"].includes(c.state)) return c;
    const remote = await provider.getSubscription(c.provider_subscription_id);
    if (remote.id !== c.provider_subscription_id) throw new Error("Recovery canonical subscription binding mismatch");
    if (c.kind === "cancel" && ["cancelled","completed","expired"].includes(remote.status))
      return commandSchema.parse(await billingRpc(admin,"clinicx_recover_terminal_command",{p_command:c.id,p_actor:c.actor_id,p_remote:recurringEvidenceSchema.parse(remote)}));
    if (c.kind !== "change") return finishCommand(c,remote);
    if (remote.has_scheduled_changes === true) {
      const scheduled = await provider.getScheduledSubscriptionChange?.(remote.id);
      if (!scheduled) throw new Error("Provider schedule readback unavailable");
      return finishCommand(c,scheduled);
    }
    if (remote.plan_id !== c.provider_plan_id || remote.status !== "active" || remote.has_scheduled_changes !== false)
      throw new Error("Command not independently proven applied; no monetary replay permitted");
    if (!provider.getSubscriptionInvoices) throw new Error("Provider invoice recovery adapter unavailable");
    const candidates = await provider.getSubscriptionInvoices(remote.id,2);
    const a = await context(remote.id,undefined,undefined,true);
    for (const invoice of candidates) {
      if (invoice.payment_id) {
        const result = await capture(a,invoice.payment_id,`command-payment:${invoice.payment_id}`);
        if (result.success) {
          const committed = commandSchema.parse(await billingRpc(admin,"clinicx_recurring_recovery_command",{p_command:c.id}));
          if (!["reserved","uncertain"].includes(committed.state)) return committed;
        }
      }
    }
    throw new Error("Applied command needs a captured target invoice or approved operator review; bounded scan exhausted");
  }
  return {
    async recoverCommands(limit = 2) {
      const commands = z.array(commandSchema).parse(await billingRpc(admin,"clinicx_claim_recurring_recovery",{p_limit:limit}));
      let commands_recovered=0,commands_pending=0;
      for (const c of commands) {
        try { await recoverCommand(c); commands_recovered++; }
        catch { commands_pending++; }
      }
      return {commands_recovered,commands_pending};
    },
    async reconcileCommand(organizationId: string, commandId: string) {
      const c = commandSchema.parse(await billingRpc(actor, "clinicx_recurring_command_context", {p_org:organizationId,p_command:commandId}));
      if (c.organization_id !== organizationId || c.id !== commandId) throw new Error("Command binding mismatch");
      return recoverCommand(c);
    },
    async renewal(organizationId: string) {
      const raw = await billingRpc(actor, "clinicx_renewal_context", {p_org:organizationId});
      if (z.object({provider_subscription_id:z.null()}).safeParse(raw).success)
        return { available: false, reason: "No verified recurring mandate" } as const;
      const current = renewalQuoteSchema.parse(raw);
      if (["reserved", "uncertain"].includes(current.command_state ?? ""))
        throw new Error("Renewal quote unavailable while recurring command needs reconciliation");
      const remote = await provider.getSubscription(current.provider_subscription_id!);
      if (remote.id !== current.provider_subscription_id) throw new Error("Renewal provider binding mismatch");
      const target = current.pending_change;
      const quote = remote.plan_id === current.provider_plan_id ? current :
        target && remote.plan_id === target.provider_plan_id ? target : null;
      if (!quote || remote.quantity !== 1 || remote.offer_id) throw new Error("Renewal plan/quantity/offer requires reconciliation");
      const plan = await provider.getPlan(remote.plan_id);
      if (plan.id !== quote.provider_plan_id || plan.item?.amount !== quote.amount_paise || plan.item.currency !== "INR" ||
          plan.period !== quote.billing_cycle || plan.interval !== 1) throw new Error("Renewal quote plan mismatch");
      if (remote.has_scheduled_changes === true) {
        const scheduled = await provider.getScheduledSubscriptionChange?.(remote.id);
        if (!target || !scheduled || scheduled.id !== remote.id || scheduled.plan_id !== target.provider_plan_id ||
            scheduled.has_scheduled_changes !== true || scheduled.change_scheduled_at !== Date.parse(target.effective_at)/1000)
          throw new Error("Renewal has an untracked provider schedule");
      }
      if (target) {
        if (remote.plan_id !== target.provider_plan_id && remote.has_scheduled_changes !== true)
          throw new Error("Scheduled renewal disappeared from provider; reconciliation required");
        const targetPlan = await provider.getPlan(target.provider_plan_id);
        if (targetPlan.id !== target.provider_plan_id || targetPlan.period !== target.billing_cycle || targetPlan.interval !== 1 ||
            targetPlan.item?.currency !== "INR" || targetPlan.item.amount !== target.amount_paise)
          throw new Error("Scheduled renewal quote plan mismatch");
      }
      const willRenew = !current.cancel_at_period_end && ["active", "authenticated"].includes(remote.status);
      if (willRenew && (!Number.isSafeInteger(remote.charge_at) || remote.charge_at!<=0)) throw new Error("Canonical next charge time unavailable");
      const paymentMethod = ["card","upi","emandate"].includes(remote.payment_method??"") ? remote.payment_method! : null;
      const terminal=["cancelled","completed","expired"].includes(remote.status);
      const merchantPaused=remote.status==="paused" && remote.pause_initiated_by==="self" && paymentMethod!==null;
      const canChange=remote.status==="active" && paymentMethod==="card" && remote.has_scheduled_changes===false &&
        !current.cancel_at_period_end && !target && !!current.paid_through && Date.parse(current.paid_through)>Date.now();
      return { available:true, currency:"INR" as const, amount_unit:"paise" as const,
        payment_method:paymentMethod,pause_initiated_by:remote.pause_initiated_by??null,merchant_paused:merchantPaused,
        can_change_plan:canChange,can_cancel:!terminal && ["active","authenticated","paused","pending","halted"].includes(remote.status),
        can_resume:merchantPaused,requires_new_mandate:terminal,
        can_resubscribe:terminal && current.terminal_verified===true && !!current.paid_through && Date.parse(current.paid_through)<=Date.now(),
        resubscribe_not_before:terminal?(current.paid_through??null):null,
        cancel_mode:"stop_mandate_keep_paid_access" as const,
        resume_restriction:terminal?"Cancelled mandates cannot be resumed; new checkout only after verified terminal state and paid-through expiry":
          remote.status==="paused" && !merchantPaused?"Only the customer can resume a customer-paused mandate":null,
        provider_subscription_id:remote.id,provider_plan_id:plan.id,plan_id:quote.plan_id,billing_cycle:quote.billing_cycle,
        provider_status:remote.status,will_renew:willRenew,amount_paise:willRenew?plan.item.amount:null,
        next_charge_at:willRenew?remote.charge_at!:null, recurring_amount_paise:plan.item.amount,
        pending_change:target,reason:current.reason };
    },
    async change(input: { organization_id: string; plan_id: string; billing_cycle: "monthly" | "yearly" }) {
      return recurring(input, "change");
    },
    async start(input: {
      organization_id: string;
      plan_id: string;
      billing_cycle: "monthly" | "yearly";
      coupon_code?: string;
    }) {
      if (input.coupon_code)
        throw new Error("Discount checkout requires reconciled provider offer evidence");
      const a = attemptSchema.parse(
        await billingRpc(actor, "clinicx_begin_checkout", {
          p_org: input.organization_id,
          p_plan: input.plan_id,
          p_cycle: input.billing_cycle,
        }),
      );
      if (
        a.organization_id !== input.organization_id ||
        a.plan_id !== input.plan_id ||
        a.billing_cycle !== input.billing_cycle
      )
        throw new Error("Checkout quote mismatch");
      if (a.state === "pending" && a.provider_subscription_id)
        return { subscription_id: a.provider_subscription_id, attempt_id: a.id, short_url: "" };
      try {
        const planId = await provider.createOrGetPlan(
          `${a.plan_id}_${a.billing_cycle}_${a.amount_paise}`,
          {
            name: `${a.plan_id} · ${a.billing_cycle}`,
            amount_paise: a.amount_paise,
            interval: a.billing_cycle,
          },
          { existingPlanId: a.provider_plan_id, allowCreate: false },
        );
        const remote = await provider.createSubscription(planId, {
          billing_cycle: a.billing_cycle,
          checkout_attempt_id: a.id,
        });
        if (!/^sub_[A-Za-z0-9]{1,64}$/.test(remote.id))
          throw new Error("Invalid provider subscription");
        const bound = attemptSchema.parse(
          await billingRpc(admin, "clinicx_bind_checkout", {
            p_attempt: a.id,
            p_actor: a.actor_id,
            p_subscription: remote.id,
          }),
        );
        if (
          bound.provider_subscription_id !== remote.id ||
          bound.organization_id !== a.organization_id
        )
          throw new Error("Binding write failed");
        return { subscription_id: remote.id, attempt_id: a.id, short_url: remote.short_url };
      } catch (error) {
        // Ambiguous POST outcomes must never be retried automatically or replaced with a second mandate.
        await billingRpc(admin, "clinicx_checkout_uncertain", {
          p_attempt: a.id,
          p_actor: a.actor_id,
        });
        throw error;
      }
    },
    async activate(input: CheckoutCallback) {
      const a = await context(input.subscription_id, input.organization_id, input.attempt_id);
      if (
        !provider.verifySubscriptionCheckoutSignature(
          input.payment_id,
          a.provider_subscription_id!,
          input.signature,
        )
      )
        throw new Error("Invalid checkout signature");
      const eventId = `callback:${input.payment_id}`;
      await billingRpc(admin, "clinicx_enqueue_billing_event", {
        p_event: eventId,
        p_payload: {
          event: "subscription.charged",
          payload: {
            subscription: { entity: { id: a.provider_subscription_id } },
            payment: { entity: { id: input.payment_id } },
          },
        },
      });
      return capture(a, input.payment_id, eventId);
    },
    async status(input: { subscription_id: string; organization_id?: string }) {
      const a = await context(input.subscription_id, input.organization_id);
      const current = z
        .object({
          active: z.boolean(),
          status: z.string().nullable(),
          current_period_end: z.string().nullable(),
          provider_subscription_id: z.string().nullable(),
        })
        .parse(await billingRpc(actor, "clinicx_billing_current", { p_org: a.organization_id }));
      return {
        active: current.active && current.provider_subscription_id === a.provider_subscription_id,
        status: current.status,
        current_period_end: current.current_period_end,
      };
    },
    async webhook(
      eventId: string,
      event: {
        event: string;
        payload?: {
          subscription?: { entity?: { id?: string } };
          payment?: {
            entity?: { id?: string; subscription_id?: string | null; invoice_id?: string | null };
          };
        };
      },
    ) {
      const paymentId = event.payload?.payment?.entity?.id;
      let subscriptionId = event.payload?.subscription?.entity?.id;
      if (!subscriptionId && paymentId) {
        const pay = await provider.getPayment(paymentId);
        if (pay.invoice_id)
          subscriptionId = (await provider.getInvoice(pay.invoice_id)).subscription_id ?? undefined;
        else subscriptionId = pay.subscription_id ?? undefined;
      }
      if (!subscriptionId) throw new Error("Unbound webhook subscription");
      const a = await context(subscriptionId, undefined, undefined, true);
      let failedPeriod: number | null = null;
      let failedPayment = false;
      if (paymentId) {
        const payment = await provider.getPayment(paymentId);
        if (payment.status === "captured") return capture(a, paymentId, eventId);
        if (payment.status === "authorized" || payment.status === "created")
          return { success: false, active: false, pending: true, reason: "capture_pending" };
        if (payment.status === "failed") {
          const invoice = payment.invoice_id
            ? await provider.getInvoice(payment.invoice_id)
            : undefined;
          if (
            payment.id !== paymentId ||
            payment.currency !== "INR" ||
            (payment.amount !== a.amount_paise && !invoice)
          )
            throw new Error("Failed payment amount mismatch");
          if (payment.amount !== a.amount_paise && invoice) {
            const failedInvoice = z.object({billing_start:z.number().int().positive()}).parse(invoice);
            await billingRpc(admin,"clinicx_charge_quote",{p_subscription:subscriptionId,p_start:failedInvoice.billing_start,p_amount:payment.amount});
          }
          if (payment.subscription_id != null && payment.subscription_id !== subscriptionId)
            throw new Error("Contradictory failed payment subscription binding");
          if (
            payment.subscription_id !== subscriptionId &&
            invoice?.subscription_id !== subscriptionId
          )
            throw new Error("Failed payment binding mismatch");
          if (invoice?.payment_id && invoice.payment_id !== paymentId)
            throw new Error("Failed payment invoice mismatch");
          failedPayment = true;
          const period = (invoice as { billing_start?: unknown } | undefined)?.billing_start;
          failedPeriod =
            typeof period === "number" && Number.isSafeInteger(period) && period > 0
              ? period
              : null;
        } else throw new Error("Non-settlement payment requires manual reconciliation");
      }
      const remote = await provider.getSubscription(subscriptionId);
      if (remote.id !== subscriptionId || (remote.plan_id !== a.provider_plan_id &&
          await billingRpc(admin,"clinicx_known_provider_plan",{p_subscription:subscriptionId,p_plan:remote.plan_id}) !== true))
        throw new Error("Lifecycle binding mismatch");
      await observeTerminal(remote);
      return billingRpc(admin, "clinicx_billing_lifecycle", {
        p_event: eventId,
        p_subscription: subscriptionId,
        p_status: failedPayment ? "pending" : remote.status,
        p_period_start: failedPayment
          ? failedPeriod
          : ["pending", "halted"].includes(remote.status)
            ? (remote.current_end ?? null)
            : (remote.current_start ?? null),
        p_actor: null,
      });
    },
    async cancel(organizationId: string, reason?: string) {
      const c = await recurring({ organization_id: organizationId, reason }, "cancel");
      return { ok: true, cancel_at_period_end: true, paid_through: c.paid_through,
        command_id: c.id, mandate_stopped: true, reason: c.reason };
    },
    async resume(organizationId: string) {
      const c = await recurring({ organization_id: organizationId }, "resume");
      return { ok: true, command_id: c.id, requires_new_mandate: false };
    },
    async reconcile(organizationId: string, paymentId?: string, subscriptionId?: string) {
      const current = z
        .object({ provider_subscription_id: z.string().nullable() })
        .passthrough()
        .parse(await billingRpc(actor, "clinicx_billing_current", { p_org: organizationId }));
      const boundId = subscriptionId ?? current.provider_subscription_id;
      if (!boundId) return { ok: false, reason: "No verified Razorpay subscription linked" };
      const a = await context(boundId, organizationId);
      if (paymentId) {
        const eventId = `reconcile-payment:${paymentId}`;
        await billingRpc(admin, "clinicx_enqueue_billing_event", {
          p_event: eventId,
          p_payload: {
            event: "subscription.charged",
            payload: {
              subscription: { entity: { id: boundId } },
              payment: { entity: { id: paymentId } },
            },
          },
        });
        const settled = await capture(a, paymentId, eventId);
        if (!settled.success) return { ok: false, reason: "Canonical capture pending" };
        const readback = await billingRpc(actor, "clinicx_billing_current", {
          p_org: organizationId,
        });
        return {
          ok: true,
          ...z
            .object({ status: z.string().nullable(), current_period_end: z.string().nullable() })
            .parse(readback),
        };
      }
      const remote = await provider.getSubscription(a.provider_subscription_id!);
      if (remote.id !== a.provider_subscription_id || (remote.plan_id !== a.provider_plan_id &&
          await billingRpc(admin,"clinicx_known_provider_plan",{p_subscription:remote.id,p_plan:remote.plan_id}) !== true))
        throw new Error("Reconciliation plan mismatch");
      await observeTerminal(remote);
      // Never turn status=active/authenticated into a paid grant. Renewal needs its own canonical invoice/payment.
      await billingRpc(admin, "clinicx_billing_lifecycle", {
        p_event: `reconcile:${remote.id}:${remote.status}:${remote.current_start ?? 0}`,
        p_subscription: remote.id,
        p_status: remote.status,
        p_period_start: ["pending", "halted"].includes(remote.status)
          ? (remote.current_end ?? null)
          : (remote.current_start ?? null),
        p_actor: a.actor_id,
      });
      const readback = await billingRpc(actor, "clinicx_billing_current", {
        p_org: organizationId,
      });
      return {
        ok: true,
        ...z
          .object({ status: z.string().nullable(), current_period_end: z.string().nullable() })
          .parse(readback),
      };
    },
  };
}
