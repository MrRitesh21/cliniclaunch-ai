import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const resolvePhoneIdentityFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      phone: z.string().trim().min(5).max(30),
    }).parse(input),
  )
  .handler(async ({ data: input }) => {
    const { resolvePhoneIdentity } = await import("./phone-auth.server");
    return resolvePhoneIdentity(input.phone);
  });

export const authenticatePhoneLoginFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      phone: z.string().trim().min(5).max(30),
      password: z.string().min(1),
    }).parse(input),
  )
  .handler(async ({ data: input }) => {
    const { authenticatePhoneLogin } = await import("./phone-auth.server");
    return authenticatePhoneLogin(input.phone, input.password);
  });
