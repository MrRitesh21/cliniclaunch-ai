import { useOrganization } from "@/hooks/useOrganization";
import { AppNotInstalled } from "./AppNotInstalled";
import { Skeleton } from "@/components/ui/skeleton";

export function AppGuard({ appKey, children }: { appKey: string; children: React.ReactNode }) {
  const { org, installedModuleIds } = useOrganization();

  if (org === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!installedModuleIds.includes(appKey)) {
    return <AppNotInstalled appKey={appKey} />;
  }

  return <>{children}</>;
}
