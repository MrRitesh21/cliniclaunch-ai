import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/google-oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        const redirectBase = "/dashboard/reviews";

        if (error) {
          return new Response(null, {
            status: 302,
            headers: {
              Location: `${redirectBase}?google_connect=error&error=${encodeURIComponent(error)}`,
            },
          });
        }

        if (!code || !state) {
          return new Response(null, {
            status: 302,
            headers: {
              Location: `${redirectBase}?google_connect=error&error=missing_code_or_state`,
            },
          });
        }

        try {
          const { processGoogleOAuthCallback } = await import("@/lib/gbp.server");
          const result = await processGoogleOAuthCallback(code, state);

          return new Response(null, {
            status: 302,
            headers: {
              Location: `${redirectBase}?google_connect=success&email=${encodeURIComponent(result.email || "")}&status=${result.apiApprovalStatus}`,
            },
          });
        } catch (err) {
          console.error("[GBP OAuth Callback Error]", err);
          return new Response(null, {
            status: 302,
            headers: {
              Location: `${redirectBase}?google_connect=error&error=${encodeURIComponent((err as Error).message)}`,
            },
          });
        }
      },
    },
  },
});
