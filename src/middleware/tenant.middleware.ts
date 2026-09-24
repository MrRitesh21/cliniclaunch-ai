import { assertTenantScope, TenantContext } from "@/lib/tenant";

export function withTenantContext(
  req: Request,
  orgIdFromAuth?: string,
  clinicIdFromAuth?: string,
): TenantContext {
  const orgHeader = req.headers.get("x-organization-id");
  const clinicHeader = req.headers.get("x-clinic-id");

  const tenant: TenantContext = {
    organizationId: orgHeader || orgIdFromAuth || "",
    clinicId: clinicHeader || clinicIdFromAuth || null,
  };

  return assertTenantScope(tenant);
}
