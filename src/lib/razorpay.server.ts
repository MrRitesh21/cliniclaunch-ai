// Server-only Razorpay REST client. Read env inside functions, not at module scope.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { ProviderPlan, ProviderPayment } from "./payment-verification.ts";
const BASE = "https://api.razorpay.com/v1";

function auth() {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id?.trim() || !secret?.trim()) throw new Error("Razorpay keys not configured");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function rzp<T>(path: string, init: RequestInit = {}): Promise<T> {
  const authorization = auth();
  const attempts = (!init.method || init.method === "GET") ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    let res: Response;
    let body: string;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error("deadline")); }, 8000);
      });
      const result = await Promise.race([
        fetch(`${BASE}${path}`, {
          ...init,
          headers: { "Content-Type": "application/json", ...(init.headers || {}), Authorization: authorization },
          redirect: "error",
          signal: controller.signal,
        }).then(async (response) => ({ res: response, body: response.ok ? await response.text() : "" })),
        deadline,
      ]);
      res = result.res;
      body = result.body;
    } catch {
      if (attempt + 1 < attempts) { await new Promise((resolve) => setTimeout(resolve, 100)); continue; }
      throw new Error("Razorpay transport failure");
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      void res.body?.cancel().catch(() => {});
      if ((res.status === 429 || res.status >= 500) && attempt + 1 < attempts) {
        const retryAfter = res.headers.get("Retry-After");
        // Never disregard a longer or unrecognised provider backoff. A durable caller may retry later.
        const delay = retryAfter === null ? 100 : (/^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Infinity);
        if (delay <= 1000) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
      throw new Error(`Razorpay request failed (HTTP ${res.status})`);
    }
    try {
      return JSON.parse(body) as T;
    } catch {
      throw new Error("Razorpay invalid response");
    }
  }
  throw new Error("Razorpay transport failure");
}

export interface PlanMappingOptions {
  existingPlanId?: string; // Trusted persisted provider mapping; never silently replace it.
  allowCreate?: boolean; // false is the read-only integration path; legacy callers retain create fallback.
}
function assertPlanMatches(plan: ProviderPlan, params: { amount_paise: number; interval: "monthly" | "yearly" }) {
  if (!plan || !validId(plan.id, "plan") || plan.period !== params.interval || plan.interval !== 1 ||
      plan.item?.amount !== params.amount_paise || plan.item?.currency !== "INR") throw new Error("Razorpay plan mismatch");
}
export async function createOrGetPlan(
  planKey: string,
  params: { name: string; amount_paise: number; interval: "monthly" | "yearly" },
  options: PlanMappingOptions = {},
) {
  if (!planKey?.trim() || !params?.name?.trim() || !Number.isSafeInteger(params.amount_paise) || params.amount_paise <= 0 ||
      !["monthly", "yearly"].includes(params.interval)) throw new Error("Razorpay invalid plan parameters");
  if (options.existingPlanId !== undefined) {
    if (!validId(options.existingPlanId, "plan")) throw new Error("Razorpay invalid plan ID");
    const existing = await rzp<ProviderPlan>(`/plans/${options.existingPlanId}`);
    assertPlanMatches(existing, params);
    if (existing.id !== options.existingPlanId) throw new Error("Razorpay plan mismatch");
    return existing.id;
  }
  // Scan completely before selecting a marker: ambiguous/mismatched mappings must not create duplicates.
  let found: string | undefined;
  const seen = new Set<string>();
  for (let page = 0; ; page++) {
    if (page >= 10) throw new Error("Razorpay incomplete plan scan");
    const list = await rzp<{ items: ProviderPlan[]; count?: unknown; entity?: unknown }>(
      `/plans?count=100&skip=${page * 100}`,
    );
    // Collection count describes this page, not total inventory; validate before trusting a short page or marker.
    if (!list || !Array.isArray(list.items) || list.items.length > 100 ||
        ("entity" in list && list.entity !== "collection") ||
        ("count" in list && (typeof list.count !== "number" || !Number.isSafeInteger(list.count) ||
          list.count < 0 || list.count !== list.items.length))) throw new Error("Razorpay invalid plan collection");
    for (const plan of list.items) {
      if (plan?.notes?.digiclini_key === planKey) {
        assertPlanMatches(plan, params);
        if (found && found !== plan.id) throw new Error("Razorpay ambiguous plans");
        found = plan.id;
      }
      if (!validId(plan?.id, "plan")) throw new Error("Razorpay invalid plan collection");
      if (seen.has(plan.id)) throw new Error("Razorpay incomplete plan scan");
      seen.add(plan.id);
    }
    if (list.items.length < 100) break;
  }
  if (found) return found;
  if (options.allowCreate === false) throw new Error("Razorpay plan creation disabled");
  const created = await rzp<{ id: string }>(`/plans`, {
    method: "POST",
    body: JSON.stringify({
      period: params.interval === "yearly" ? "yearly" : "monthly",
      interval: 1,
      item: { name: params.name, amount: params.amount_paise, currency: "INR" },
      notes: { digiclini_key: planKey },
    }),
  });
  if (!validId(created?.id, "plan")) throw new Error("Razorpay invalid created plan");
  const readback = await getPlan(created.id);
  assertPlanMatches(readback, params);
  return readback.id;
}

