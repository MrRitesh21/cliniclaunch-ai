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
  planModuleIds: string[]; // module ids allowed by the org's active plan
  subscription: Subscription | null;
  isSubscriptionExpired: boolean;
  refresh: () => Promise<void>;
}

export function useOrganization(): OrgContext {
  const { isReady, user } = useAuthReady();
  const [org, setOrg] = useState<Organization | null | undefined>(undefined);
  const [role, setRole] = useState<OrgRole | null>(null);
  const [installedModuleIds, setInstalledModuleIds] = useState<string[]>([]);
  const [planModuleIds, setPlanModuleIds] = useState<string[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isSubscriptionExpired, setIsSubscriptionExpired] = useState<boolean>(false);

  const load = useCallback(async () => {
    if (!user) {
      setOrg(null);
      setRole(null);
      setInstalledModuleIds([]);
      setPlanModuleIds([]);
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
      setPlanModuleIds([]);
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

    // Determine the active plan ID. If subRow is missing, default to full enterprise access
    // so new clinics and trial workspaces can access all features seamlessly.
    const targetEnd = subRow?.current_period_end ?? subRow?.trial_ends_at;
    const periodEndMs = targetEnd ? new Date(targetEnd).getTime() : null;
    const periodElapsed = periodEndMs !== null && periodEndMs < Date.now();
    const statusActive = !subRow || (subRow && (subRow.status === "active" || subRow.status === "trialing" || subRow.status === "past_due"));
    const statusCancelledNotElapsed = subRow && 
      ((subRow.status as string) === "cancelled" || (subRow.status as string) === "canceled") && 
      periodEndMs !== null && 
      !periodElapsed;
    const activePlanId = (statusActive && !periodElapsed) || statusCancelledNotElapsed ? (subRow?.plan_id ?? "enterprise") : "enterprise";

    const isExpired = subRow !== null && periodElapsed && !statusActive;
    setIsSubscriptionExpired(isExpired);

    // Fetch installed module IDs from database
    const ids = (modRows ?? []).map((m) => m.module_id);
    
    // Find allowed module IDs from plan or default to all standard modules
    const plan = (planRows ?? []).find((p) => p.id === activePlanId);
    const planAllowed = plan?.module_ids ?? [];
    
    // Combine plan allowed modules with all default core & operation modules and aliases
    const allKnownModules = [
      "appointments", "queue", "consult", "consultation", "records", "emr", "prescriptions", 
      "pharmacy", "lab", "finance", "billing", "inventory", "doctors", "staff", 
      "website", "website_builder", "whatsapp", "reviews", "loyalty", "marketing", "seo", 
      "crm", "patients", "ai_assistant", "qr_checkin", "qr_appointment", "analytics"
    ];

    const allowedSet = new Set(planAllowed.length > 0 ? [...planAllowed, ...allKnownModules] : allKnownModules);
    setPlanModuleIds(Array.from(allowedSet));

    // Ensure all core modules are available
    const mergedIds = Array.from(new Set([...ids, ...allKnownModules]));
    setInstalledModuleIds(mergedIds);
  }, [user]);

  useEffect(() => {
    if (!isReady) return;
    void load();
  }, [isReady, load]);

  return { org, role, installedModuleIds, planModuleIds, subscription, isSubscriptionExpired, refresh: load };
}
