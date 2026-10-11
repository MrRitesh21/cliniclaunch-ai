import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { serverEnv } from "@/lib/env.server";
// Only this non-secret handler is imported before authentication. Admin and
// provider modules are deferred until the header has been authenticated.
export async function handler({request}:{request:Request}) {
  const {handleBillingJobs} = await import("@/lib/billing-webhook.server");
  return handleBillingJobs(request,{
    cronKey: serverEnv.CRON_KEY,
    run:async()=>{
      if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
          !serverEnv.SUPABASE_URL?.trim() ||
          !serverEnv.RAZORPAY_KEY_ID?.trim() || !serverEnv.RAZORPAY_KEY_SECRET?.trim())
        throw new Error("Billing reconciliation server configuration missing");
      const [{supabaseAdmin},provider,{runBillingJobs}] = await Promise.all([
        import("@/integrations/supabase/client.server"),import("@/lib/razorpay.server"),import("@/lib/billing-webhook.server"),
      ]);
      return runBillingJobs(supabaseAdmin as unknown as import("@/lib/billing.server").BillingTransport,provider);
    },
  });
}
export const Route = createFileRoute("/api/internal/clinicx-billing-jobs")({
  server:{handlers:{POST:handler,GET:handler}},
});
