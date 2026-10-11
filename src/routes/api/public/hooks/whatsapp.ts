import { createFileRoute } from "@tanstack/react-router";
import { handleWhatsAppIncomingRequest } from "@/lib/whatsapp-webhook.server";

export const Route = createFileRoute("/api/public/hooks/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => handleWhatsAppIncomingRequest(request),
      GET: async () => {
        const { resolveBaileysUrl } = await import("@/lib/baileys.server");
        const bUrl = await resolveBaileysUrl();
        let safeHost = "Not configured";
        if (bUrl) {
          try {
            safeHost = new URL(bUrl).hostname;
          } catch {
            safeHost = "Invalid URL format";
          }
        }
        return Response.json({
          ok: true,
          service: "ClinicX WhatsApp AI Webhook",
          whatsapp_server_configured: Boolean(bUrl),
          whatsapp_server_host: safeHost,
          webhook_path: "/api/public/hooks/whatsapp",
        });
      },
    },
  },
});
