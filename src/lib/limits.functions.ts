import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Auth attempt guard. Called from the login/register screens before hitting
 * Supabase auth so brute-force attempts are stopped by the shared Redis budget
 * rather than a per-isolate in-memory counter.
 *
 * Returns `{ ok: true }` or throws with a user-facing message.
 */
export const guardAuthAttempt = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ email: z.string().trim().max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { enforcePolicy, callerIp } = await import("./scale.server");
    await enforcePolicy("auth_ip", await callerIp());
    await enforcePolicy("auth_identity", data.email.toLowerCase());
    return { ok: true } as const;
  });
