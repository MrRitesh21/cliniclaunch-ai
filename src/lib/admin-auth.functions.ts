import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns the current admin profile (id/email/role) if the authenticated
 * Supabase user has a `super_admin` or `support` role in `user_roles`.
 * Throws "Forbidden" otherwise. Does NOT use the service-role key.
 */
export const getAdminMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;

    const { data, error } = await supabase
      .from("user_roles" as never)
      .select("role")
      .eq("user_id", userId);

    if (error) throw new Error("Failed to verify admin role");
    const roles = ((data ?? []) as Array<{ role: string }>).map((r) => r.role);
    const isSuper = roles.includes("super_admin");
    const isSupport = roles.includes("support");
    if (!isSuper && !isSupport) {
      throw new Error("Forbidden");
    }

    return {
      id: userId,
      email: (claims as { email?: string }).email ?? "",
      name:
        (claims as { user_metadata?: { full_name?: string } }).user_metadata?.full_name ?? "Admin",
      role: (isSuper ? "super_admin" : "support") as "super_admin" | "support",
      lastLogin: null as string | null,
    };
  });
