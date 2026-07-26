import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { autoSubmitClinicToGoogleImpl } from "./gsc-pipeline.server";

export const submitClinicToGoogleServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        clinicId: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    return await autoSubmitClinicToGoogleImpl(data.clinicId);
  });
