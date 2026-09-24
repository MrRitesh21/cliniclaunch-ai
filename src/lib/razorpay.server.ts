// Server-only Razorpay REST client. Read env inside functions, not at module scope.
const BASE = "https://api.razorpay.com/v1";

function auth() {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new Error("Razorpay keys not configured");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function rzp<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: auth(),
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Razorpay ${res.status}: ${body.slice(0, 240)}`);
  return JSON.parse(body) as T;
}

export async function createOrGetPlan(
  planKey: string,
  params: { name: string; amount_paise: number; interval: "monthly" | "yearly" },
) {
  // Try to reuse via notes marker; otherwise create.
  const list = await rzp<{ items: Array<{ id: string; notes?: Record<string, string> }> }>(
    `/plans?count=100`,
  );
  const found = list.items.find((p) => p.notes?.digiclini_key === planKey);
  if (found) return found.id;
  const created = await rzp<{ id: string }>(`/plans`, {
    method: "POST",
    body: JSON.stringify({
      period: params.interval === "yearly" ? "yearly" : "monthly",
      interval: 1,
      item: { name: params.name, amount: params.amount_paise, currency: "INR" },
      notes: { digiclini_key: planKey },
    }),
  });
  return created.id;
}

export async function createSubscription(
  rzpPlanId: string,
  notes: Record<string, string>,
  options?: { startAt?: number; upfrontAmountPaise?: number },
) {
  const offerId = notes.__offer_id;
  // Strip internal fields from notes (Razorpay notes are user-visible metadata).
  const cleanNotes = Object.fromEntries(Object.entries(notes).filter(([k]) => !k.startsWith("__")));

  const body: Record<string, any> = {
    plan_id: rzpPlanId,
    // total_count is the number of billing cycles. Use a long horizon so
    // Razorpay autopay mandate covers many years and does not expire early.
    total_count: notes.billing_cycle === "yearly" ? 10 : 120,
    customer_notify: 1,
    notes: cleanNotes,
    ...(offerId ? { offer_id: offerId } : {}),
    ...(notes.notify_email || notes.notify_phone
      ? {
          notify_info: {
            notify_email: notes.notify_email || undefined,
            notify_phone: notes.notify_phone || undefined,
          },
        }
      : {}),
  };

  // If there is no Razorpay Offer ID applied, and we have an upfront amount (discounted first cycle),
  // we shift the subscription start date and collect the discounted amount upfront.
  if (!offerId && options?.startAt && options?.upfrontAmountPaise) {
    body.start_at = options.startAt;
    body.addons = [
      {
        item: {
          name: `${cleanNotes.coupon_code || "Discount"} - First Cycle`,
          amount: options.upfrontAmountPaise,
          currency: "INR",
        },
      },
    ];
  }

  return await rzp<{ id: string; short_url: string; status: string }>(`/subscriptions`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Create (or reuse) a one-time first-cycle discount offer for a subscription.
// Coupons discount only the FIRST billing cycle; the recurring autopay mandate
// stays at the full plan price so subsequent cycles charge in full.

export async function cancelSubscription(subscriptionId: string) {
  return await rzp<{ id: string; status: string }>(`/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ cancel_at_cycle_end: 1 }),
  });
}

export async function getSubscription(subscriptionId: string) {
  return await rzp<{
    id: string;
    status: string;
    plan_id: string;
    current_start?: number;
    current_end?: number;
    notes?: Record<string, string>;
  }>(`/subscriptions/${subscriptionId}`);
}

export async function getPayment(paymentId: string) {
  return await rzp<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    order_id?: string | null;
  }>(`/payments/${paymentId}`);
}

export async function getPayments(count = 100) {
  return await rzp<{
    entity: string;
    count: number;
    items: Array<{
      id: string;
      amount: number;
      currency: string;
      status: string;
      order_id?: string | null;
      notes?: Record<string, string>;
      created_at: number;
    }>;
  }>(`/payments?count=${count}`);
}

export function verifyWebhookSignature(rawBody: string, signature: string) {
  const { createHmac, timingSafeEqual } = require("crypto") as typeof import("crypto");
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET missing");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
