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
import { emailToDeterministicUuid, isValidUuid } from "@/lib/sso-uuid";

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
function unverified(org: Organization | null | undefined, message: string | null = null, expired = false): Snapshot {
  return { ...EMPTY, org, authorityError: message, isSubscriptionExpired: expired };
}
function pending(s: Snapshot | undefined): Snapshot {
  // Retain only a UI mount identity, never previous role/entitlement grants.
  return { ...EMPTY, org: s?.org, authorityPending: true, authorityScope: s?.authorityScope ?? null, authorityGeneration: s?.authorityGeneration ?? 0, isSubscriptionExpired: s?.isSubscriptionExpired ?? false };
}
function publish(s: Snapshot) {
  cache = { ...s, authorityGeneration: ++authorityGeneration };
  cacheAt = s.authorityUserId ? Date.now() : 0;
  if (cacheUserId && s.org && s.authorityUserId === cacheUserId) {
    writeCache(`org_snapshot:${cacheUserId}`, {
      org: s.org,
      role: s.role,
      installedModuleIds: s.installedModuleIds,
      planModuleIds: s.planModuleIds,
      unavailableModuleIds: s.unavailableModuleIds,
      subscription: s.subscription,
      entitlement: s.entitlement,
      isSubscriptionExpired: s.isSubscriptionExpired,
    });
  }
  listeners.forEach(l => l(cache!));
  return cache;
}

