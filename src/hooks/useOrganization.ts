import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { getClinicSubscription } from "@/lib/subscription.functions";
import type { SubscriptionSnapshot } from "@/lib/subscription.server";
import type { Database } from "@/integrations/supabase/types";

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type OrgRole = Database["public"]["Enums"]["org_role"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export interface OrgContext {
  org: Organization | null | undefined;
  role: OrgRole | null;
  installedModuleIds: string[];
  planModuleIds: string[];
  unavailableModuleIds: string[];
  subscription: Subscription | null;
  entitlement: SubscriptionSnapshot | null;
  authorityError: string | null;
  isSubscriptionExpired: boolean;
  refresh: () => Promise<void>;
}
type Snapshot = Omit<OrgContext, "refresh">;
const EMPTY: Snapshot = { org: null, role: null, installedModuleIds: [], planModuleIds: [], unavailableModuleIds: [], subscription: null, entitlement: null, authorityError: null, isSubscriptionExpired: false };
const TTL_MS = 60_000;
let cacheUserId: string | null = null;
let cacheAt = 0;
let cache: Snapshot | undefined;
let inFlight: Promise<Snapshot> | null = null;
let generation = 0;
const listeners = new Set<(s: Snapshot) => void>();
function publish(s: Snapshot) {
  cache = s;
  cacheAt = Date.now();
  listeners.forEach(l => l(s));
}

let staticAliases: Array<{ alias: string; feature: string }> | null = null;
let staticDisabledModules: Array<{ id: string }> | null = null;

async function fetchSnapshot(userId: string): Promise<Snapshot> {
  const membership = await supabase.from("organization_members").select("organization_id, role").eq("user_id", userId).order("joined_at", { ascending: true }).limit(1);
  if (membership.error) throw membership.error;
  if (!membership.data?.length) return EMPTY;
  const orgId = membership.data[0].organization_id;

  const aliasPromise = staticAliases
    ? Promise.resolve({ data: staticAliases, error: null })
    : (supabase.from("clinicx_feature_aliases" as any).select("alias, feature") as PromiseLike<any>).then((res: any) => {
        if (!res.error && res.data) staticAliases = res.data;
        return res;
      });

  const globalPromise = staticDisabledModules
    ? Promise.resolve({ data: staticDisabledModules, error: null })
    : (supabase.from("modules").select("id").eq("is_available", false) as PromiseLike<any>).then((res: any) => {
        if (!res.error && res.data) staticDisabledModules = res.data;
        return res;
      });

  const [orgResult, modResult, subResult, globalResult, overrideResult, aliasResult, authority] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", orgId).maybeSingle(),
    supabase.from("organization_modules").select("module_id").eq("organization_id", orgId),
    supabase.from("subscriptions").select("*").eq("organization_id", orgId).maybeSingle(),
    globalPromise,
    supabase.from("organization_module_overrides" as any).select("module_id, enabled").eq("organization_id", orgId),
    // Local explicit read contract until generated Supabase types include this migration.
    aliasPromise,
    getClinicSubscription({ data: { organizationId: orgId } }),
  ]);
  for (const result of [orgResult, modResult, subResult, globalResult, overrideResult, aliasResult]) if (result.error) throw result.error;
  const aliases = (aliasResult.data ?? []) as unknown as Array<{ alias: string; feature: string }>;
  const allowed = new Set([...authority.features, ...aliases.filter(a => authority.features.includes(a.feature)).map(a => a.alias)]);
  const disabled = new Set<string>(((globalResult.data ?? []) as Array<{ id: string }>).map((m: { id: string }) => m.id));
  const enabled = new Set<string>();
  for (const o of (overrideResult.data ?? []) as unknown as Array<{ module_id: string; enabled: boolean }>) {
    if (o.enabled) enabled.add(o.module_id);
    else disabled.add(o.module_id);
  }
  // A UI override can enable an installation preference, NOT grant a purchased feature.
  const apply = (ids: string[]) => Array.from(new Set(ids)).filter(id => allowed.has(id) && !disabled.has(id));
  const installed = (modResult.data ?? []).map(m => m.module_id);
  // Existing core workflows need no app-store installation; still require server entitlement.
  const clinical = ["appointments", "queue", "patients", "records", "crm", "emr", "doctors", "visits", "prescriptions", "consult", "consultation", "billing", "website", "website_builder", "qr_checkin", "qr_appointment", "analytics"];
  const readOnly = authority.can_read && !authority.can_write;
  return {
    org: orgResult.data ?? null, role: authority.role,
    subscription: subResult.data ?? null, entitlement: authority, authorityError: null,
    isSubscriptionExpired: !authority.can_read,
    planModuleIds: apply(Array.from(allowed)),
    unavailableModuleIds: Array.from(disabled),
    installedModuleIds: readOnly
      ? Array.from(new Set([...installed, ...clinical])).filter(id => !disabled.has(id))
      : apply([...installed, ...clinical, ...enabled, ...(authority.effective_state === "trialing" ? Array.from(allowed) : [])]),
  };
}
function loadShared(userId: string, force = false): Promise<Snapshot> {
  if (cacheUserId !== userId) {
    cacheUserId = userId; cache = undefined; cacheAt = 0; inFlight = null; generation++;
    listeners.forEach(l => l({ ...EMPTY, org: undefined }));
  }
  if (!force && cache && Date.now() - cacheAt < TTL_MS) return Promise.resolve(cache);
  if (inFlight) return inFlight;
  const token = generation;
  inFlight = fetchSnapshot(userId).catch((err: unknown): Snapshot => {
    console.error("[useOrganization] fetchSnapshot failed:", err);
    return {
      ...EMPTY, org: cache?.org ?? null,
      authorityError: "Subscription access could not be verified. Retry before continuing clinic operations.",
      isSubscriptionExpired: true,
    };
  }).then(s => {
    if (token === generation && userId === cacheUserId) publish(s);
    return s;
  }).finally(() => { if (token === generation) inFlight = null; });
  return inFlight;
}
export function useOrganization(): OrgContext {
  const { isReady, user } = useAuthReady();
  const [snapshot, setSnapshot] = useState<Snapshot>(() => user && cacheUserId === user.id && cache ? cache : { ...EMPTY, org: undefined });
  useEffect(() => {
    listeners.add(setSnapshot);
    return () => { listeners.delete(setSnapshot); };
  }, []);
  useEffect(() => {
    if (!isReady) return;
    if (!user) { cacheUserId = null; cache = undefined; generation++; inFlight = null; publish(EMPTY); return; }
    void loadShared(user.id);
    // One deduped refresh per TTL, even though many components subscribe.
    const revalidate = () => { if (document.visibilityState === "visible") void loadShared(user.id); };
    const timer = window.setInterval(revalidate, TTL_MS);
    window.addEventListener("focus", revalidate);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", revalidate); };
  }, [isReady, user?.id]);
  const refresh = useCallback(async () => { if (user) await loadShared(user.id, true); }, [user?.id]);
  // Auth can change before effects run; never expose the previous caller's grants for one render.
  if (!isReady || !user || cacheUserId !== user.id) return { ...EMPTY, org: user ? undefined : null, refresh };
  return { ...snapshot, refresh };
}
