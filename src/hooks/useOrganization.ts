import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import type { Database } from "@/integrations/supabase/types";

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type OrgRole = Database["public"]["Enums"]["org_role"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];

export interface OrgContext {
  org: Organization | null | undefined; // undefined = loading
  role: OrgRole | null;
  installedModuleIds: string[];
  subscription: Subscription | null;
  isSubscriptionExpired: boolean;
  refresh: () => Promise<void>;
}

export function useOrganization(): OrgContext {
  const { isReady, user } = useAuthReady();
  const [org, setOrg] = useState<Organization | null | undefined>(undefined);
  const [role, setRole] = useState<OrgRole | null>(null);
  const [installedModuleIds, setInstalledModuleIds] = useState<string[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isSubscriptionExpired, setIsSubscriptionExpired] = useState<boolean>(false);

  const load = useCallback(async () => {
    if (!user) {
      setOrg(null);
      setRole(null);
      setInstalledModuleIds([]);
      setSubscription(null);
      setIsSubscriptionExpired(false);
      return;
    }

    // Get first org the user is a member of
    const { data: mem } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1);

    if (!mem || mem.length === 0) {
      setOrg(null);
      setRole(null);
      setInstalledModuleIds([]);
      setSubscription(null);
      setIsSubscriptionExpired(false);
      return;
    }

    const orgId = mem[0].organization_id;
    setRole(mem[0].role);

    const [{ data: orgRow }, { data: modRows }, { data: subRow }, { data: planRows }] = await Promise.all([
      supabase.from("organizations").select("*").eq("id", orgId).maybeSingle(),
      supabase.from("organization_modules").select("module_id").eq("organization_id", orgId),
      supabase.from("subscriptions").select("*").eq("organization_id", orgId).maybeSingle(),
      supabase.from("plans").select("id, module_ids"),
    ]);

    setOrg(orgRow ?? null);
    setSubscription((subRow as Subscription) ?? null);

    // Determine the active plan ID. Any paid plan (including starter) requires a
    // valid subscription: trialing/active/past_due AND current_period_end not elapsed.
    // If the subscription is missing, cancelled, expired, or the period has lapsed,
    // there is NO active plan and all modules are locked until the user renews.
    const targetEnd = subRow?.current_period_end ?? subRow?.trial_ends_at;
    const periodEndMs = targetEnd ? new Date(targetEnd).getTime() : null;
    const periodElapsed = periodEndMs !== null && periodEndMs < Date.now();
    const statusActive = subRow && (subRow.status === "active" || subRow.status === "trialing" || subRow.status === "past_due");
    const statusCancelledNotElapsed = subRow && 
      (subRow.status === "cancelled" || subRow.status === "canceled") && 
      periodEndMs !== null && 
      !periodElapsed;
    const activePlanId = (statusActive && !periodElapsed) || statusCancelledNotElapsed ? subRow!.plan_id : null;

    // A subscription is expired if a subscription record exists but activePlanId is null.
    // If subRow is null, it means no subscription has ever been created, which is handled during onboarding.
    const isExpired = subRow !== null && !activePlanId;
    setIsSubscriptionExpired(isExpired);

    // Find the allowed module IDs from the database plans. No active plan → no modules allowed.
    const plan = activePlanId ? (planRows ?? []).find((p) => p.id === activePlanId) : null;
    const allowedModuleIds = plan?.module_ids ?? [];

    const allowedSet = new Set(allowedModuleIds);

    const ids = (modRows ?? []).map((m) => m.module_id);
    
    // Only return installed modules that are allowed under the current plan
    const filteredIds = ids.filter((id) => allowedSet.has(id));

    // Force "seo" inclusion if it is allowed under the current plan but not in the installed list
    if (allowedSet.has("seo") && !filteredIds.includes("seo")) {
      filteredIds.push("seo");
    }

    setInstalledModuleIds(filteredIds);
  }, [user]);

  useEffect(() => {
    if (!isReady) return;
    void load();
  }, [isReady, load]);

  return { org, role, installedModuleIds, subscription, isSubscriptionExpired, refresh: load };
}