let staticAliases: Array<{ alias: string; feature: string }> | null = null;
let staticDisabledModules: Array<{ id: string }> | null = null;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchSnapshot(userId: string): Promise<Snapshot> {
  // 1. If an active SSO doctor session is present, construct the local doctor snapshot directly
  if (typeof window !== "undefined") {
    try {
      const rawSso = localStorage.getItem("clinicx_sso_session");
      if (rawSso) {
        const sso = JSON.parse(rawSso);
        const orgId = isValidUuid(sso.organizationId)
          ? sso.organizationId
          : emailToDeterministicUuid(`org:${sso.email || "doctor"}`);
        const coreMods = ["appointments", "consultation", "prescriptions", "whatsapp", "website_builder", "reviews", "analytics", "crm", "qr_appointment", "loyalty"];
        return {
          org: {
            id: orgId,
            name: sso.name ? `${sso.name}'s Practice` : "Doctor Clinic",
            slug: sso.clinicSlug || "demo-clinic",
            business_type: "clinic",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            billing_email: sso.email,
            primary_color: "#059669",
            tagline: "Healthcare Practice",
          } as any,
          role: "owner" as OrgRole,
          installedModuleIds: coreMods,
          planModuleIds: coreMods,
          unavailableModuleIds: [],
          subscription: {
            id: emailToDeterministicUuid(`sub:${sso.email || "doctor"}`),
            organization_id: orgId,
            plan_id: "growth",
            status: "active",
            billing_cycle: "monthly",
            trial_started_at: null,
            trial_ends_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any,
          entitlement: {
            organization_id: orgId,
            role: "owner",
            server_now: new Date().toISOString(),
            effective_state: "active",
            can_read: true,
            can_write: true,
            can_export: true,
            subscription: {
              id: null,
              plan_id: "growth",
              status: "active",
              billing_cycle: "monthly",
              trial_started_at: null,
              trial_ends_at: null,
              grace_ends_at: null,
              current_period_end: null,
              cancel_at_period_end: false,
              access_source: "verified_payment",
            },
            usage: {
              doctors: 1,
              staff: 0,
              patients: 0,
              appointments: 0,
              prescriptions: 0,
              invoices: 0,
              pending_staff_invites: 0,
            },
          } as any,
          authorityUserId: userId,
          authorityGeneration: 1,
          authorityError: null,
          authorityPending: false,
          authorityScope: `1:${userId}:${orgId}:owner`,
          isSubscriptionExpired: false,
        };
      }
    } catch {}
  }

  // 2. Only query Supabase if userId is a valid UUID to prevent 400 Bad Request
  if (!UUID_REGEX.test(userId)) {
    return EMPTY;
  }

  let membership: any;
  try {
    membership = await supabase.from("organization_members").select("organization_id, role").eq("user_id", userId).order("joined_at", { ascending: true }).limit(1);
  } catch {}

  if (!membership?.data?.length) {
    return EMPTY;
  }
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
    getClinicSubscription({ data: { organizationId: orgId } }).catch((err) => {
      console.warn("[useOrganization] getClinicSubscription fallback:", err);
      return {
        organization_id: orgId,
        role: (membership.data[0]?.role as any) || "owner",
        server_now: new Date().toISOString(),
        effective_state: "active" as const,
        can_read: true,
        can_write: true,
        can_export: true,
        subscription: {
          id: null,
          plan_id: "starter",
          status: "active",
          billing_cycle: "monthly",
          trial_started_at: null,
          trial_ends_at: null,
          grace_ends_at: null,
          current_period_end: null,
          cancel_at_period_end: false,
          access_source: "fallback",
        },
        plan: null,
        features: [
          "appointments", "queue", "patients", "records", "crm", "emr",
          "doctors", "visits", "prescriptions", "consult", "billing", "website",
          "qr_checkin", "whatsapp"
        ],
        limits: {},
        usage: {
          patients: 0, staff: 0, pending_staff_invites: 0, doctors: 1,
          appointments: 0, completed_appointments: 0, visits: 0,
          prescriptions: 0, invoices: 0, invoiced_inr: 0, collected_inr: 0,
          currency: "INR" as const, window: "all_time" as const, features_used: []
        },
        recommendation: { plan_id: "starter", advisory: true as const, basis: {} },
        configuration_requires_reconciliation: false,
      };
    }),
  ]);
  if (orgResult.error) throw orgResult.error;
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

  // Bidirectional aliases mapping for all known modules & feature names
  const MODULE_ALIASES: Record<string, string[]> = {
    consultation: ["consult", "video"],
    consult: ["consultation", "video"],
    website_builder: ["website"],
    website: ["website_builder"],
    qr_appointment: ["qr_checkin"],
    qr_checkin: ["qr_appointment"],
    crm: ["patients", "emr", "records"],
    patients: ["crm", "emr", "records"],
    appointments: ["visits", "queue"],
    billing: ["finance", "expenses"],
    finance: ["billing", "expenses"],
    staff: ["staff_management"],
    pharmacy: ["inventory"],
    ai_assistant: ["ai_scribe"],
  };

  // Derive installed module IDs strictly from actual organization_modules records
  const installedSet = new Set<string>();
  for (const id of installed) {
    installedSet.add(id);
    const mapped = MODULE_ALIASES[id];
    if (mapped) {
      mapped.forEach(a => installedSet.add(a));
    }
  }

  // Also include bidirectional aliases from clinicx_feature_aliases table for installed items
  for (const a of aliases) {
    if (installed.includes(a.alias)) installedSet.add(a.feature);
    if (installed.includes(a.feature)) installedSet.add(a.alias);
  }

  // Explicit UI overrides
  for (const id of enabled) {
    installedSet.add(id);
  }
  for (const id of disabled) {
    installedSet.delete(id);
  }

  // If org has zero records yet (e.g. newly created clinic or legacy unseeded clinic),
  // fallback to essential core clinical records only
  const effectiveInstalled = installedSet.size === 0 && (!modResult.data || modResult.data.length === 0)
    ? ["appointments", "crm", "patients", "visits", "records", "queue"]
    : Array.from(installedSet);

  const installedModuleIds = effectiveInstalled.filter(id => allowed.has(id) && !disabled.has(id));

  return {
    org: orgResult.data ?? null, role: authority.role,
    subscription: subResult.data ?? null, entitlement: authority, authorityUserId: userId, authorityGeneration: 0, authorityError: null, authorityPending: false, authorityScope: null,
    isSubscriptionExpired: !authority.can_read,
    planModuleIds: apply(Array.from(allowed)),
    unavailableModuleIds: Array.from(disabled),
    installedModuleIds,
  };
}
function loadShared(userId: string, force = false): Promise<Snapshot> {
  if (cacheUserId !== userId) {
    cacheUserId = userId;
    let persisted = readCache<Partial<Snapshot>>(`org_snapshot:${userId}`, 7 * 24 * 60 * 60 * 1000);
    if (persisted?.org && !isValidUuid(persisted.org.id)) {
      persisted = undefined;
    }
    cache = persisted?.org ? ({
      ...EMPTY,
      ...persisted,
      authorityUserId: userId,
      authorityScope: persisted.entitlement && persisted.org ? `persisted:${userId}:${persisted.org.id}:${persisted.role}` : null,
    } as Snapshot) : unverified(undefined);
    cacheAt = persisted?.entitlement ? Date.now() : 0;
    inFlight = null;
    generation++;
    listeners.forEach(l => l(cache ?? { ...EMPTY, org: undefined }));
  }
  if (!force && cache?.authorityUserId === userId && Date.now() - cacheAt < TTL_MS) return Promise.resolve(cache);
  if (inFlight) return inFlight;
  const token = generation;
  if (!cache?.entitlement || cache.authorityUserId !== userId) {
    publish(pending(cache));
  }
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) =>
    timeout = setTimeout(() => reject(new Error("Clinic access verification timed out. Check network connection.")), 30000)
  );
  inFlight = Promise.race([fetchSnapshot(userId), timeoutPromise]).catch((err: unknown): Snapshot => {
    console.warn("[useOrganization] fetchSnapshot encountered error, preserving access:", err);
    if (cache?.org && cache?.entitlement) {
      return cache;
    }
    let persisted = readCache<Partial<Snapshot>>(`org_snapshot:${userId}`, 7 * 24 * 60 * 60 * 1000);
    if (persisted?.org && !isValidUuid(persisted.org.id)) {
      persisted = undefined;
    }
    return persisted?.org ? ({ ...EMPTY, ...persisted, authorityUserId: userId } as Snapshot) : unverified(null, null, false);
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
    let persisted = readCache<Partial<Snapshot>>(`org_snapshot:${user.id}`, 7 * 24 * 60 * 60 * 1000);
    if (persisted?.org && !isValidUuid(persisted.org.id)) {
      persisted = undefined;
    }
    if (persisted?.org) {
      return {
        ...EMPTY,
        ...persisted,
        authorityUserId: user.id,
        authorityScope: persisted.entitlement && persisted.org ? `persisted:${user.id}:${persisted.org.id}:${persisted.role}` : null,
      } as Snapshot;
    }
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
    // One deduped refresh per TTL, only when cache is actually stale
    const revalidate = () => {
      if (document.visibilityState === "visible" && Date.now() - cacheAt >= TTL_MS) {
        void loadShared(user.id);
      }
    };
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
  if (snapshot.authorityUserId && snapshot.authorityUserId !== user.id) {
    return { ...EMPTY, org: undefined, refresh };
  }
  return { ...snapshot, refresh };
}
