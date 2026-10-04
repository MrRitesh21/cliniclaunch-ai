import { useOrganization } from "@/hooks/useOrganization";
import { AppNotInstalled } from "./AppNotInstalled";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, ReactNode, memo } from "react";

const CORE_ACTIVE_APPS = new Set([
  "queue",
  "consult",
  "consultation",
  "appointments",
  "patients",
  "prescriptions",
  "records",
  "emr",
  "crm",
  "analytics",
  "overview",
  "website",
  "website_builder",
  "qr_appointment",
  "qr_checkin",
]);

export const AppGuard = memo(({ appKey, children }: { appKey: string; children: ReactNode }) => {
  const { org, installedModuleIds } = useOrganization();

  const isInstalled = useMemo(() => {
    if (CORE_ACTIVE_APPS.has(appKey)) return true;
    return installedModuleIds.includes(appKey);
  }, [installedModuleIds, appKey]);

  if (org === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isInstalled) {
    return <AppNotInstalled appKey={appKey} />;
  }

  return <>{children}</>;
});

AppGuard.displayName = "AppGuard";
