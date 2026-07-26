import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/seo-autopilot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const provided =
          request.headers.get("x-cron-key") || url.searchParams.get("key") || "";
        const expected = process.env.CRON_KEY || "";
        if (!expected || provided !== expected) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }
        try {
          const { runAutopilotForAllClinics } = await import("@/lib/seo-autopilot.server");
          const out = await runAutopilotForAllClinics();
          return Response.json({ ok: true, ...out });
        } catch (e: any) {
          return Response.json({ ok: false, error: e.message }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST to run autopilot" }),
    },
  },
});