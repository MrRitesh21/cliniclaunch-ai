import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  billingRpc,
  createBillingService,
  type BillingProvider,
  type BillingTransport,
} from "./billing.server.ts";

export const billingWebhookSchema = z.object({
  event: z.string().min(1).max(100),
  payload: z
    .object({
      subscription: z
        .object({ entity: z.object({ id: z.string().optional() }).optional() })
        .optional(),
      payment: z
        .object({
          entity: z
            .object({
              id: z.string().optional(),
              subscription_id: z.string().nullable().optional(),
              invoice_id: z.string().nullable().optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});
export async function runBillingReconciliation(
  admin: BillingTransport,
  provider: BillingProvider,
  limit = 10,
): Promise<{ processed: number; retry_scheduled: number }> {
  const jobs = z
    .array(
      z.object({
        event_id: z.string(),
        lease_token: z.string().uuid(),
        payload: billingWebhookSchema,
      }),
    )
    .parse(await billingRpc(admin, "clinicx_claim_billing_events", { p_limit: limit }));
  let processed = 0;
  let retry_scheduled = 0;
  for (const job of jobs) {
    try {
      const result = await createBillingService(admin, admin, provider).webhook(
        job.event_id,
        job.payload,
      );
      if ((result as { pending?: boolean })?.pending) throw new Error("Capture pending");
      processed++;
    } catch {
      await billingRpc(admin, "clinicx_retry_billing_event", {
        p_event: job.event_id,
        p_token: job.lease_token,
      });
      retry_scheduled++;
    }
  }
  return { processed, retry_scheduled };
}
export async function runBillingJobs(admin: BillingTransport,provider: BillingProvider) {
  // Fixed bounded batches; durable leases/backoff own remaining work. Provider GETs
  // have bounded retries/deadlines. No create/cancel/update provider operation here.
  const events = await runBillingReconciliation(admin,provider,2);
  const commands = await createBillingService(admin,admin,provider).recoverCommands(2);
  return {...events,...commands};
}
export async function handleBillingJobs(request: Request,deps: {cronKey:string|undefined;run:()=>Promise<unknown>}):Promise<Response> {
  const headers={"Cache-Control":"no-store"};
  if (request.method !== "POST") return Response.json({ok:false,error:"POST required"},{status:405,headers:{...headers,Allow:"POST"}});
  const supplied=request.headers.get("x-cron-key")??"";
  if (!deps.cronKey?.trim() || !supplied || supplied.length>4096 || !timingSafeEqual(
    createHash("sha256").update(supplied).digest(),createHash("sha256").update(deps.cronKey).digest(),
  )) return Response.json({ok:false,error:"Unauthorized"},{status:401,headers});
  try { return Response.json({ok:true,result:await deps.run()},{headers}); }
  catch { return Response.json({ok:false,error:"Billing reconciliation unavailable; retry required"},{status:503,headers}); }
}
export interface WebhookDependencies {
  admin: BillingTransport;
  provider: BillingProvider;
  verifySignature: (raw: Uint8Array, signature: string) => boolean;
}
async function readBoundedBody(request: Request): Promise<Uint8Array> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 131072) throw new Error("body_too_large");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
export async function handleBillingWebhook(
  request: Request,
  deps: WebhookDependencies,
): Promise<Response> {
  let raw: Uint8Array;
  try {
    raw = await readBoundedBody(request);
  } catch {
    return Response.json({ ok: false, error: "Invalid webhook body" }, { status: 413 });
  }
  if (!deps.verifySignature(raw, request.headers.get("x-razorpay-signature") ?? ""))
    return Response.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  let event: z.infer<typeof billingWebhookSchema>;
  try {
    event = billingWebhookSchema.parse(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)),
    );
  } catch {
    return Response.json({ ok: false, error: "Invalid event" }, { status: 400 });
  }
  const eventId =
    request.headers.get("x-razorpay-event-id") ||
    `sha256:${createHash("sha256").update(raw).digest("hex")}`;
  if (eventId.length > 200)
    return Response.json({ ok: false, error: "Invalid event ID" }, { status: 400 });
  try {
    const queuedSchema = z.object({ completed: z.boolean() });
    const queued = queuedSchema.parse(
      await billingRpc(deps.admin, "clinicx_enqueue_billing_event", {
        p_event: eventId,
        p_payload: event,
      }),
    );
    if (queued.completed) return Response.json({ ok: true, deduped: true });
    // Enqueue succeeded; immediate processing is best-effort. Do not fail the webhook response.
    try {
      const result = await createBillingService(deps.admin, deps.admin, deps.provider).webhook(
        eventId,
        event,
      );
      if ("pending" in Object(result) && (result as { pending?: boolean }).pending)
        return Response.json({ ok: true, pending: true }, { status: 202 });
      return Response.json({ ok: true, result });
    } catch {
      // Immediate processing failed; reconciliation worker will handle it. Webhook still acknowledged.
      return Response.json({ ok: true, pending: true, requeued: true }, { status: 202 });
    }
  } catch {
    return Response.json(
      { ok: false, error: "Billing event requires retry/reconciliation" },
      { status: 503 },
    );
  }
}
