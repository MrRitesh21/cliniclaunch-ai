import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { trialEngagementSchema, trialEmailConsentSchema, type TrialEngagement, type TrialEmailConsent } from "./trial-engagement";
export interface EngagementTransport {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}
async function rpc(
  db: EngagementTransport,
  name: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const result = await db.rpc(name, args);
  if (result.error || result.data == null) throw new Error("Engagement authority unavailable");
  return result.data;
}
export async function readTrialEngagement(
  db: EngagementTransport,
  organizationId: string,
): Promise<TrialEngagement> {
  const dto = trialEngagementSchema.parse(
    await rpc(db, "clinicx_trial_engagement", { p_org: organizationId }),
  );
  if (dto.organization_id !== organizationId) throw new Error("Tenant response mismatch");
  return dto;
}
export async function readTrialEmailConsent(
  db: EngagementTransport,
  organizationId: string,
): Promise<TrialEmailConsent> {
  const dto = trialEmailConsentSchema.parse(
    await rpc(db, "clinicx_get_engagement_email", { p_org: organizationId }),
  );
  if (dto.organization_id !== organizationId) throw new Error("Tenant response mismatch");
  return dto;
}
const deliverySchema = z.object({
  id: z.string().uuid(),
  lease_token: z.string().uuid(),
  idempotency_key: z.string().min(1),
  to: z.string().email(),
  copy: z.object({ title: z.string(), body: z.string() }),
});
export type TrialEmailDelivery = z.infer<typeof deliverySchema>;
export function createTrialEmailSender(
  apiKey: string,
  transport: typeof fetch = fetch,
): (job: TrialEmailDelivery) => Promise<void> {
  return async (job) => {
    if (!apiKey) throw new Error("Email is not configured");
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("Email delivery requires retry"));
      }, 15000);
    });
    try {
      await Promise.race([deadline, (async () => {
        const response = await transport("https://api.resend.com/emails", {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": job.idempotency_key,
          },
          body: JSON.stringify({
            from: "ClinicX <notifications@cliniclaunch.ai>",
            to: [job.to],
            subject: job.copy.title,
            text: job.copy.body,
          }),
        });
        if (!response.ok) throw new Error("Email delivery requires retry");
        z.object({ id: z.string().min(1) }).parse(await response.json());
      })()]);
    } catch {
      // Never surface provider bodies, addresses or credentials.
      throw new Error("Email delivery requires retry");
    } finally {
      clearTimeout(timer);
    }
  };
}
export async function runTrialEngagementJobs(
  db: EngagementTransport,
  options: {
    sendEmail?: ((job: TrialEmailDelivery) => Promise<void>) | null;
    batchSize?: number;
  } = {},
): Promise<{
  lifecycle_events: number;
  prepared: number;
  delivered: number;
  retry_scheduled: number;
  suppressed: number;
  needs_review: number;
  email_configured: boolean;
}> {
  const limit = z
    .number()
    .int()
    .min(1)
    .max(50)
    .parse(options.batchSize ?? 10);
  // Reuse authoritative trial + paid-lapse lifecycle. No frontend or caller date.
  const lifecycle_events = z
    .number()
    .int()
    .parse(await rpc(db, "expire_lapsed_subscriptions"));
  const prepared = z
    .number()
    .int()
    .parse(await rpc(db, "clinicx_prepare_notification_delivery", { p_limit: limit }));
  const summary = {
    lifecycle_events,
    prepared,
    delivered: 0,
    retry_scheduled: 0,
    suppressed: 0,
    needs_review: 0,
    email_configured: !!options.sendEmail,
  };
  // Missing configuration is not successful external delivery; leave durable work unclaimed.
  if (!options.sendEmail) return summary;
  const jobs = z
    .array(deliverySchema)
    .parse(await rpc(db, "clinicx_claim_notification_delivery", { p_limit: limit }));
  for (const job of jobs) {
    // An earlier send can revoke consent/membership or activate paid access.
    // The DB fences this exact lease and checks fresh authority immediately
    // before transport; DB and an external provider cannot commit atomically.
    const preflight = z.enum(["send", "suppressed", "review", "lease_lost"]).parse(
      await rpc(db, "clinicx_preflight_notification_delivery", {
        p_id: job.id,
        p_token: job.lease_token,
      }),
    );
    if (preflight === "lease_lost") throw new Error("Delivery lease lost; reconciliation required");
    if (preflight === "suppressed") { summary.suppressed++; continue; }
    if (preflight === "review") { summary.needs_review++; continue; }
    let success = false;
    try {
      await options.sendEmail(job);
      success = true;
    } catch {
      /* durable sanitized retry below */
    }
    const acknowledged = z.boolean().parse(
      await rpc(db, "clinicx_finish_notification_delivery", {
        p_id: job.id,
        p_token: job.lease_token,
        p_success: success,
      }),
    );
    if (!acknowledged) throw new Error("Delivery lease lost; reconciliation required");
    if (success) summary.delivered++;
    else summary.retry_scheduled++;
  }
  return summary;
}
export async function handleClinicxJobs(
  request: Request,
  deps: { cronKey: string | undefined; run: () => Promise<unknown> },
): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  const provided = request.headers.get("x-cron-key") ?? "";
  if (
    !deps.cronKey ||
    !provided ||
    provided.length > 4096 ||
    !timingSafeEqual(
      createHash("sha256").update(provided).digest(),
      createHash("sha256").update(deps.cronKey).digest(),
    )
  ) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401, headers });
  }
  try {
    return Response.json({ ok: true, result: await deps.run() }, { headers });
  } catch {
    return Response.json(
      { ok: false, error: "Jobs require retry or reconciliation" },
      { status: 503, headers },
    );
  }
}
