import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const updateClinicSettingsServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        clinicId: z.string().uuid(),
        clinicSlug: z.string().optional(),
        updates: z.record(z.unknown()),
      })
      .parse(input),
  )
  .handler(async ({ data: input }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Prohibit modifying the public demo clinic via server function if requested
    if (input.clinicSlug === "demo-clinic") {
      return { ok: false, message: "Demo clinic cannot be modified." };
    }

    const { error } = await (supabaseAdmin as any)
      .from("clinics")
      .update(input.updates)
      .eq("id", input.clinicId);

    if (error) {
      throw new Error(`Failed to save settings: ${error.message}`);
    }

    return { ok: true };
  });
