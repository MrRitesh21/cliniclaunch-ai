import { z } from "zod";
const time = z.string().datetime({ offset: true });
export const trialEmailConsentSchema = z.object({
  organization_id: z.string().uuid(),
  user_id: z.string().uuid(),
  email_enabled: z.boolean(),
  updated_at: time.nullable(),
});
export type TrialEmailConsent = z.infer<typeof trialEmailConsentSchema>;
export const trialUsageSchema = z.object({
  window: z.literal("trial"),
  window_started_at: time,
  window_ended_at: time,
  currency: z.literal("INR"),
  patients: z.number().int().nonnegative(),
  appointments: z.number().int().nonnegative(),
  completed_appointments: z.number().int().nonnegative(),
  visits: z.number().int().nonnegative(),
  completed_visits: z.number().int().nonnegative().nullable(),
  prescriptions: z.number().int().nonnegative(),
  invoices: z.number().int().nonnegative(),
  invoiced_inr: z.number().finite(),
  collected_inr: z.number().finite(),
  days_active: z.number().int().nonnegative(),
  days_active_basis: z.string(),
  completed_visits_unavailable_reason: z.string(),
});
export const trialEngagementSchema = z.object({
  organization_id: z.string().uuid(),
  server_now: time,
  usage: trialUsageSchema.nullable(),
  activation: z.array(z.object({ kind: z.string(), effective_at: time })),
  checkpoints: z.array(
    z.object({
      kind: z.string(),
      effective_at: time,
      recorded_at: time,
      usage: trialUsageSchema.nullable(),
    }),
  ),
});
export type TrialEngagement = z.infer<typeof trialEngagementSchema>;
export interface TrialClock {
  server_now: string;
  effective_state: string;
  subscription: {
    trial_started_at: string | null;
    trial_ends_at: string | null;
    grace_ends_at: string | null;
  };
}
/** Backend clock only. Presentation NEVER grants access or moves timestamps. */
export function trialCheckpoint(snapshot: TrialClock): number | null {
  if (!["trialing", "grace_period", "suspended"].includes(snapshot.effective_state)) return null;
  const start = Date.parse(snapshot.subscription.trial_started_at ?? "");
  const now = Date.parse(snapshot.server_now);
  if (!Number.isFinite(start) || !Number.isFinite(now) || now < start) return null;
  const end = Date.parse(snapshot.subscription.trial_ends_at ?? "");
  const grace = Date.parse(snapshot.subscription.grace_ends_at ?? "");
  if (Number.isFinite(grace) && now >= grace) return 37;
  if (Number.isFinite(end) && now >= end) return 30;
  const day = Math.floor((now - start) / 86400000);
  return [28, 25, 21, 15, 7, 0].find((value) => day >= value) ?? 0;
}
