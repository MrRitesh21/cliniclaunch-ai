/**
 * @module tenant.middleware
 * @description Tenant context resolution middleware for ClinicX server functions.
 *
 * `withTenantContext` is the single entry point for establishing a verified
 * workspace selection in server functions. It:
 *
 * 1. Validates the shape of the caller-supplied `organizationId` and `clinicId`.
 * 2. Verifies that the JWT-bound user (`auth.userId`) is an active member of the
 *    requested organization by querying `organization_members`.
 * 3. If a `clinicId` is supplied, verifies clinic ownership within the org.
 * 4. Cross-checks optional `x-organization-id` / `x-clinic-id` request headers
 *    to detect routing mismatches early (fail-safe).
 *
 * **Never** bypass this function by constructing `TenantContext` objects manually
 * in a server function — use `assertTenantScope` only for shape validation.
 *
 * @see {@link assertTenantScope} for UUID-shape-only validation
 * @see {@link requireSupabaseAuth} for the JWT auth middleware
 */

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
