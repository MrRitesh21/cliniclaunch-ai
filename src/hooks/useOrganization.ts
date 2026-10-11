/**
 * @module useOrganization
 * @description Organization context hook and shared subscription state for ClinicX.
 *
 * ## Architecture
 *
 * This module uses a **module-level singleton store** pattern (not React Context) because:
 * 1. Multiple route-level components mount simultaneously after navigation and all need the
 *    same org snapshot without redundant network requests.
 * 2. React Context would require wrapping the entire app — the singleton avoids the context
 *    tree without sacrificing reactivity (each consumer subscribes via a Set of listeners).
 *
 * ### Data flow
 * ```
 * supabase.auth → useAuthReady → loadShared(userId)
 *                                       │
 *                              fetchSnapshot() → Supabase DB
 *                                       │
 *                                    publish() → listeners → setSnapshot() → re-render
 * ```
 *
 * ### Caching
 * - **In-memory:** 60-second TTL (`TTL_MS`). Shared across all `useOrganization()` callers.
 * - **localStorage:** org metadata only (not roles/entitlements). Used as a stale fallback for
 *   instant paint on first load; never used as an authority source for write operations.
 *
 * ### Security
 * - `authorityScope` is a composite key that ties role/entitlement grants to a specific
 *   `(generation, userId, orgId, role)` tuple. Stale snapshots from a previous user are
 *   rejected before returning from the hook.
 * - `authorityPending` is set during fetches; callers must treat this as "no grants" state.
 *
 * @see {@link OrgContext} for the full shape returned by the hook.
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { getClinicSubscription } from "@/lib/subscription.functions";
import type { SubscriptionSnapshot } from "@/lib/subscription.server";
import type { Database } from "@/integrations/supabase/types";
import { readCache, writeCache } from "@/lib/persist-cache";

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
  authorityUserId: string | null;
  authorityGeneration: number;
  authorityError: string | null;
  authorityPending: boolean;
  authorityScope: string | null;
  isSubscriptionExpired: boolean;
  refresh: () => Promise<void>;
}
type Snapshot = Omit<OrgContext, "refresh">;
const EMPTY: Snapshot = { org: null, role: null, installedModuleIds: [], planModuleIds: [], unavailableModuleIds: [], subscription: null, entitlement: null, authorityUserId: null, authorityGeneration: 0, authorityError: null, authorityPending: false, authorityScope: null, isSubscriptionExpired: false };
const TTL_MS = 60_000;
let cacheUserId: string | null = null;
let cacheAt = 0;
let cache: Snapshot | undefined;
let inFlight: Promise<Snapshot> | null = null;
let generation = 0;
const listeners = new Set<(s: Snapshot) => void>();
let authorityGeneration = 0;
function unverified(org: Organization | null | undefined, message = "Clinic access is not verified. Retry access check."): Snapshot {
  return { ...EMPTY, org, authorityError: message, isSubscriptionExpired: true };
}
function pending(s: Snapshot | undefined): Snapshot {
  // Retain only a UI mount identity, never previous role/entitlement grants.
  return { ...EMPTY, org: s?.org, authorityPending: true, authorityScope: s?.authorityScope ?? null, authorityGeneration: s?.authorityGeneration ?? 0, isSubscriptionExpired: true };
}
function publish(s: Snapshot) {
  cache = { ...s, authorityGeneration: ++authorityGeneration };
  cacheAt = s.authorityUserId ? Date.now() : 0;
  if (cacheUserId && s.org && s.authorityUserId === cacheUserId) {
    // Persistence is shell metadata only, never a source of write/manage authority.
    writeCache(`org_snapshot:${cacheUserId}`, { org: s.org });
  }
  listeners.forEach(l => l(cache!));
  return cache;
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
    subscription: subResult.data ?? null, entitlement: authority, authorityUserId: userId, authorityGeneration: 0, authorityError: null, authorityPending: false, authorityScope: null,
    isSubscriptionExpired: !authority.can_read,
    planModuleIds: apply(Array.from(allowed)),
    unavailableModuleIds: Array.from(disabled),
    installedModuleIds: readOnly
      ? Array.from(new Set([...installed, ...clinical])).filter(id => !disabled.has(id))
      : apply([...installed, ...clinical, ...enabled, ...(authority.effective_state === "trialing" ? Array.from(allowed) : [])]).filter(id => id !== "attendance" || installed.includes("attendance")),
  };
}
function loadShared(userId: string, force = false): Promise<Snapshot> {
  if (cacheUserId !== userId) {
    cacheUserId = userId;
    const persisted = readCache<{ org: Organization }>(`org_snapshot:${userId}`, 7 * 24 * 60 * 60 * 1000);
    cache = unverified(persisted?.org ?? undefined);
    cacheAt = 0;
    inFlight = null;
    generation++;
    listeners.forEach(l => l(cache ?? { ...EMPTY, org: undefined }));
  }
  if (!force && cache?.authorityUserId === userId && Date.now() - cacheAt < TTL_MS) return Promise.resolve(cache);
  if (inFlight) return inFlight;
  const token = generation;
  publish(pending(cache));
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) =>
    timeout = setTimeout(() => reject(new Error("Clinic access verification timed out. Check network connection.")), 10000)
  );
  inFlight = Promise.race([fetchSnapshot(userId), timeoutPromise]).catch((err: unknown): Snapshot => {
    console.error("[useOrganization] fetchSnapshot failed:", err);
    const persisted = readCache<{ org: Organization }>(`org_snapshot:${userId}`, 7 * 24 * 60 * 60 * 1000);
    return unverified(persisted?.org ?? (token === generation ? cache?.org : null) ?? null,
      "Subscription access could not be verified. Retry before continuing clinic operations.");
  }).then(s => {
    if (token === generation && userId === cacheUserId) return publish({ ...s, authorityScope: s.entitlement && s.org ? `${token}:${userId}:${s.org.id}:${s.role}` : null });
    return s;
  }).finally(() => { clearTimeout(timeout); if (token === generation) inFlight = null; });
  return inFlight;
}
export function useOrganization(): OrgContext {
  const { isReady, user } = useAuthReady();
  const [, setSnapshot] = useState<Snapshot>(() => {
    if (!user) return { ...EMPTY, org: undefined };
    if (cacheUserId === user.id && cache) return cache;
    const persisted = readCache<{ org: Organization }>(`org_snapshot:${user.id}`, 7 * 24 * 60 * 60 * 1000);
    if (persisted) return unverified(persisted.org);
    return { ...EMPTY, org: undefined };
  });
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
  if (!isReady || !user) return { ...EMPTY, org: user ? undefined : null, refresh };
  if (cacheUserId !== user.id) return { ...EMPTY, org: undefined, refresh };
  // Read the shared caller-bound value, not a subscriber state queued for an older caller.
  const snapshot = cache ?? { ...EMPTY, org: undefined };
  if (snapshot.entitlement && (snapshot.authorityUserId !== user.id || Date.now() - cacheAt >= TTL_MS)) {
    return { ...pending(snapshot), refresh };
  }
  return { ...snapshot, refresh };
}
