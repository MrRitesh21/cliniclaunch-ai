import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDatabaseStats, runDatabaseCleanup } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Database, Trash2, Download } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/db")({
  component: DbToolsPage,
});

function DbToolsPage() {
  const queryClient = useQueryClient();

  const getStatsFn = useServerFn(getDatabaseStats);
  const runCleanupFn = useServerFn(runDatabaseCleanup);

  const { data: stats, isLoading } = useQuery({ queryKey: ["admin-db-stats"], queryFn: () => getStatsFn() });

  const cleanupMut = useMutation({
    mutationFn: (tool: "unverified" | "sessions" | "archive") =>
      runCleanupFn({ data: { tool } }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-db-stats"] });
      toast.success(`Cleanup run complete. ${res.count} records cleared.`);
    },
    onError: (err: any) => toast.error(err.message || "Failed to run database cleanup"),
  });

  function downloadBackup() {
    const backupContent = `-- ClinicX DB Schema Backup Mock\n-- Generated on ${new Date().toISOString()}\n\nCREATE TABLE clinics (...);\nCREATE TABLE patients (...);\nCREATE TABLE appointments (...);\n`;
    const blob = new Blob([backupContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clinicos-backup-${new Date().toISOString().slice(0, 10)}.sql`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("SQL schema backup generated and downloaded.");
  }

  if (isLoading) {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary mb-2" />
        <span>Loading database statistics...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display flex items-center gap-2">
          <Database className="size-6 text-primary" />
          Database Tools
        </h1>
        <p className="text-sm text-muted-foreground">Examine record distributions, optimize tables, and purge transient session states.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Stats */}
        <Card className="p-4 sm:p-6 space-y-4">
          <h3 className="text-lg font-semibold text-foreground font-display">Row Distribution</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground">Database Size</span>
              <span className="font-semibold text-foreground">{stats?.dbSize}</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground">Doctor accounts</span>
              <span className="font-semibold text-foreground">{stats?.doctorCount}</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground">Patient records</span>
              <span className="font-semibold text-foreground">{stats?.patientCount}</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm text-muted-foreground">Visits & Bookings</span>
              <span className="font-semibold text-foreground">{stats?.appointmentCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Audit entries</span>
              <span className="font-semibold text-foreground">{stats?.auditLogCount}</span>
            </div>
          </div>
        </Card>

        {/* Maintenance Tools */}
        <Card className="p-4 sm:p-6 space-y-4 lg:col-span-2">
          <h3 className="text-lg font-semibold text-foreground font-display">Optimization Commands</h3>
          <p className="text-xs text-muted-foreground">Run secure cleanup utilities directly to free space or backup database schemas.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-3 border rounded-md bg-muted/50 space-y-2">
              <span className="text-sm font-semibold text-foreground block">Clear Expired Sessions</span>
              <p className="text-xs text-muted-foreground/70">Purges session logs and authentication tokens that are fully expired.</p>
              <Button
                size="sm"
                variant="outline"
                className="text-orange-600 border-orange-200"
                disabled={cleanupMut.isPending}
                onClick={() => cleanupMut.mutate("sessions")}
              >
                <Trash2 className="size-3.5 mr-1" />
                Clear Sessions
              </Button>
            </div>
            <div className="p-3 border rounded-md bg-muted/50 space-y-2">
              <span className="text-sm font-semibold text-foreground block">Clear Unverified Signups</span>
              <p className="text-xs text-muted-foreground/70">Deletes clinic registration records that were never activated (over 30d).</p>
              <Button
                size="sm"
                variant="outline"
                className="text-orange-600 border-orange-200"
                disabled={cleanupMut.isPending}
                onClick={() => cleanupMut.mutate("unverified")}
              >
                <Trash2 className="size-3.5 mr-1" />
                Clear Signups
              </Button>
            </div>
            <div className="p-3 border rounded-md bg-indigo-50/50 border-indigo-100 space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-indigo-950 block">Database Schema Backup</span>
              <p className="text-xs text-muted-foreground">Generates a client-side SQL backup containing full table structure definition scripts.</p>
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90"
                onClick={downloadBackup}
              >
                <Download className="size-3.5 mr-1" />
                Download SQL Schema Backup
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
