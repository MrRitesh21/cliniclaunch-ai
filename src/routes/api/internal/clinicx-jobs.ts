import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
async function handler({ request }: { request: Request }) {
  const { handleClinicxJobs } = await import("@/lib/trial-engagement.server");
  return handleClinicxJobs(request, {
    // Server-only secret. VITE_* values are public and cannot authorize jobs.
    cronKey: process.env.CRON_KEY,
    run: async () => {
      if (
        !process.env.SUPABASE_SERVICE_ROLE_KEY ||
        !(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)
      ) {
        throw new Error("Scheduled service authority is not configured");
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { runTrialEngagementJobs, createTrialEmailSender } =
        await import("@/lib/trial-engagement.server");
      return runTrialEngagementJobs(
        supabaseAdmin as unknown as import("@/lib/trial-engagement.server").EngagementTransport,
        {
          sendEmail: process.env.RESEND_API_KEY
            ? createTrialEmailSender(process.env.RESEND_API_KEY)
            : null,
          batchSize: 10,
        },
      );
    },
  });
}
export const Route = createFileRoute("/api/internal/clinicx-jobs")({
  server: { handlers: { POST: handler, GET: handler } },
});
