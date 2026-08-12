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

/** Public: the browser needs the VAPID public key to subscribe. Safe to expose. */
export const getPushConfig = createServerFn({ method: "GET" }).handler(async () => {
  const publicKey = process.env["VAPID_PUBLIC_KEY"] ?? null;
  return { publicKey, configured: Boolean(publicKey && process.env["VAPID_PRIVATE_KEY"]) };
});

/**
 * Upserts one subscription per endpoint. A user may hold many endpoints at
 * once (one per browser/device); subscribing on a new device never removes
 * the others.
 */
export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => subscriptionSchema.parse(data))
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
  .inputValidator((data: unknown) => z.object({ endpoint: z.string().url().max(2000) }).parse(data))
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
      .select("id, endpoint, device_label, platform, enabled, created_at, last_used_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
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
