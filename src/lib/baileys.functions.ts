import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SB = any;

// Resolve the caller's clinic AND verify they have permission to manage WhatsApp for it.
// Only owners/admins/doctors of the clinic's organization may pair/disconnect/send.
async function getMyManagedClinic(supabase: SB, userId: string) {
  const { data: orgs } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .in("role", ["owner", "admin", "doctor"]);
  const orgIds = (orgs ?? []).map((o: { organization_id: string }) => o.organization_id);
  if (orgIds.length === 0) {
    throw new Error("Forbidden: you must be an owner, admin, or doctor to manage WhatsApp");
  }
  const { data: clinic, error } = await supabase
    .from("clinics")
    .select("id, organization_id, wa_status, wa_phone, wa_session_id, wa_linked_by, wa_connected_at")
    .in("organization_id", orgIds)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!clinic) throw new Error("No clinic found for your organization");
  return clinic as {
    id: string;
    organization_id: string;
    wa_status: string | null;
    wa_phone: string | null;
    wa_session_id: string | null;
    wa_linked_by: string | null;
    wa_connected_at: string | null;
  };
}

async function assertAdmin(supabase: SB, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["super_admin", "support"]);
  if (!data || data.length === 0) throw new Error("Forbidden");
}

// ------- Doctor (clinic) session management -------

export const startMyWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { baileysDelete, baileysCreateSession, baileysStatus, clinicSessionId } = await import("./baileys.server");
    const clinic = await getMyManagedClinic(context.supabase, context.userId);
    const sid = clinicSessionId(clinic.id);
    // Purge any stale previous session credentials before initializing a new pairing session
    try { await baileysDelete(sid); } catch { /* ignore if already gone */ }
    await baileysCreateSession(sid);
    await context.supabase
      .from("clinics")
      .update({
        wa_status: "pending",
        wa_phone: null,
        wa_session_id: sid,
        wa_linked_by: context.userId,
        wa_connected_at: null,
      })
      .eq("id", clinic.id);
    const status = await baileysStatus(sid);
    return { sessionId: sid, status };
  });

export const getWhatsappPairingCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({
    phone: z.string().trim().min(8).max(20),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { baileysPairingCode, baileysCreateSession, clinicSessionId } = await import("./baileys.server");
    const clinic = await getMyManagedClinic(context.supabase, context.userId);
    const sid = clinicSessionId(clinic.id);
    try { await baileysCreateSession(sid); } catch {}
    const res = await baileysPairingCode(sid, data.phone);
    const r = res as { code?: string; pairingCode?: string };
    const code = r?.code || r?.pairingCode || null;
    await context.supabase
      .from("clinics")
      .update({
        wa_status: "pending",
        wa_phone: data.phone,
        wa_session_id: sid,
        wa_linked_by: context.userId,
      })
      .eq("id", clinic.id);
    return { sessionId: sid, code, raw: res };
  });

export const getMyWhatsappStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { baileysStatus, clinicSessionId } = await import("./baileys.server");
    const clinic = await getMyManagedClinic(context.supabase, context.userId);
    const sid = clinicSessionId(clinic.id);
    const status = await baileysStatus(sid);

    if (status?.ready) {
      const phone = status.clientInfo?.phone ?? null;
      if (!phone) {
        // Refuse to persist a "ready" state without a verified phone identity.
        return { sessionId: sid, status, dbStatus: clinic.wa_status, warning: "no_phone_identity" };
      }
      if (clinic.wa_status !== "ready" || clinic.wa_phone !== phone) {
        await context.supabase
          .from("clinics")
          .update({
            wa_status: "ready",
            wa_phone: phone,
            wa_session_id: sid,
            wa_linked_by: clinic.wa_linked_by ?? context.userId,
            wa_connected_at: new Date().toISOString(),
          })
          .eq("id", clinic.id);
      }
    } else if (!status && clinic.wa_status !== "disconnected") {
      await context.supabase
        .from("clinics")
        .update({ wa_status: "disconnected", wa_phone: null, wa_session_id: null, wa_linked_by: null, wa_connected_at: null })
        .eq("id", clinic.id);
    }
    return { sessionId: sid, status, dbStatus: clinic.wa_status };
  });

export const disconnectMyWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { baileysDelete, clinicSessionId } = await import("./baileys.server");
    const clinic = await getMyManagedClinic(context.supabase, context.userId);
    const sid = clinicSessionId(clinic.id);
    // 1. Delete session auth files & logout from gateway server
    try { await baileysDelete(sid); } catch { /* already gone */ }
    // 2. Completely erase session details & phone number from database
    await context.supabase
      .from("clinics")
      .update({
        wa_status: "disconnected",
        wa_phone: null,
        wa_session_id: null,
        wa_linked_by: null,
        wa_connected_at: null,
      })
      .eq("id", clinic.id);
    return { ok: true };
  });

// ------- Test send -------