export async function createSubscription(
  rzpPlanId: string,
  notes: Record<string, string>,
  options?: { startAt?: number; upfrontAmountPaise?: number },
) {
  if (!validId(rzpPlanId, "plan")) throw new Error("Razorpay invalid plan ID");
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

// Official API: PATCH /subscriptions/:id. Never use the default 'now': it can charge proration.
export async function scheduleSubscriptionChange(subscriptionId: string, planId: string) {
  if (!validId(subscriptionId, "sub") || !validId(planId, "plan")) throw new Error("Razorpay invalid schedule IDs");
  return rzp<RecurringSubscription>(`/subscriptions/${subscriptionId}`, {
    method: "PATCH",
    body: JSON.stringify({ plan_id: planId, schedule_change_at: "cycle_end" }),
  });
}
export interface RecurringSubscription {
  id: string; status: string; plan_id: string;
  current_start?: number; current_end?: number; charge_at?: number | null;
  quantity?: number; offer_id?: string | null;
  has_scheduled_changes?: boolean; change_scheduled_at?: number | null;
  pause_initiated_by?: string | null; payment_method?: string;
}
export async function getScheduledSubscriptionChange(subscriptionId: string) {
  if (!validId(subscriptionId, "sub")) throw new Error("Razorpay invalid subscription ID");
  const remote = await rzp<RecurringSubscription>(`/subscriptions/${subscriptionId}/retrieve_scheduled_changes`);
  if (remote?.id !== subscriptionId) throw new Error("Razorpay scheduled subscription mismatch");
  return remote;
}
export async function resumeSubscription(subscriptionId: string) {
  if (!validId(subscriptionId, "sub")) throw new Error("Razorpay invalid subscription ID");
  return rzp<RecurringSubscription>(`/subscriptions/${subscriptionId}/resume`, {
    method: "POST", body: JSON.stringify({ resume_at: "now" }),
  });
}
export async function cancelSubscription(subscriptionId: string, atCycleEnd = true) {
  if (!validId(subscriptionId, "sub")) throw new Error("Razorpay invalid subscription ID");
  return await rzp<{ id: string; status: string }>(`/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ cancel_at_cycle_end: atCycleEnd ? 1 : 0 }),
  });
}

async function readEntity<T extends { id: string }>(kind: string, prefix: string, id: string): Promise<T> {
  if (!validId(id, prefix)) throw new Error("Razorpay invalid entity ID");
  const entity = await rzp<T>(`/${kind}/${id}`);
  if (!entity || entity.id !== id) throw new Error("Razorpay entity mismatch");
  return entity;
}

export async function getPlan(planId: string) {
  return readEntity<ProviderPlan>("plans", "plan", planId);
}
export async function getInvoice(invoiceId: string) {
  return readEntity<{ id: string; payment_id: string | null; subscription_id: string | null }>("invoices", "inv", invoiceId);
}

export async function getSubscription(subscriptionId: string) {
  if (!validId(subscriptionId, "sub")) throw new Error("Razorpay invalid subscription ID");
  return await readEntity<RecurringSubscription & { notes?: Record<string, string> }>("subscriptions", "sub", subscriptionId);
}

export async function getPayment(paymentId: string) {
  if (!validId(paymentId, "pay")) throw new Error("Razorpay invalid payment ID");
  return readEntity<ProviderPayment>("payments", "pay", paymentId);
}

export async function getSubscriptionInvoices(subscriptionId:string,count=2) {
  if (!validId(subscriptionId,"sub") || !Number.isInteger(count) || count<1 || count>5)
    throw new Error("Razorpay invalid bounded invoice scan");
  const list=await rzp<{entity:string;count:number;items:Array<{id:string;payment_id:string|null;subscription_id:string|null}>}>(
    `/invoices?subscription_id=${subscriptionId}&count=${count}&skip=0`,
  );
  if (!list || list.entity!=="collection" || !Array.isArray(list.items) || list.items.length>count ||
      list.count!==list.items.length || new Set(list.items.map(i=>i.id)).size!==list.items.length ||
      list.items.some(i=>!validId(i.id,"inv") || i.subscription_id!==subscriptionId || (i.payment_id!==null && !validId(i.payment_id,"pay"))))
    throw new Error("Razorpay invalid invoice collection");
  // Discovery only. Individual payment/invoice GETs remain mandatory authority.
  return list.items;
}
export async function getPayments(count = 100) {
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error("Razorpay invalid payment count");
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

function verifyHmac(rawBody: string | Uint8Array, signature: string, secret?: string) {
  if (!secret?.trim() || typeof signature !== "string" || !/^[a-f0-9]{64}$/.test(signature)) return false;
  if (typeof rawBody !== "string" && !(rawBody instanceof Uint8Array)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  return timingSafeEqual(Buffer.from(signature, "hex"), expected);
}

function validId(value: unknown, prefix: string): value is string {
  return typeof value === "string" && new RegExp(`^${prefix}_[A-Za-z0-9]{1,64}$`).test(value);
}

// subscriptionId MUST come from the server-owned checkout attempt, not the callback.
export function verifySubscriptionCheckoutSignature(paymentId: string, subscriptionId: string, signature: string) {
  if (!validId(paymentId, "pay") || !validId(subscriptionId, "sub")) return false;
  return verifyHmac(`${paymentId}|${subscriptionId}`, signature, process.env.RAZORPAY_KEY_SECRET);
}

export function verifyWebhookSignature(rawBody: string | Uint8Array, signature: string) {
  return verifyHmac(rawBody, signature, process.env.RAZORPAY_WEBHOOK_SECRET);
}
