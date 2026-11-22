import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
  "Access-Control-Max-Age": "86400",
};

export const Route = createFileRoute("/api/public/fix-subscription")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: CORS_HEADERS,
        });
      },

      GET: async ({ request }) => {
        const { ensureActiveSubscription, healAllSubscriptions } = await import(
          "@/lib/subscription-healer.server"
        );
        const url = new URL(request.url);
        const orgId = url.searchParams.get("organization_id") || url.searchParams.get("org_id");

        try {
          if (orgId) {
            const result = await ensureActiveSubscription(orgId);
            return Response.json(
              {
                success: result.ok,
                organization_id: orgId,
                subscription: result.subscription,
                error: result.error,
              },
              { status: result.ok ? 200 : 400, headers: CORS_HEADERS },
            );
          }

          const result = await healAllSubscriptions();
          return Response.json(
            {
              success: result.ok,
              healed_count: result.healedCount,
              errors: result.errors,
            },
            { status: result.ok ? 200 : 500, headers: CORS_HEADERS },
          );
        } catch (err: any) {
          return Response.json(
            {
              success: false,
              error: err?.message || String(err),
            },
            { status: 500, headers: CORS_HEADERS },
          );
        }
      },

      POST: async ({ request }) => {
        const { ensureActiveSubscription, healAllSubscriptions } = await import(
          "@/lib/subscription-healer.server"
        );
        try {
          let orgId: string | undefined;
          try {
            const body = await request.json();
            orgId = body.organization_id || body.org_id;
          } catch {
            // body parse optional
          }

          if (orgId) {
            const result = await ensureActiveSubscription(orgId);
            return Response.json(
              {
                success: result.ok,
                organization_id: orgId,
                subscription: result.subscription,
                error: result.error,
              },
              { status: result.ok ? 200 : 400, headers: CORS_HEADERS },
            );
          }

          const result = await healAllSubscriptions();
          return Response.json(
            {
              success: result.ok,
              healed_count: result.healedCount,
              errors: result.errors,
            },
            { status: result.ok ? 200 : 500, headers: CORS_HEADERS },
          );
        } catch (err: any) {
          return Response.json(
            {
              success: false,
              error: err?.message || String(err),
            },
            { status: 500, headers: CORS_HEADERS },
          );
        }
      },
    },
  },
});
