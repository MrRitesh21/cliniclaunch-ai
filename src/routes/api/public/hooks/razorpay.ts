import { createFileRoute } from "@tanstack/react-router";

// Map Razorpay subscription/payment events to local status + reminder rows.
// Key guarantees:
//  - subscription.charged updates current_period_end so the "next renewal"
//    date on the dashboard stays accurate.
//  - subscription.halted / .pending / payment.failed create a reminder row
//    so the customer sees an alert to fix their autopay mandate.
//  - Idempotent via webhook_events dedup on x-razorpay-event-id.

type RzpSubscription = {
  id: string;
  status: string;
  current_start?: number;
  current_end?: number;
  charge_at?: number;
  ended_at?: number;
  notes?: Record<string, string>;
};

type RzpPayment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  order_id?: string;
  subscription_id?: string;
  error_description?: string;
  notes?: Record<string, string>;
};

async function addReminder(
  sb: any,
  organization_id: string,
  kind: string,
  severity: "info" | "warning" | "critical",
  title: string,
  body: string,
) {
  // Collapse duplicates of the same active kind to avoid banner spam.
  const { data: existing } = await sb
    .from("subscription_reminders")
    .select("id")
    .eq("organization_id", organization_id)
    .eq("kind", kind)
    .is("dismissed_at", null)
    .maybeSingle();
  if (existing) {
    await sb
      .from("subscription_reminders")
      .update({ severity, title, body, created_at: new Date().toISOString() })
      .eq("id", (existing as { id: string }).id);
    return;
  }
  await sb.from("subscription_reminders").insert({
    organization_id,
    kind,
    severity,
    title,
    body,
  });
}

async function dismissReminders(sb: any, organization_id: string, kinds: string[]) {
  await sb
    .from("subscription_reminders")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("organization_id", organization_id)
    .is("dismissed_at", null)
    .in("kind", kinds);
}

