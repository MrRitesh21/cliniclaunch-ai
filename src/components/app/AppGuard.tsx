import { useOrganization } from "@/hooks/useOrganization";
import { AppNotInstalled } from "./AppNotInstalled";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, ReactNode, memo } from "react";

export const AppGuard = memo(({ appKey, children }: { appKey: string; children: ReactNode }) => {
  const { org, installedModuleIds } = useOrganization();

  const isInstalled = useMemo(() => {
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
