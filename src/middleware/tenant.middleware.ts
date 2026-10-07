import { assertTenantScope, TenantContext, TenantScopeError } from "@/lib/tenant";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Resolve a requested workspace using the JWT-bound client from requireSupabaseAuth.
 * Headers are selection hints, never authority. Service-role clients must not be passed here.
 */
export async function withTenantContext(
  req: Request,
  auth: { supabase: SupabaseClient; userId: string },
  selection: { organizationId: string; clinicId?: string | null },
): Promise<TenantContext> {
  if (!auth?.supabase || !auth.userId) throw new TenantScopeError("Authentication required");
  const tenant = assertTenantScope({ ...selection, userId: auth.userId });
  const orgHeader = req.headers.get("x-organization-id");
  const clinicHeader = req.headers.get("x-clinic-id");
  if ((orgHeader !== null && orgHeader !== tenant.organizationId) ||
      (clinicHeader !== null && clinicHeader !== tenant.clinicId)) {
    throw new TenantScopeError("Requested workspace does not match selection");
  }

  const { data: member, error } = await auth.supabase
    .from("organization_members").select("role")
    .eq("organization_id", tenant.organizationId).eq("user_id", auth.userId).maybeSingle();
  if (error || !member) throw new TenantScopeError("Organization access denied");
  if (tenant.clinicId) {
    const { data: clinic, error: clinicError } = await auth.supabase
      .from("clinics").select("id")
      .eq("id", tenant.clinicId).eq("organization_id", tenant.organizationId).maybeSingle();
    if (clinicError || !clinic) throw new TenantScopeError("Clinic access denied");
  }
  return Object.freeze({ ...tenant });
}
