import { createFileRoute } from "@tanstack/react-router";
import { handleWhatsAppIncomingRequest } from "@/lib/whatsapp-webhook.server";

export const Route = createFileRoute("/api/public/whatsapp/incoming")({
  server: {
    handlers: {
      POST: async ({ request }) => handleWhatsAppIncomingRequest(request),
      GET: async () => Response.json({ ok: true, service: "ClinicX WhatsApp Incoming Gateway" }),
    },
  },
});
