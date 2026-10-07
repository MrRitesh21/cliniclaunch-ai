import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "../integrations/supabase/auth-middleware";
import type { EngagementTransport } from "./trial-engagement.server";
import { trialEmailConsentSchema } from "./trial-engagement";
export const getClinicTrialEmailConsent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ organizationId: z.string().uuid() }).strict().parse(data),
  )
  .handler(async ({ data, context }) => {
    const { readTrialEmailConsent } = await import("./trial-engagement.server");
    return readTrialEmailConsent(
      context.supabase as unknown as EngagementTransport,
      data.organizationId,
    );
  });
export const getClinicTrialEngagement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ organizationId: z.string().uuid() }).strict().parse(data),
  )
  .handler(async ({ data, context }) => {
    const { readTrialEngagement } = await import("./trial-engagement.server");
    return readTrialEngagement(
      context.supabase as unknown as EngagementTransport,
      data.organizationId,
    );
  });
export const setClinicTrialEmailConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ organizationId: z.string().uuid(), enabled: z.boolean() }).strict().parse(data),
  )
  .handler(async ({ data, context }) => {
    const result = await (context.supabase as unknown as EngagementTransport).rpc(
      "clinicx_set_engagement_email",
      { p_org: data.organizationId, p_enabled: data.enabled },
    );
    if (result.error) throw new Error("Owner consent could not be saved");
    const dto = trialEmailConsentSchema.parse(result.data);
    if (dto.organization_id !== data.organizationId) throw new Error("Tenant response mismatch");
    return dto;
  });
