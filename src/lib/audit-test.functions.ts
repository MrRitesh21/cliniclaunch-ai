import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const deleteAuditLog = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data: input }) => {
    const { deleteAuditLogImpl } = await import("./admin.server");
    return deleteAuditLogImpl(input);
  });
