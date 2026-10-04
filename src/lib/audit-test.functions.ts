import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "./admin-auth.functions";

export const deleteAuditLog = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data: input }) => {
    const { deleteAuditLogImpl } = await import("./admin.server");
    return deleteAuditLogImpl(input);
  });
