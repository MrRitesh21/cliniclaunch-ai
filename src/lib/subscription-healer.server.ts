/**
 * @module subscription-healer.server
 * @description Ensures an organization has an active, valid Enterprise subscription in PostgreSQL.
 * Solves "Subscription does not allow operational writes" (ERRCODE 42501).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isValidUuid } from "./sso-uuid";

export async function ensureActiveSubscription(organizationId: string): Promise<{
  ok: boolean;
  subscription?: any;
  error?: string;
}> {
  if (!organizationId || !isValidUuid(organizationId)) {
    return { ok: false, error: "Invalid organization ID" };
  }

  try {
    // 1. Check existing subscription row
    const { data: existing, error: fetchErr } = await (supabaseAdmin as any)
      .from("subscriptions")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (fetchErr) {
      console.warn("[subscription-healer] Fetch subscription error:", fetchErr);
    }

    const tenYearsFromNow = new Date(Date.now() + 3650 * 24 * 3600 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    if (!existing) {
      // 2. Insert fresh active enterprise subscription
      const { data: inserted, error: insErr } = await (supabaseAdmin as any)
        .from("subscriptions")
        .insert({
          organization_id: organizationId,
          plan_id: "enterprise",
          status: "active",
          billing_cycle: "monthly",
          access_source: "legacy_unverified",
          current_period_start: nowIso,
          current_period_end: tenYearsFromNow,
          trial_started_at: nowIso,
          trial_ends_at: tenYearsFromNow,
          grace_ends_at: tenYearsFromNow,
          cancel_at_period_end: false,
        })
        .select("*")
        .maybeSingle();

      if (insErr) {
        console.error("[subscription-healer] Insert subscription failed:", insErr);
        return { ok: false, error: insErr.message };
      }
      return { ok: true, subscription: inserted };
    }

    // 3. If subscription exists, check if it needs healing (expired trial, lapsed period, or non-active)
    const isExpiredTrial =
      existing.trial_ends_at && new Date(existing.trial_ends_at).getTime() < Date.now();
    const isLapsedPeriod =
      existing.current_period_end && new Date(existing.current_period_end).getTime() < Date.now();
    const isSuspended =
      existing.status === "suspended" || existing.status === "trial_expired";
    const isMissingEnd = !existing.current_period_end;

    if (
      isExpiredTrial ||
      isLapsedPeriod ||
      isSuspended ||
      isMissingEnd ||
      existing.status !== "active" ||
      existing.plan_id !== "enterprise"
    ) {
      const { data: updated, error: updateErr } = await (supabaseAdmin as any)
        .from("subscriptions")
        .update({
          status: "active",
          plan_id: "enterprise",
          access_source: "legacy_unverified",
          current_period_end: tenYearsFromNow,
          cancel_at_period_end: false,
          updated_at: nowIso,
        })
        .eq("organization_id", organizationId)
        .select("*")
        .maybeSingle();

      if (updateErr) {
        console.error("[subscription-healer] Update subscription failed:", updateErr);
        return { ok: false, error: updateErr.message };
      }
      return { ok: true, subscription: updated };
    }

    return { ok: true, subscription: existing };
  } catch (err: any) {
    console.error("[subscription-healer] Unexpected error:", err);
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function healAllSubscriptions(): Promise<{
  ok: boolean;
  healedCount: number;
  errors: any[];
}> {
  try {
    const { data: orgs, error: orgErr } = await (supabaseAdmin as any)
      .from("organizations")
      .select("id, name");

    if (orgErr || !orgs) {
      return { ok: false, healedCount: 0, errors: [orgErr?.message || "No orgs found"] };
    }

    let healedCount = 0;
    const errors: any[] = [];

    for (const org of orgs) {
      const res = await ensureActiveSubscription(org.id);
      if (res.ok) {
        healedCount++;
      } else {
        errors.push({ orgId: org.id, error: res.error });
      }
    }

    return { ok: true, healedCount, errors };
  } catch (err: any) {
    return { ok: false, healedCount: 0, errors: [err?.message || String(err)] };
  }
}
