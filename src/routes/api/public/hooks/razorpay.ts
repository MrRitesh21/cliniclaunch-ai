import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/razorpay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const [{ supabaseAdmin }, provider, { handleBillingWebhook }] = await Promise.all([
          import("@/integrations/supabase/client.server"),
          import("@/lib/razorpay.server"),
          import("@/lib/billing-webhook.server"),
        ]);
        return handleBillingWebhook(request, {
          admin: supabaseAdmin as unknown as import("@/lib/billing.server").BillingTransport,
          provider,
          verifySignature: provider.verifyWebhookSignature,
        });
      },
      GET: async () => Response.json({ ok: true, hint: "Razorpay webhook endpoint" }),
    },
  },
});
