import { createFileRoute } from "@tanstack/react-router";
import { handleWhatsAppIncomingRequest } from "@/lib/whatsapp-webhook.server";

export const Route = createFileRoute("/api/public/whatsapp/incoming/$clinicId")({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        handleWhatsAppIncomingRequest(request, (params as { clinicId?: string })?.clinicId),
      GET: async () => Response.json({ ok: true, service: "ClinicX WhatsApp Clinic Gateway" }),
    },
  },
});
