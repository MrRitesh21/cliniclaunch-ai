/**
 * Server-only helpers for the in-app notification inbox and push analytics.
 * Every push we send also lands in the inbox so the doctor can review alerts
 * later, and every lifecycle event (sent/delivered/clicked/opened/failed) is
 * recorded with the device platform + plan for effectiveness reporting.
 */

export type NotificationInput = {
  userId: string;
  title: string;
  body?: string;
  url?: string;
  category?: string;
  meta?: Record<string, unknown>;
};

export type PushEventName = "sent" | "delivered" | "clicked" | "opened" | "failed";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Resolves the user's org + current plan so analytics can slice by plan. */
export async function getUserPlanContext(
  userId: string,
): Promise<{ organizationId: string | null; planId: string | null }> {
  const sb = await admin();
  const { data: mem } = await sb
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1);
  const organizationId = mem?.[0]?.organization_id ?? null;
  if (!organizationId) return { organizationId: null, planId: null };

  const { data: sub } = await sb
    .from("subscriptions")
    .select("plan_id, status, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1);

  return { organizationId, planId: sub?.[0]?.plan_id ?? null };
}

export async function createNotification(input: NotificationInput) {
  const sb = await admin();
  const { organizationId } = await getUserPlanContext(input.userId);
  const { data, error } = await sb
    .from("notifications")
    .insert({
      user_id: input.userId,
      organization_id: organizationId,
      category: input.category ?? "general",
      title: input.title,
      body: input.body ?? null,
      url: input.url ?? null,
      meta: (input.meta ?? {}) as never,
    })
    .select("id, event_token")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { id: string; event_token: string } | null;
}

/** Short, non-reversible endpoint fingerprint — we never store raw endpoints here. */
export async function hashEndpoint(endpoint: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function recordPushEvents(
  rows: Array<{
    notificationId?: string | null;
    userId: string;
    organizationId?: string | null;
    event: PushEventName;
    endpointHash?: string | null;
    platform?: string | null;
    planId?: string | null;
  }>,
) {
  if (!rows.length) return;
  const sb = await admin();
  await sb.from("push_events").insert(
    rows.map((r) => ({
      notification_id: r.notificationId ?? null,
      user_id: r.userId,
      organization_id: r.organizationId ?? null,
      event: r.event,
      endpoint_hash: r.endpointHash ?? null,
      platform: r.platform ?? null,
      plan_id: r.planId ?? null,
    })),
  );
}
