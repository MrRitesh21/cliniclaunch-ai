import { useOrganization } from "@/hooks/useOrganization";
import { AppNotInstalled } from "./AppNotInstalled";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@tanstack/react-router";
import { ReactNode, memo } from "react";
import { AuthorityBoundary } from './AuthorityBoundary';

/** UX only: JWT handlers and database policies remain the security boundary. */
export const AppGuard = memo(({ appKey, children }: { appKey: string; children: ReactNode }) => {
  const { org, installedModuleIds, planModuleIds, unavailableModuleIds, entitlement, authorityError, refresh } = useOrganization();
  let fallback: ReactNode = null;
  if (org === undefined) fallback = <div className="space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>;
  else if (authorityError || !entitlement) fallback = <div role="alert" className="rounded-xl border p-6"><p>{authorityError ?? "Clinic access is not verified."}</p><button className="text-primary underline mt-2" onClick={() => void refresh()}>Retry access check</button></div>;
  else if (unavailableModuleIds?.includes(appKey)) fallback = <div role="status" className="rounded-xl border p-6">This workflow is currently unavailable for your clinic. Contact support for availability; Billing and authorized export remain accessible.</div>;
  else if (!entitlement.can_read || (entitlement.can_write && !planModuleIds.includes(appKey))) fallback = <div className="rounded-xl border p-6 space-y-2"><h2 className="font-semibold">This feature isn't available with your current access</h2><p className="text-sm text-muted-foreground">Compare plans for continued access to this workflow. Your existing records aren't deleted by expiry.</p><Link to="/dashboard/billing" className="text-primary underline">View plans and export options</Link></div>;
  else if (entitlement.can_write && !installedModuleIds.includes(appKey)) fallback = <AppNotInstalled appKey={appKey} />;
  return <AuthorityBoundary allowed={!fallback} fallback={fallback}>{children}</AuthorityBoundary>;
});
AppGuard.displayName = "AppGuard";
