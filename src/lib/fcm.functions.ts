/**
 * TanStack Start Server Functions for Firebase Cloud Messaging (FCM)
 * Provides authenticated device registration, preference management, and test push triggers.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tokenRegistrationSchema = z.object({
  token: z.string().min(10).max(4000),
  platform: z.enum(["web", "android", "ios"]).default("web"),
  deviceName: z.string().max(150).optional(),
  clinicId: z.string().uuid().optional(),
});

/**
 * Public: Returns client-safe Firebase configuration.
 * Never exposes service account private keys or emails.
 */
export const getFcmConfig = createServerFn({ method: "GET" }).handler(async () => {
  const projectId =
    process.env["VITE_FIREBASE_PROJECT_ID"] ||
    process.env["NEXT_PUBLIC_FIREBASE_PROJECT_ID"] ||
    process.env["FIREBASE_PROJECT_ID"] ||
    "";

  const apiKey =
    process.env["VITE_FIREBASE_API_KEY"] ||
    process.env["NEXT_PUBLIC_FIREBASE_API_KEY"] ||
    process.env["FIREBASE_API_KEY"] ||
    "";

  const messagingSenderId =
    process.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] ||
    process.env["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"] ||
    process.env["FIREBASE_MESSAGING_SENDER_ID"] ||
    "";

  const appId =
    process.env["VITE_FIREBASE_APP_ID"] ||
    process.env["NEXT_PUBLIC_FIREBASE_APP_ID"] ||
    process.env["FIREBASE_APP_ID"] ||
    "";

  const authDomain =
    process.env["VITE_FIREBASE_AUTH_DOMAIN"] ||
    process.env["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"] ||
    process.env["FIREBASE_AUTH_DOMAIN"] ||
    (projectId ? `${projectId}.firebaseapp.com` : "");

  const vapidKey =
    process.env["VITE_FIREBASE_VAPID_KEY"] ||
    process.env["NEXT_PUBLIC_FIREBASE_VAPID_KEY"] ||
    process.env["FIREBASE_VAPID_KEY"] ||
    process.env["VAPID_PUBLIC_KEY"] ||
    "";

  const configured = Boolean(projectId && (apiKey || vapidKey));

  return {
    configured,
    projectId,
    apiKey,
    authDomain,
    messagingSenderId,
    appId,
    vapidKey,
  };
});

/**
 * Registers an FCM Device Token for the authenticated user.
 * Upserts token so duplicate registrations from the same browser/device update last_seen_at.
 */
export const registerDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => tokenRegistrationSchema.parse(data))
  .handler(async ({ data, context }) => {
    let saved = false;

    // First attempt using service role admin client
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: adminErr } = await supabaseAdmin.from("device_tokens").upsert(
        {
          user_id: context.userId,
          clinic_id: data.clinicId || null,
          token: data.token,
          platform: data.platform,
          device_name: data.deviceName || null,
          is_active: true,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "token" },
      );
      if (!adminErr) saved = true;
    } catch {}

    // Fallback to user context client with RLS
    if (!saved) {
      const { error } = await context.supabase.from("device_tokens").upsert(
        {
          user_id: context.userId,
          clinic_id: data.clinicId || null,
          token: data.token,
          platform: data.platform,
          device_name: data.deviceName || null,
          is_active: true,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "token" },
      );
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

/**
 * Deactivates or removes an FCM registration token.
 */
export const unregisterDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ token: z.string().min(10) }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("device_tokens")
      .delete()
      .eq("token", data.token)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Lists all registered devices for the current logged in user.
 */
export const listMyDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("device_tokens")
      .select("id, token, platform, device_name, is_active, last_seen_at, created_at")
      .eq("user_id", context.userId)
      .eq("is_active", true)
      .order("last_seen_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

/**
 * Sends a test FCM notification to the caller's active registered devices.
 */
export const sendTestFcmPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sendPushNotification } = await import("./fcm.server");
    return sendPushNotification({
      recipientUserId: context.userId,
      title: "ClinicX Notification Test",
      body: "Firebase Cloud Messaging (FCM) is successfully connected to your clinic.",
      notificationType: "general",
      actionUrl: "/dashboard",
      data: {
        type: "test",
        source: "settings_test",
      },
    });
  });

/**
 * Preferences Schema
 */
const preferencesSchema = z.object({
  push_enabled: z.boolean().default(true),
  appointment_reminders: z.boolean().default(true),
  booking_alerts: z.boolean().default(true),
  marketing_alerts: z.boolean().default(false),
  quiet_start: z.string().nullable().optional(),
  quiet_end: z.string().nullable().optional(),
  timezone: z.string().default("Asia/Kolkata"),
});

export const getNotificationPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_notification_preferences")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    return (
      data || {
        user_id: context.userId,
        push_enabled: true,
        appointment_reminders: true,
        booking_alerts: true,
        marketing_alerts: false,
        quiet_start: null,
        quiet_end: null,
        timezone: "Asia/Kolkata",
      }
    );
  });

export const saveNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => preferencesSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_notification_preferences")
      .upsert({
        user_id: context.userId,
        ...data,
        updated_at: new Date().toISOString(),
      });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

const clinicAnnouncementSchema = z.object({
  clinicId: z.string().uuid(),
  title: z.string().min(2).max(120),
  body: z.string().min(2).max(500),
  actionUrl: z.string().optional(),
});

export const broadcastClinicAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => clinicAnnouncementSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: clinic } = await supabaseAdmin
      .from("clinics")
      .select("owner_id, organization_id")
      .eq("id", data.clinicId)
      .maybeSingle();

    if (!clinic) throw new Error("Clinic not found");

    const isOwner = clinic.owner_id === context.userId;
    if (!isOwner && clinic.organization_id) {
      const { data: member } = await supabaseAdmin
        .from("organization_members")
        .select("role")
        .eq("organization_id", clinic.organization_id)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!member) throw new Error("Unauthorized to broadcast to this clinic");
    }

    const { sendPushNotification } = await import("./fcm.server");
    return sendPushNotification({
      clinicId: data.clinicId,
      role: "all",
      title: `📢 ${data.title}`,
      body: data.body,
      notificationType: "announcement",
      actionUrl: data.actionUrl || "/dashboard",
    });
  });

const paymentNotificationSchema = z.object({
  clinicId: z.string().uuid().optional(),
  patientName: z.string().min(1),
  amount: z.number().positive(),
  paymentMode: z.string().default("UPI"),
  invoiceNumber: z.string().optional(),
});

export const sendPaymentInvoiceAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => paymentNotificationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { sendPushNotification } = await import("./fcm.server");
    return sendPushNotification({
      clinicId: data.clinicId,
      role: "doctor",
      recipientUserId: context.userId,
      title: `💳 Payment Recorded: ₹${data.amount}`,
      body: `Received ₹${data.amount} from ${data.patientName} via ${data.paymentMode}${data.invoiceNumber ? ` · Invoice #${data.invoiceNumber}` : ""}`,
      notificationType: "payment",
      actionUrl: "/dashboard/finance",
      data: {
        amount: data.amount,
        patientName: data.patientName,
        paymentMode: data.paymentMode,
      },
    });
  });
