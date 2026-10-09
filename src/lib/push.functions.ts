import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(16).max(300),
  auth: z.string().min(8).max(200),
  deviceLabel: z.string().max(120).optional(),
  userAgent: z.string().max(400).optional(),
  platform: z.string().max(80).optional(),
  expirationTime: z.number().nullable().optional(),
});

// Kept as an empty compatibility export for existing browser imports.
// Push must be configured with an explicit runtime key pair.
export const DEFAULT_VAPID_PUBLIC_KEY = "";

/** Public: the browser needs the VAPID public key to subscribe. Safe to expose. */
export const getPushConfig = createServerFn({ method: "GET" }).handler(async () => {
  const publicKey = process.env["VAPID_PUBLIC_KEY"]?.trim() ?? "";
  const privateKey = process.env["VAPID_PRIVATE_KEY"]?.trim() ?? "";
  const configured = Boolean(publicKey && privateKey);
  return { publicKey: configured ? publicKey : "", configured };
});

/**
 * Upserts one subscription per endpoint. A user may hold many endpoints at
 * once (one per browser/device); subscribing on a new device never removes
 * the others.
 */
export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => subscriptionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        device_label: data.deviceLabel ?? null,
        user_agent: data.userAgent ?? null,
        platform: data.platform ?? null,
        expiration_time: data.expirationTime ? new Date(data.expirationTime).toISOString() : null,
        enabled: true,
        failure_count: 0,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ endpoint: z.string().url().max(2000) }).parse(data))
  .handler(async ({ data, context }) => {
    // RLS restricts this to the caller's own rows.
    const { error } = await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyPushDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("push_subscriptions")
      .select(
        "id, endpoint, device_label, platform, enabled, created_at, last_used_at, categories, quiet_start, quiet_end, timezone",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const NOTIFICATION_CATEGORIES = [
  { id: "booking", label: "New bookings" },
  { id: "reminder", label: "Appointment reminders" },
  { id: "review", label: "Review requests & new reviews" },
  { id: "finance", label: "Payments & finance" },
  { id: "system", label: "System & security" },
  { id: "general", label: "Everything else" },
] as const;

const prefsSchema = z.object({
  endpoint: z.string().url().max(2000),
  categories: z.array(z.string().max(40)).max(20),
  quietStart: z.string().nullable().optional(),
  quietEnd: z.string().nullable().optional(),
  timezone: z.string().max(80).optional(),
});

/** Per-device alert types + quiet hours. RLS scopes the row to the caller. */
export const updatePushDevicePrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => prefsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const allowed = NOTIFICATION_CATEGORIES.map((c) => c.id as string);
    const categories = data.categories.filter((c) => allowed.includes(c));
    const { error } = await context.supabase
      .from("push_subscriptions")
      .update({
        categories,
        quiet_start: data.quietStart || null,
        quiet_end: data.quietEnd || null,
        ...(data.timezone ? { timezone: data.timezone } : {}),
      })
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Sends a test notification to the caller's own devices only. */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sendPushToUser } = await import("./web-push.server");
    return sendPushToUser(context.userId, {
      title: "ClinicX notifications are on",
      body: "This is how appointment alerts will look on this device.",
      icon: "/icon-512.png",
      badge: "/icon-512.png",
      url: "/dashboard",
      tag: "clinicx-test",
    });
  });
