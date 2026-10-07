import { useOrganization } from "@/hooks/useOrganization";
import { AppNotInstalled } from "./AppNotInstalled";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@tanstack/react-router";
import { ReactNode, memo } from "react";

/** UX only: JWT handlers and database policies remain the security boundary. */
export const AppGuard = memo(({ appKey, children }: { appKey: string; children: ReactNode }) => {
  const { org, installedModuleIds, planModuleIds, unavailableModuleIds, entitlement, authorityError, refresh } = useOrganization();
  if (org === undefined) return <div className="space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>;
  if (authorityError || !entitlement) return <div role="alert" className="rounded-xl border p-6"><p>{authorityError ?? "Clinic access is not verified."}</p><button className="text-primary underline mt-2" onClick={() => void refresh()}>Retry access check</button></div>;
  if (unavailableModuleIds?.includes(appKey)) return <div role="status" className="rounded-xl border p-6">This workflow is currently unavailable for your clinic. Contact support for availability; Billing and authorized export remain accessible.</div>;
  if (!entitlement.can_read || (entitlement.can_write && !planModuleIds.includes(appKey))) return <div className="rounded-xl border p-6 space-y-2"><h2 className="font-semibold">This feature isn't available with your current access</h2><p className="text-sm text-muted-foreground">Compare plans for continued access to this workflow. Your existing records aren't deleted by expiry.</p><Link to="/dashboard/billing" className="text-primary underline">View plans and export options</Link></div>;
  if (entitlement.can_read && !entitlement.can_write) return <>{children}</>;
  if (!installedModuleIds.includes(appKey)) return <AppNotInstalled appKey={appKey} />;
  return <>{children}</>;
});
AppGuard.displayName = "AppGuard";
