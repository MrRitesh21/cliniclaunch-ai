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
    .select(
      "id, organization_id, wa_status, wa_phone, wa_session_id, wa_linked_by, wa_connected_at",
    )
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
    const { baileysDelete, baileysCreateSession, baileysStatus, clinicSessionId } =
      await import("./baileys.server");
    const clinic = await getMyManagedClinic(context.supabase, context.userId);
    const sid = clinicSessionId(clinic.id);
    // Purge any stale previous session credentials before initializing a new pairing session
    try {
      await baileysDelete(sid);
    } catch {
      /* ignore if already gone */
    }
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
        .update({
          wa_status: "disconnected",
          wa_phone: null,
          wa_session_id: null,
          wa_linked_by: null,
          wa_connected_at: null,
        })
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
    try {
      await baileysDelete(sid);
    } catch {
      /* already gone */
    }
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
  .inputValidator((i: unknown) =>
    z
      .object({
        phone: z.string().trim().min(5).max(20),
        message: z.string().trim().min(1).max(2000),
      })
      .parse(i),
  )
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
    const { baileysCreateSession, baileysStatus, PLATFORM_ADMIN_SESSION } =
      await import("./baileys.server");
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
    try {
      await baileysDelete(PLATFORM_ADMIN_SESSION);
    } catch {
      /* */
    }
    return { ok: true };
  });

export const sendAdminTestWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        phone: z.string().trim().min(5).max(20),
        message: z.string().trim().min(1).max(2000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { baileysSend, baileysStatus, PLATFORM_ADMIN_SESSION } = await import("./baileys.server");
    const live = await baileysStatus(PLATFORM_ADMIN_SESSION);
    if (!live?.ready) throw new Error("Platform WhatsApp is not connected.");
    return baileysSend(PLATFORM_ADMIN_SESSION, data.phone, data.message);
  });
