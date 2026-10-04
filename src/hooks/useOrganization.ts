import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { readCache, writeCache } from "@/lib/persist-cache";
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

type Snapshot = Omit<OrgContext, "refresh">;

const EMPTY: Snapshot = {
  org: null,
  role: null,
  installedModuleIds: [],
  planModuleIds: [],
  subscription: null,
  isSubscriptionExpired: false,
};

const ALL_KNOWN_MODULES = [
  "appointments",
  "queue",
  "consult",
  "consultation",
  "records",
  "emr",
  "prescriptions",
  "pharmacy",
  "lab",
  "finance",
  "billing",
  "inventory",
  "doctors",
  "staff",
  "website",
  "website_builder",
  "whatsapp",
  "reviews",
  "loyalty",
  "marketing",
  "seo",
  "crm",
  "patients",
  "ai_assistant",
  "qr_checkin",
  "qr_appointment",
  "analytics",
];

/**
 * Shared store. ~25 components call useOrganization(), and several of them mount
 * together on every dashboard navigation. Without a shared store each mount fired
 * 5 PostgREST queries, which was the single largest source of database traffic.
 * Now: one fetch per user per TTL, in-flight requests deduped, all subscribers
 * notified from one result.
 */
const TTL_MS = 5 * 60 * 1000;

let cacheUserId: string | null = null;
let cacheAt = 0;
let cache: Snapshot | undefined;
let inFlight: Promise<Snapshot> | null = null;
const listeners = new Set<(s: Snapshot) => void>();

const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function publish(s: Snapshot) {
  cache = s;
  cacheAt = Date.now();
  if (cacheUserId) writeCache(`org:${cacheUserId}`, s);
  listeners.forEach((l) => l(s));
}

async function fetchSnapshot(userId: string): Promise<Snapshot> {
  const { data: mem } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1);

  if (!mem || mem.length === 0) return EMPTY;

  const orgId = mem[0].organization_id;

  const [
    { data: orgRow },
    { data: modRows },
    { data: subRow },
    { data: planRows },
    { data: offGlobal },
    { data: ovRows },
  ] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", orgId).maybeSingle(),
    supabase.from("organization_modules").select("module_id").eq("organization_id", orgId),
    supabase.from("subscriptions").select("*").eq("organization_id", orgId).maybeSingle(),
    supabase.from("plans").select("id, module_ids"),
    supabase.from("modules").select("id").eq("is_available", false),
    supabase
      .from("organization_module_overrides" as any)
      .select("module_id, enabled")
      .eq("organization_id", orgId),
  ]);

  const targetEnd = subRow?.current_period_end ?? subRow?.trial_ends_at;
  const periodEndMs = targetEnd ? new Date(targetEnd).getTime() : null;
  const periodElapsed = periodEndMs !== null && periodEndMs < Date.now();
  const statusActive =
    !subRow ||
    (subRow &&
      (subRow.status === "active" || subRow.status === "trialing" || subRow.status === "past_due"));
  const statusCancelledNotElapsed =
    subRow &&
    ((subRow.status as string) === "cancelled" || (subRow.status as string) === "canceled") &&
    periodEndMs !== null &&
    !periodElapsed;
  const activePlanId =
    (statusActive && !periodElapsed) || statusCancelledNotElapsed
      ? (subRow?.plan_id ?? "enterprise")
      : "enterprise";

  const ids = (modRows ?? []).map((m) => m.module_id);
  const plan = (planRows ?? []).find((p) => p.id === activePlanId);
  const planAllowed = plan?.module_ids ?? [];
  const allowedSet = new Set(
    planAllowed.length > 0 ? [...planAllowed, ...ALL_KNOWN_MODULES] : ALL_KNOWN_MODULES,
  );

  // Admin on/off switches: platform-wide off, then per-clinic override wins.
  const disabled = new Set((offGlobal ?? []).map((m) => m.id));
  const forcedOn = new Set<string>();
  for (const o of ((ovRows as any[]) ?? []) as Array<{ module_id: string; enabled: boolean }>) {
    if (o.enabled) {
      disabled.delete(o.module_id);
      forcedOn.add(o.module_id);
    } else disabled.add(o.module_id);
  }
  const apply = (list: string[]) =>
    Array.from(new Set([...list, ...forcedOn])).filter((id) => !disabled.has(id));

  return {
    org: orgRow ?? null,
    role: mem[0].role,
    subscription: (subRow as Subscription) ?? null,
    isSubscriptionExpired: subRow !== null && periodElapsed && !statusActive,
    planModuleIds: apply(Array.from(allowedSet)),
    installedModuleIds: apply(
      ids.length > 0 ? Array.from(new Set([...ids, ...ALL_KNOWN_MODULES])) : ALL_KNOWN_MODULES,
    ),
  };
}

function loadShared(userId: string, force = false): Promise<Snapshot> {
  if (cacheUserId !== userId) {
    cacheUserId = userId;
    cache = undefined;
    cacheAt = 0;
    inFlight = null;
    // Paint the last known snapshot immediately, then revalidate below.
    const persisted = readCache<Snapshot>(`org:${userId}`, PERSIST_MAX_AGE_MS);
    if (persisted) {
      cache = persisted;
      listeners.forEach((l) => l(persisted));
    }
  }
  if (!force && cache && Date.now() - cacheAt < TTL_MS) return Promise.resolve(cache);
  if (inFlight) return inFlight;

  inFlight = fetchSnapshot(userId)
    .then((s) => {
      publish(s);
      return s;
    })
    .catch(() => {
      const fallback = cache ?? EMPTY;
      publish(fallback);
      return fallback;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export function useOrganization(): OrgContext {
  const { isReady, user } = useAuthReady();
  const [snapshot, setSnapshot] = useState<Snapshot>(() =>
    user && cacheUserId === user.id && cache ? cache : { ...EMPTY, org: undefined },
  );

  useEffect(() => {
    const listener = (s: Snapshot) => setSnapshot(s);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      cacheUserId = null;
      cache = undefined;
      setSnapshot(EMPTY);
      return;
    }
    void loadShared(user.id);
  }, [isReady, user]);

  const refresh = useCallback(async () => {
    if (!user) return;
    await loadShared(user.id, true);
  }, [user]);

  return { ...snapshot, refresh };
}
