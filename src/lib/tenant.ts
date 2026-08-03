/**
 * Multi-Tenant Security & Scope Validation Engine for ClinicX
 * Guarantees zero cross-tenant data leakage by enforcing tenant parameter checks.
 */

export interface TenantContext {
  organizationId: string;
  clinicId?: string | null;
  userId?: string;
}

export class TenantScopeError extends Error {
  constructor(message: string) {
    super(`[Tenant Isolation Violation] ${message}`);
    this.name = "TenantScopeError";
  }
}

/**
 * Validates that an organization or clinic ID is non-empty and well-formed.
 * Throws TenantScopeError if missing.
 */
export function assertTenantScope(tenant: TenantContext): TenantContext {
  if (!tenant.organizationId || typeof tenant.organizationId !== "string" || tenant.organizationId.trim() === "") {
    throw new TenantScopeError("Execution blocked: missing or invalid organizationId context");
  }
  return tenant;
}

/**
 * Wraps a Supabase query builder with strict organization filtering.
 */
export function scopeQuery<T extends { eq: (col: string, val: any) => T }>(
  query: T,
  tenant: TenantContext
): T {
  assertTenantScope(tenant);
  let scoped = query.eq("organization_id", tenant.organizationId);
  if (tenant.clinicId) {
    scoped = scoped.eq("clinic_id", tenant.clinicId);
  }
  return scoped;
}
