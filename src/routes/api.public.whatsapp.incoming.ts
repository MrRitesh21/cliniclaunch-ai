import { createFileRoute } from "@tanstack/react-router";
import { handleWhatsAppIncomingRequest } from "@/lib/whatsapp-webhook.server";

export const Route = createFileRoute("/api/public/whatsapp/incoming")({
  server: {
    handlers: {
      POST: async ({ request }) => handleWhatsAppIncomingRequest(request),
      GET: async () => {
        const { resolveBaileysUrl } = await import("@/lib/baileys.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const bUrl = await resolveBaileysUrl();
        let safeHost = "Not configured";
        if (bUrl) {
          try {
            safeHost = new URL(bUrl).hostname;
          } catch {
            safeHost = "Invalid URL format";
          }
        }

        let clinicsList: any[] = [];
        let recentLogs: any[] = [];
        try {
          const { data: cData } = await supabaseAdmin
            .from("clinics")
            .select("id, clinic_name, doctor_name, wa_status, wa_phone, wa_session_id")
            .limit(5);
          clinicsList = (cData || []).map((c: any) => ({
            id: c.id,
            clinic: c.clinic_name,
            doctor: c.doctor_name,
            status: c.wa_status,
            phone: c.wa_phone,
            session_id: c.wa_session_id,
          }));

          const { data: lData } = await supabaseAdmin
            .from("whatsapp_logs")
            .select("id, patient_phone, template_key, status, error, created_at, sent_at")
            .order("created_at", { ascending: false })
            .limit(5);
          recentLogs = (lData || []).map((l: any) => ({
            id: l.id,
            phone_masked: l.patient_phone
              ? `${String(l.patient_phone).slice(0, 5)}***${String(l.patient_phone).slice(-3)}`
              : null,
            template: l.template_key,
            status: l.status,
            error: l.error,
            created_at: l.created_at,
          }));
        } catch {}

        return Response.json({
          ok: true,
          service: "ClinicX WhatsApp AI Receptionist Gateway",
          whatsapp_server_configured: Boolean(bUrl),
          whatsapp_server_host: safeHost,
          whatsapp_server_url: bUrl,
          webhook_path: "/api/public/whatsapp/incoming",
          active_clinics: clinicsList,
          recent_traffic: recentLogs,
          note: "Configure your WhatsApp Baileys bridge to POST incoming messages to this URL",
        });
      },
    },
  },
});
