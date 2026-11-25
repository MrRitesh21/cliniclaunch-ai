import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env.server";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
};

function isAuthorizedAdminOrCron(request: Request): boolean {
  const expected = (serverEnv.CRON_KEY || "").trim();
  if (!expected) return false;
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const provided = (
    request.headers.get("x-cron-key") ||
    bearer ||
    new URL(request.url).searchParams.get("key") ||
    ""
  ).trim();
  if (!provided) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/fix-subscription")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthorizedAdminOrCron(request)) {
          return Response.json(
            { success: false, error: "Unauthorized" },
            { status: 401, headers: NO_STORE_HEADERS },
          );
        }

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
              { status: result.ok ? 200 : 400, headers: NO_STORE_HEADERS },
            );
          }

          const result = await healAllSubscriptions();
          return Response.json(
            {
              success: result.ok,
              healed_count: result.healedCount,
              errors: result.errors,
            },
            { status: result.ok ? 200 : 500, headers: NO_STORE_HEADERS },
          );
        } catch (err: any) {
          return Response.json(
            {
              success: false,
              error: err?.message || "Subscription heal failed",
            },
            { status: 500, headers: NO_STORE_HEADERS },
          );
        }
      },

      POST: async ({ request }) => {
        if (!isAuthorizedAdminOrCron(request)) {
          return Response.json(
            { success: false, error: "Unauthorized" },
            { status: 401, headers: NO_STORE_HEADERS },
          );
        }

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
              { status: result.ok ? 200 : 400, headers: NO_STORE_HEADERS },
            );
          }

          const result = await healAllSubscriptions();
          return Response.json(
            {
              success: result.ok,
              healed_count: result.healedCount,
              errors: result.errors,
            },
            { status: result.ok ? 200 : 500, headers: NO_STORE_HEADERS },
          );
        } catch (err: any) {
          return Response.json(
            {
              success: false,
              error: err?.message || "Subscription heal failed",
            },
            { status: 500, headers: NO_STORE_HEADERS },
          );
        }
      },
    },
  },
});