export const sendTestWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({
    phone: z.string().trim().min(5).max(20),
    message: z.string().trim().min(1).max(2000),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { baileysSend, baileysStatus, clinicSessionId } = await import("./baileys.server");
    const clinic = await getMyManagedClinic(context.supabase, context.userId);
    if (clinic.wa_status !== "ready" || !clinic.wa_phone) {
      throw new Error("WhatsApp is not linked for this clinic. Pair via the Connect tab first.");
    }
    const sid = clinicSessionId(clinic.id);
    // Re-verify with the gateway that this session is still owned by the linked phone.
    const live = await baileysStatus(sid);
    if (!live?.ready || live.clientInfo?.phone !== clinic.wa_phone) {
      throw new Error("Linked WhatsApp session is no longer active. Please reconnect.");
    }
    return baileysSend(sid, data.phone, data.message);
  });

// ------- Super admin (platform) session -------

export const startAdminWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { baileysCreateSession, baileysStatus, PLATFORM_ADMIN_SESSION } = await import("./baileys.server");
    await baileysCreateSession(PLATFORM_ADMIN_SESSION);
    const status = await baileysStatus(PLATFORM_ADMIN_SESSION);
    return { sessionId: PLATFORM_ADMIN_SESSION, status };
  });

export const getAdminWhatsappStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { baileysStatus, PLATFORM_ADMIN_SESSION } = await import("./baileys.server");
    const status = await baileysStatus(PLATFORM_ADMIN_SESSION);
    return { sessionId: PLATFORM_ADMIN_SESSION, status };
  });

export const disconnectAdminWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { baileysDelete, PLATFORM_ADMIN_SESSION } = await import("./baileys.server");
    try { await baileysDelete(PLATFORM_ADMIN_SESSION); } catch { /* */ }
    return { ok: true };
  });

export const sendAdminTestWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({
    phone: z.string().trim().min(5).max(20),
    message: z.string().trim().min(1).max(2000),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { baileysSend, baileysStatus, PLATFORM_ADMIN_SESSION } = await import("./baileys.server");
    const live = await baileysStatus(PLATFORM_ADMIN_SESSION);
    if (!live?.ready) throw new Error("Platform WhatsApp is not connected.");
    return baileysSend(PLATFORM_ADMIN_SESSION, data.phone, data.message);
  });

export const getAdminWhatsappDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { getBaileysUrl } = await import("./baileys.server");
    const { serverEnv } = await import("./env.server");
    const serverUrl = getBaileysUrl();

    const { count: readyClinics } = await context.supabase
      .from("clinics")
      .select("id", { count: "exact", head: true })
      .eq("wa_status", "ready");

    const { data: logs } = await context.supabase
      .from("whatsapp_logs")
      .select("id, organization_id, patient_name, patient_phone, message, template_key, status, error, sent_at, created_at")
      .order("created_at", { ascending: false })
      .limit(25);

    const appUrl = (serverEnv.APP_URL || "https://clinicx.digiwil.com").replace(/\/+$/, "");
    const webhookUrl = `${appUrl}/api/public/whatsapp/incoming`;
    const altWebhookUrl = `${appUrl}/api/public/hooks/whatsapp`;
    const webhookSecret = serverEnv.WHATSAPP_BRIDGE_SECRET || "clinicx-secret-key";

    return {
      serverUrl,
      isConfigured: Boolean(serverUrl),
      appUrl,
      webhookUrl,
      altWebhookUrl,
      webhookSecret,
      readyClinicsCount: readyClinics ?? 0,
      logs: logs || [],
    };
  });

export const pingAdminWhatsappGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { baileysPing } = await import("./baileys.server");
    return baileysPing();
  });

export const simulateAdminIncomingMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({
      message: z.string().trim().min(1).max(2000),
      patientPhone: z.string().trim().default("+919876543210"),
      patientName: z.string().trim().default("Test Patient"),
      clinicId: z.string().uuid().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { processWhatsAppMessage } = await import("./whatsapp-booking.server");
    const { baileysSend, clinicSessionId } = await import("./baileys.server");

    let clinicQuery = supabaseAdmin.from("clinics").select("*");
    if (data.clinicId) {
      clinicQuery = clinicQuery.eq("id", data.clinicId);
    } else {
      clinicQuery = clinicQuery.order("created_at", { ascending: true });
    }
    const { data: clinic } = await clinicQuery.limit(1).maybeSingle();

    if (!clinic) {
      throw new Error("No clinic found in the system to simulate message with.");
    }

    const bookingResult = await processWhatsAppMessage({
      clinic,
      patientPhone: data.patientPhone,
      senderName: data.patientName,
      incomingText: data.message,
    });

    const replySessionId = clinic.wa_session_id || clinicSessionId(clinic.id);
    const sendResult = await baileysSend(replySessionId, data.patientPhone, bookingResult.reply);

    return {
      clinic: {
        id: clinic.id,
        name: clinic.clinic_name,
        doctor: clinic.doctor_name,
        wa_status: clinic.wa_status,
        wa_phone: clinic.wa_phone,
      },
      parsedResult: bookingResult,
      sendResult,
    };
  });