export const Route = createFileRoute("/api/public/hooks/razorpay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const raw = await request.text();
          const signature = request.headers.get("x-razorpay-signature") ?? "";
          const { verifyWebhookSignature } = await import("@/lib/razorpay.server");
          if (!signature || !verifyWebhookSignature(raw, signature)) {
            return new Response("Invalid signature", { status: 401 });
          }
          const evt = JSON.parse(raw) as {
            event: string;
            payload: {
              subscription?: { entity?: RzpSubscription };
              payment?: { entity?: RzpPayment };
            };
          };
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Idempotency guard.
          let eventId = request.headers.get("x-razorpay-event-id") ?? "";
          if (!eventId) {
            const { createHash } = await import("crypto");
            eventId = `sha256:${createHash("sha256").update(raw).digest("hex")}`;
          }
          const { error: dedupError } = await supabaseAdmin
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .from("webhook_events" as any)
            .insert({ id: eventId, provider: "razorpay", event_type: evt.event, payload: evt } as any);
          if (dedupError) {
            if ((dedupError as { code?: string }).code === "23505") {
              return Response.json({ ok: true, deduped: true });
            }
            throw new Error(`webhook dedup failed: ${dedupError.message}`);
          }

          const sub = evt.payload?.subscription?.entity;
          const pay = evt.payload?.payment?.entity;

          // Resolve organization_id from subscription notes, payment notes,
          // or by looking up the local record via gateway_subscription_id.
          let orgId: string | null =
            pay?.notes?.organization_id ?? sub?.notes?.organization_id ?? null;
          const rzpSubId = sub?.id ?? pay?.subscription_id ?? (pay?.notes as any)?.subscription_id ?? null;
          if (!orgId && rzpSubId) {
            const { data: matched } = await supabaseAdmin
              .from("subscriptions")
              .select("organization_id")
              .eq("gateway_subscription_id", rzpSubId)
              .maybeSingle();
            if (matched) orgId = (matched as { organization_id: string }).organization_id;
          }

          // --- Subscription lifecycle updates ---
          if (sub) {
            const patch: Record<string, unknown> = {};
            switch (evt.event) {
              case "subscription.activated":
              case "subscription.authenticated":
                patch.status = "active";
                break;
              case "subscription.charged":
                patch.status = "active";
                patch.cancel_at_period_end = false;
                break;
              case "subscription.pending":
                // Payment attempt failed, Razorpay will retry.
                patch.status = "past_due";
                break;
              case "subscription.halted":
                // All retries failed. Autopay is dead until user re-authorizes.
                patch.status = "past_due";
                break;
              case "subscription.cancelled":
              case "subscription.completed":
                patch.status = "cancelled";
                break;
              case "subscription.paused":
              case "subscription.resumed":
                // No matching local enum value — reminder alone is enough.
                break;
              default:
                if (sub.status === "active" || sub.status === "authenticated") patch.status = "active";
            }

            // Always refresh the period window when Razorpay reports it. This
            // is how "next renewal date" stays correct after every renewal.
            if (sub.current_start) patch.current_period_start = new Date(sub.current_start * 1000).toISOString();
            if (sub.current_end) patch.current_period_end = new Date(sub.current_end * 1000).toISOString();

            if (Object.keys(patch).length > 0) {
              await supabaseAdmin
                .from("subscriptions")
                .update(patch as never)
                .eq("gateway_subscription_id", sub.id);
            }

            // Coupon usage on first activation.
            if (
              (evt.event === "subscription.activated" || evt.event === "subscription.charged") &&
              sub.notes?.coupon_code
            ) {
              const code = String(sub.notes.coupon_code).toUpperCase();
              const { data: c } = await supabaseAdmin
                .from("coupon_codes")
                .select("id, uses_count")
                .eq("code", code)
                .maybeSingle();
              if (c) {
                await supabaseAdmin
                  .from("coupon_codes")
                  .update({ uses_count: ((c as { uses_count: number | null }).uses_count ?? 0) + 1 } as never)
                  .eq("id", (c as { id: string }).id);
              }
            }

            // Reminder side-effects.
            if (orgId) {
              const sbAny = supabaseAdmin as any;
              const nextRenewal = sub.current_end
                ? new Date(sub.current_end * 1000).toLocaleDateString()
                : "your next cycle";
              if (evt.event === "subscription.charged" || evt.event === "subscription.activated") {
                // Clear any previous failure banners on a successful charge.
                await dismissReminders(sbAny, orgId, [
                  "autopay_halted",
                  "payment_failed",
                  "renewal_pending",
                ]);
              }
              if (evt.event === "subscription.pending") {
                await addReminder(
                  sbAny, orgId, "renewal_pending", "warning",
                  "Renewal payment pending",
                  "Razorpay could not charge your saved payment method. We'll retry automatically over the next few days. Please ensure your card/UPI has funds.",
                );
              }
              if (evt.event === "subscription.halted") {
                await addReminder(
                  sbAny, orgId, "autopay_halted", "critical",
                  "Autopay cancelled — action required",
                  "Your autopay mandate was cancelled or all retries failed. Renew your subscription now to keep access without interruption.",
                );
              }
              if (evt.event === "subscription.cancelled" || evt.event === "subscription.completed") {
                await addReminder(
                  sbAny, orgId, "subscription_cancelled", "warning",
                  "Subscription cancelled",
                  `Access will continue until ${nextRenewal}. Reactivate anytime to keep your plan.`,
                );
              }
              if (evt.event === "subscription.paused") {
                await addReminder(
                  sbAny, orgId, "subscription_paused", "warning",
                  "Subscription paused",
                  "Your subscription is currently paused. Resume it to restore billing and access.",
                );
              }
            }
          }

          // --- Payment events ---
          if (pay && orgId) {
            const sbAny = supabaseAdmin as any;

            // Fetch clinic owner user ID as doctor_id
            const { data: clinic } = await supabaseAdmin
              .from("clinics")
              .select("owner_id")
              .eq("organization_id", orgId)
              .maybeSingle();
            const doctorId = clinic?.owner_id || null;

            // Fetch subscription details for plan & billing cycle
            const { data: localSub } = await supabaseAdmin
              .from("subscriptions")
              .select("plan_id, billing_cycle")
              .eq("organization_id", orgId)
              .maybeSingle();

            const plan = localSub?.plan_id || sub?.notes?.plan_id || null;
            const cycle = localSub?.billing_cycle || sub?.notes?.billing_cycle || null;

            if (pay.status === "captured") {
              // Insert the txn + a paid invoice for the successful charge.
              await supabaseAdmin.from("transactions").insert({
                doctor_id: doctorId,
                amount: pay.amount / 100,
                currency: pay.currency,
                status: "captured",
                gateway: "razorpay",
                plan,
                billing_cycle: cycle,
                gateway_payment_id: pay.id,
                gateway_order_id: pay.order_id ?? null,
              } as never);
              await supabaseAdmin.from("invoices").insert({
                organization_id: orgId,
                amount: pay.amount / 100,
                invoice_number: `RZP-${pay.id.slice(-8).toUpperCase()}`,
                status: "paid",
                paid_at: new Date().toISOString(),
              } as never);
              await dismissReminders(sbAny, orgId, [
                "autopay_halted",
                "payment_failed",
                "renewal_pending",
              ]);
            } else if (evt.event === "payment.failed" || pay.status === "failed") {
              await supabaseAdmin.from("transactions").insert({
                doctor_id: doctorId,
                amount: pay.amount / 100,
                currency: pay.currency,
                status: "failed",
                gateway: "razorpay",
                plan,
                billing_cycle: cycle,
                gateway_payment_id: pay.id,
                gateway_order_id: pay.order_id ?? null,
              } as never);
              await addReminder(
                sbAny, orgId, "payment_failed", "critical",
                "Payment failed",
                pay.error_description
                  ? `Reason: ${pay.error_description}. Update your payment method to avoid service interruption.`
                  : "A payment attempt on your subscription failed. Update your payment method to avoid service interruption.",
              );
            }
          }

          return Response.json({ ok: true });
        } catch (e: unknown) {
          return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "Razorpay webhook endpoint" }),
    },
  },
});
