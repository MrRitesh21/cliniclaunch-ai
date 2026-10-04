import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { autoSubmitClinicToGoogleImpl } from "./gsc-pipeline.server";

export const submitClinicToGoogleServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      clinicId: z.string().uuid(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    return await autoSubmitClinicToGoogleImpl(data.clinicId);
  });
