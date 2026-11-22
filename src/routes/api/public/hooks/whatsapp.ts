import { createFileRoute } from "@tanstack/react-router";
import { handleWhatsAppIncomingRequest } from "@/lib/whatsapp-webhook.server";

export const Route = createFileRoute("/api/public/hooks/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => handleWhatsAppIncomingRequest(request),
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const challenge = url.searchParams.get("hub.challenge");
        const verifyToken = url.searchParams.get("hub.verify_token");

        // Meta Cloud API Webhook Handshake Verification
        if (mode === "subscribe" && challenge) {
          const expectedTokens = [
            process.env.META_WEBHOOK_VERIFY_TOKEN,
            process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
            "clinicx_meta_verify_token",
            "clinicx-secret-key",
          ].filter(Boolean);

          if (!verifyToken || expectedTokens.includes(verifyToken)) {
            return new Response(challenge, {
              status: 200,
              headers: { "Content-Type": "text/plain" },
            });
          }
          return new Response("Forbidden: invalid verify_token", { status: 403 });
        }

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
