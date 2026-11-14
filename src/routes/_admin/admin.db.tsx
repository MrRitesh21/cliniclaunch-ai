import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDatabaseStats, runDatabaseCleanup } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Database, Trash2, Archive, RefreshCw, HardDrive, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/db")({
  component: DbToolsPage,
});

function DbToolsPage() {
  const queryClient = useQueryClient();

  const getStatsFn = useServerFn(getDatabaseStats);
  const runCleanupFn = useServerFn(runDatabaseCleanup);

  const { data: stats, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-db-stats"],
    queryFn: () => getStatsFn(),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  const cleanupMut = useMutation({
    mutationFn: (tool: "unverified" | "sessions" | "archive") => runCleanupFn({ data: { tool } }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-db-stats"] });
      toast.success(`Cleanup run complete. ${res.count} records cleared.`);
    },
    onError: (err: any) => toast.error(err.message || "Failed to run database cleanup"),
  });

  if (isLoading && !stats) {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center text-muted-foreground min-h-[350px]">
        <Loader2 className="size-8 animate-spin text-primary mb-2" />
        <span className="text-sm font-medium">Loading database statistics...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display flex items-center gap-2">
            <Database className="size-6 text-primary" />
            Database & Maintenance Tools
          </h1>
          <p className="text-sm text-muted-foreground">
            Examine record distributions, optimize tables, and purge transient session states.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && <Loader2 className="size-4 animate-spin text-primary" />}
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 text-xs">
            <RefreshCw className="size-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Stats */}
        <Card className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-base font-semibold text-foreground font-display flex items-center gap-2">
              <HardDrive className="size-4 text-primary" />
              Row Distribution
            </h3>
            <Badge variant="outline" className="text-xs font-mono">
              {stats?.dbSize || "—"}
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm border-b pb-2">
              <span className="text-muted-foreground">Doctor accounts</span>
              <span className="font-semibold text-foreground">{stats?.doctorCount ?? "—"}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b pb-2">
              <span className="text-muted-foreground">Patient records</span>
              <span className="font-semibold text-foreground">{stats?.patientCount ?? "—"}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b pb-2">
              <span className="text-muted-foreground">Visits & Bookings</span>
              <span className="font-semibold text-foreground">{stats?.appointmentCount ?? "—"}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b pb-2">
              <span className="text-muted-foreground">Audit log entries</span>
              <span className="font-semibold text-foreground">{stats?.auditLogCount ?? "—"}</span>
            </div>
            <div className="flex justify-between items-center text-sm pt-1">
              <span className="text-muted-foreground">Total Database Footprint</span>
              <span className="font-bold text-primary">{stats?.dbSize ?? "—"}</span>
            </div>
          </div>
        </Card>

        {/* Maintenance Tools */}
        <Card className="p-4 sm:p-6 space-y-4 lg:col-span-2">
          <div className="border-b pb-2">
            <h3 className="text-base font-semibold text-foreground font-display flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              Database Optimization Tasks
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Execute selective cleanup procedures directly to release storage and remove expired transient tokens.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
            <div className="p-3.5 border rounded-lg bg-card space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-sm font-semibold text-foreground block">
                  Clear Expired Sessions
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Purges session logs and authentication tokens that are expired or revoked.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 hover:bg-amber-500/10 mt-2"
                disabled={cleanupMut.isPending}
                onClick={() => cleanupMut.mutate("sessions")}
              >
                <Trash2 className="size-3.5 mr-1" />
                Clear Sessions
              </Button>
            </div>

            <div className="p-3.5 border rounded-lg bg-card space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-sm font-semibold text-foreground block">
                  Clear Unverified Signups
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Deletes clinic registration records that were never activated after 30+ days.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 hover:bg-amber-500/10 mt-2"
                disabled={cleanupMut.isPending}
                onClick={() => cleanupMut.mutate("unverified")}
              >
                <Trash2 className="size-3.5 mr-1" />
                Clear Signups
              </Button>
            </div>

            <div className="p-3.5 border rounded-lg bg-card space-y-2 flex flex-col justify-between">
              <div>
                <span className="text-sm font-semibold text-foreground block">
                  Archive Old Audit Logs
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Archives historic audit logs older than 90 days to free database table index pages.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-500/10 mt-2"
                disabled={cleanupMut.isPending}
                onClick={() => cleanupMut.mutate("archive")}
              >
                <Archive className="size-3.5 mr-1" />
                Archive Logs
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
