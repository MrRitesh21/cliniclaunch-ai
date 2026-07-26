import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listAuditLogs } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Loader2, ScrollText } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/audit")({
  component: AuditLogsPage,
});

function AuditLogsPage() {
  const fn = useServerFn(listAuditLogs);
  const { data: logs = [], isLoading } = useQuery({ queryKey: ["admin-audit-logs"], queryFn: () => fn() });

  if (isLoading) {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary mb-2" />
        <span>Loading audit logs...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display flex items-center gap-2">
          <ScrollText className="size-6 text-primary" />
          Audit Logs
        </h1>
        <p className="text-sm text-muted-foreground">Chronological history of admin actions, targets, metadata, and IP footprints.</p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Timestamp</th>
                <th className="text-left px-4 py-3">Admin</th>
                <th className="text-left px-4 py-3">Action Type</th>
                <th className="text-left px-4 py-3">Target Details</th>
                <th className="text-left px-4 py-3">Metadata</th>
                <th className="text-left px-4 py-3">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              {logs.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground/70">No actions logged yet.</td></tr>
              )}
              {logs.map((log: any) => (
                <tr key={log.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    <div>{log.admin_users?.name || "System"}</div>
                    <div className="text-[10px] text-muted-foreground/70 font-normal">{log.admin_users?.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-foreground uppercase tracking-tight text-[11px] bg-muted px-1.5 py-0.5 rounded">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {log.target_type ? (
                      <div>
                        <span className="capitalize font-semibold">{log.target_type}</span>:{" "}
                        <span className="font-mono text-[10px]">{log.target_id}</span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                    {log.metadata ? JSON.stringify(log.metadata) : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground/70">
                    {log.ip_address || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
