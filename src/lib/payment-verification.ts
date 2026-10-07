// Pure verification only: no env, transport, persistence, tenant resolution or paid activation.
export interface CanonicalPaymentExpectation {
  paymentId: string;
  subscriptionId: string;
  providerPlanId: string;
  currentProviderPlanId?: string; // Independently checked against persisted provider schedule history, never client input.
  amountPaise: number; // Server-owned expected charge, including a persisted discount if applicable.
  planAmountPaise: number; // Server-owned recurring price; may differ from this charge.
  interval: "monthly" | "yearly";
  purpose: "subscription_charge"; // Mandate/setup evidence MUST use a separate non-settlement path.
}
export interface ProviderPlan {
  id: string;
  period: string;
  interval: number;
  item: { amount: number; currency: string };
  notes?: Record<string, string>;
}
export interface ProviderPayment {
  id: string;
  status: string;
  captured?: boolean;
  amount: number;
  currency: string;
  amount_refunded?: number;
  subscription_id?: string | null;
  invoice_id?: string | null;
  order_id?: string | null;
}
export interface ProviderSubscription { id: string; plan_id: string; status: string }
export type PaymentVerification = { ok: true } | { ok: false; reason: string };
const idIs = (value: unknown, prefix: string) => typeof value === "string" && new RegExp(`^${prefix}_[A-Za-z0-9]{1,64}$`).test(value);
const amountIs = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;

export function verifyCapturedSubscriptionPayment(input: {
  expected: CanonicalPaymentExpectation;
  payment: ProviderPayment;
  subscription: ProviderSubscription;
  plan: ProviderPlan;
  invoice?: { id: string; payment_id: string | null; subscription_id: string | null };
}): PaymentVerification {
  if (!input?.expected || !input.payment || !input.subscription || !input.plan) return { ok: false, reason: "missing_evidence" };
  const { expected: e, payment: p, subscription: s, plan } = input;
  if (!idIs(e.paymentId, "pay") || !idIs(e.subscriptionId, "sub") || !idIs(e.providerPlanId, "plan") ||
      !amountIs(e.amountPaise) || !amountIs(e.planAmountPaise) || !["monthly", "yearly"].includes(e.interval) ||
      e.purpose !== "subscription_charge") return { ok: false, reason: "invalid_expectation" };
  if (p.id !== e.paymentId || p.status !== "captured" || (p.captured !== undefined && p.captured !== true) ||
      p.currency !== "INR" || p.amount !== e.amountPaise ||
      (p.amount_refunded !== undefined && p.amount_refunded !== 0)) return { ok: false, reason: "invalid_payment" };
  if ((e.currentProviderPlanId !== undefined && !idIs(e.currentProviderPlanId, "plan")) ||
      s.id !== e.subscriptionId || s.plan_id !== (e.currentProviderPlanId ?? e.providerPlanId)) return { ok: false, reason: "relationship_mismatch" };
  if (input.invoice && (!idIs(p.invoice_id, "inv") || input.invoice.id !== p.invoice_id ||
      input.invoice.payment_id !== p.id || input.invoice.subscription_id !== s.id)) return { ok: false, reason: "relationship_mismatch" };
  if (p.subscription_id != null) {
    if (p.subscription_id !== s.id) return { ok: false, reason: "relationship_mismatch" };
  } else {
    const invoice = input.invoice;
    if (!idIs(p.invoice_id, "inv") || !invoice || invoice.id !== p.invoice_id ||
        invoice.payment_id !== p.id || invoice.subscription_id !== s.id) return { ok: false, reason: "relationship_mismatch" };
  }
  if (plan.id !== e.providerPlanId || plan.period !== e.interval || plan.interval !== 1 ||
      plan.item?.amount !== e.planAmountPaise || plan.item?.currency !== "INR") return { ok: false, reason: "plan_mismatch" };
  return { ok: true };
}
