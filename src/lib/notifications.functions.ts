import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InboxItem = {
  id: string;
  category: string;
  title: string;
  body: string | null;
  url: string | null;
  read_at: string | null;
  created_at: string;
};

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(50),
    }).parse(data),
  )
  .handler(async ({ data: { cursor, limit }, context }) => {
    let query = context.supabase
      .from("notifications")
      .select("id, category, title, body, url, read_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const items = (data ?? []) as InboxItem[];
    const hasMore = items.length > limit;
    const resultItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? resultItems[resultItems.length - 1].created_at : undefined;

    // We still want a global unread count, but maybe we should optimize this
    const { count } = await context.supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("read_at", null);

    return { items: resultItems, unread: count ?? 0, nextCursor };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ id: z.string().uuid(), opened: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);

    if (data.opened) {
      const { getUserPlanContext, recordPushEvents } = await import("./notifications.server");
      const { organizationId, planId } = await getUserPlanContext(context.userId);
      await recordPushEvents([
        {
          notificationId: data.id,
          userId: context.userId,
          organizationId,
          event: "opened",
          planId,
        },
      ]).catch(() => undefined);
    }
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Bulk read/unread toggle for one or more inbox items. */
export const setNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(100), read: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read_at: data.read ? new Date().toISOString() : null })
      .in("id", data.ids)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Permanently removes inbox items owned by the signed-in user. */
export const deleteNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .delete()
      .in("id", data.ids)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type PushAnalytics = {
  totals: { sent: number; delivered: number; clicked: number; opened: number; failed: number };
  byPlatform: Array<{ platform: string; sent: number; delivered: number; clicked: number }>;
  byPlan: Array<{ plan: string; sent: number; delivered: number; clicked: number }>;
};

/** 30-day push effectiveness for the signed-in user, sliced by device and plan. */
export const getPushAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PushAnalytics> => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await context.supabase
      .from("push_events")
      .select("event, platform, plan_id")
      .eq("user_id", context.userId)
      .gte("created_at", since)
      .limit(5000);
    if (error) throw new Error(error.message);

    const totals = { sent: 0, delivered: 0, clicked: 0, opened: 0, failed: 0 };
    const platform = new Map<string, { sent: number; delivered: number; clicked: number }>();
    const plan = new Map<string, { sent: number; delivered: number; clicked: number }>();

    for (const row of data ?? []) {
      const ev = row.event as keyof typeof totals;
      if (ev in totals) totals[ev] += 1;
      if (ev !== "sent" && ev !== "delivered" && ev !== "clicked") continue;

      const pKey = row.platform ?? "unknown";
      const planKey = row.plan_id ?? "none";
      const pBucket = platform.get(pKey) ?? { sent: 0, delivered: 0, clicked: 0 };
      pBucket[ev] += 1;
      platform.set(pKey, pBucket);
      const planBucket = plan.get(planKey) ?? { sent: 0, delivered: 0, clicked: 0 };
      planBucket[ev] += 1;
      plan.set(planKey, planBucket);
    }

    return {
      totals,
      byPlatform: [...platform.entries()].map(([k, v]) => ({ platform: k, ...v })),
      byPlan: [...plan.entries()].map(([k, v]) => ({ plan: k, ...v })),
    };
  });
