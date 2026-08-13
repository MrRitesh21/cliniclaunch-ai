import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Beacon endpoint for the service worker, which has no Supabase session.
 * Auth is the per-notification token embedded in the push payload, so only a
 * device that actually received that push can report on it.
 */
const schema = z.object({
  nid: z.string().uuid(),
  token: z.string().min(8).max(64),
  event: z.enum(["delivered", "clicked"]),
  platform: z.string().max(40).optional(),
});

export const Route = createFileRoute("/api/public/push-event")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed: z.infer<typeof schema>;
        try {
          parsed = schema.parse(await request.json());
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: notification } = await supabaseAdmin
          .from("notifications")
          .select("id, user_id, organization_id, event_token")
          .eq("id", parsed.nid)
          .maybeSingle();

        if (!notification || notification.event_token !== parsed.token) {
          return new Response("Not found", { status: 404 });
        }

        const { getUserPlanContext, recordPushEvents } = await import("@/lib/notifications.server");
        const { planId } = await getUserPlanContext(notification.user_id);
        await recordPushEvents([
          {
            notificationId: notification.id,
            userId: notification.user_id,
            organizationId: notification.organization_id,
            event: parsed.event,
            platform: parsed.platform ?? null,
            planId,
          },
        ]);

        return Response.json({ ok: true });
      },
    },
  },
});
