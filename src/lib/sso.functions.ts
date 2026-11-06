import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const verifySsoTokenFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      data: z.string(),
      sig: z.string(),
    }).parse(input),
  )
  .handler(async ({ data: input }) => {
    const { verifySsoToken, generateSsoDeterministicPassword, provisionOrSyncDoctorAccount } = await import("./sso.server");
    const result = verifySsoToken(input.data, input.sig);
    if (!result.valid || !result.payload) {
      return { ok: false, error: result.error || "Invalid SSO token" } as const;
    }

    const { email, name, role, clinicSlug, target, phone } = result.payload;
    const password = generateSsoDeterministicPassword(email);

    // Server-side authoritative account provisioning in auth.users, profiles & organization_members
    const provisioned = await provisionOrSyncDoctorAccount({
      email,
      name: name || "Doctor",
      phone,
      clinicSlug,
      role: role || "doctor",
      password,
    });

    return {
      ok: true,
      userId: provisioned.userId,
      email,
      name: name || "Doctor",
      role: role || "doctor",
      password,
      clinicSlug: clinicSlug || undefined,
      orgId: provisioned.orgId || undefined,
      target: target || "/dashboard",
    } as const;
  });
