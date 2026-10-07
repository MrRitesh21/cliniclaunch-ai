/** Tenant query scope. Shape checks alone are NOT authorization; resolve membership
 * and clinic ownership through withTenantContext before using an untrusted selection.
 */

export interface TenantContext {
  readonly organizationId: string;
  readonly clinicId?: string | null;
  readonly userId?: string;
}

export class TenantScopeError extends Error {
  constructor(message: string) {
    super(`[Tenant Isolation Violation] ${message}`);
    this.name = "TenantScopeError";
  }
}

/** Validate UUID shape only. This does not establish membership or entitlement. */
export function assertTenantScope(tenant: TenantContext): TenantContext {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!tenant || typeof tenant.organizationId !== "string" || !uuid.test(tenant.organizationId) ||
      (tenant.clinicId != null && !uuid.test(tenant.clinicId)) ||
      (tenant.userId != null && !uuid.test(tenant.userId))) {
    throw new TenantScopeError("Execution blocked: missing or invalid tenant UUID context");
  }
  return tenant;
}

/**
 * Wraps a Supabase query builder with strict organization filtering.
 */
export function scopeQuery<T extends { eq: (col: string, val: any) => T }>(
  query: T,
  tenant: TenantContext,
): T {
  assertTenantScope(tenant);
  let scoped = query.eq("organization_id", tenant.organizationId);
  if (tenant.clinicId) {
    scoped = scoped.eq("clinic_id", tenant.clinicId);
  }
  return scoped;
}
