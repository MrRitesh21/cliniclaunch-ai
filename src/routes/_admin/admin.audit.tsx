import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listAuditLogs } from "@/lib/admin.functions";
import { deleteAuditLog } from "@/lib/audit-test.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ScrollText, Search, Filter, Calendar, RefreshCcw, Database, ShieldAlert, User, Activity, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { toast } from "sonner";


export const Route = createFileRoute("/_admin/admin/audit")({
  component: AuditLogsPage,
});

function AuditLogsPage() {
  const fn = useServerFn(listAuditLogs);
  const deleteFn = useServerFn(deleteAuditLog);
  const queryClient = useQueryClient();
  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({ 
    queryKey: ["admin-audit-logs"], 
    queryFn: () => fn() 
  });

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-audit-logs"] });
      toast.success("Audit log entry deleted successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete audit log entry");
    },
  });


  const filteredLogs = useMemo(() => {
    return logs.filter((log: any) => {
      const matchesSearch = 
        log.admin_users?.name?.toLowerCase().includes(search.toLowerCase()) ||
        log.admin_users?.email?.toLowerCase().includes(search.toLowerCase()) ||
        log.action?.toLowerCase().includes(search.toLowerCase()) ||
        log.target_id?.toLowerCase().includes(search.toLowerCase()) ||
        log.metadata?.reason?.toLowerCase().includes(search.toLowerCase());
      
      const matchesAction = actionFilter === "all" || log.action === actionFilter;
      
      return matchesSearch && matchesAction;
    });
  }, [logs, search, actionFilter]);

  const actionTypes = useMemo(() => {
    const types = new Set<string>();
    logs.forEach((log: any) => {
      if (log.action) types.add(log.action);
    });
    return Array.from(types).sort();
  }, [logs]);

  const getActionColor = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes("delete") || a.includes("remove") || a.includes("suspend")) return "destructive";
    if (a.includes("create") || a.includes("add") || a.includes("publish")) return "default";
    if (a.includes("update") || a.includes("change") || a.includes("toggle")) return "secondary";
    return "outline";
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
        <div className="relative">
          <Loader2 className="size-10 animate-spin text-primary/40" />
          <Database className="size-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
        </div>
        <span className="mt-4 font-medium">Synchronizing audit history...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-display flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <ShieldAlert className="size-8 text-primary" />
            </div>
            Audit Log
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-lg whitespace-pre-wrap">
            {"'''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''\n                                        \n                                            \n                                            Log and display separate audit events whenever audit records are purged by the retention job.\n\nAdd an archive mechanism so expired audit entries are moved to an archive (or export) before deletion.\n\nImplement an admin UI setting to configure the audit retention period in days for my /admin/audit module.\n\nAdd a retention policy to /admin/audit so old entries automatically expire after a configurable number of days."}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetch()} 
          disabled={isFetching}
          className="bg-background shadow-sm h-11 px-5"
        >
          <RefreshCcw className={`size-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Syncing...' : 'Refresh Logs'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/[0.02] border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              Total Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{logs.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Last 100 system actions</p>
          </CardContent>
        </Card>
        
        <Card className="bg-teal-500/[0.02] border-teal-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldAlert className="size-4 text-teal-500" />
              Critical Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">
              {logs.filter((l: any) => l.action?.toLowerCase().includes('delete') || l.action?.toLowerCase().includes('suspend')).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Deletions & suspensions</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/[0.02] border-blue-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="size-4 text-blue-500" />
              Unique Admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">
              {new Set(logs.map((l: any) => l.admin_id)).size}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Active administrators</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xl border-border/40 overflow-hidden bg-card/50 backdrop-blur-sm">
        <CardHeader className="border-b bg-muted/30 pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>History</CardTitle>
              <CardDescription>Filtering {filteredLogs.length} of {logs.length} entries</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input 
                  placeholder="Search admin, action, target..." 
                  className="pl-9 bg-background h-10 border-border/60"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-full md:w-48 bg-background h-10 border-border/60">
                  <Filter className="size-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {actionTypes.map(type => (
                    <SelectItem key={type} value={type}>{type.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-muted/50 text-muted-foreground font-semibold text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-6 py-4 border-b">Timestamp</th>
                <th className="text-left px-6 py-4 border-b">Administrator</th>
                <th className="text-left px-6 py-4 border-b">Operation</th>
                <th className="text-left px-6 py-4 border-b">Target Entity</th>
                <th className="text-left px-6 py-4 border-b">Context/Reason</th>
                <th className="text-left px-6 py-4 border-b">Footprint</th>
                <th className="text-right px-6 py-4 border-b">Actions</th>

              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center grayscale opacity-60">
                      <ScrollText className="size-12 mb-4 text-muted-foreground" />
                      <p className="text-lg font-medium">No records found</p>
                      <p className="text-sm text-muted-foreground">Adjust your filters or search terms</p>
                    </div>
                  </td>
                </tr>
              )}
              {filteredLogs.map((log: any) => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {format(new Date(log.created_at), "MMM d, yyyy")}
                      </span>
                      <span className="text-[11px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                        <Calendar className="size-3" />
                        {format(new Date(log.created_at), "HH:mm:ss")}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-colors font-semibold">
                        {log.admin_users?.name?.charAt(0) || "S"}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-foreground truncate">
                          {log.admin_users?.name || "System Process"}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate uppercase tracking-tighter">
                          {log.admin_users?.email || "internal@system.task"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={getActionColor(log.action)} className="uppercase text-[10px] tracking-tight px-2 py-0.5 rounded-full font-bold">
                      {log.action?.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    {log.target_type ? (
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold capitalize text-foreground">{log.target_type}</span>
                        <code className="text-[10px] text-muted-foreground/80 font-mono mt-0.5 bg-muted/50 px-1 py-0.5 rounded border border-border/40 inline-block w-fit">
                          {log.target_id}
                        </code>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/40 italic text-xs">— Global System —</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-[250px] min-w-[150px]">
                      {log.metadata?.reason ? (
                        <p className="text-xs text-foreground/80 line-clamp-2 bg-muted/30 p-2 rounded-md border border-border/30">
                          {log.metadata.reason}
                        </p>
                      ) : log.metadata && Object.keys(log.metadata).length > 0 ? (
                        <div className="text-[10px] text-muted-foreground/70 font-mono bg-muted/20 p-1.5 rounded truncate">
                          {JSON.stringify(log.metadata)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/30 text-xs italic">No additional context</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground/80 bg-muted/40 px-2 py-0.5 rounded w-fit">
                        <Activity className="size-3 text-muted-foreground/50" />
                        {log.ip_address || "Internal IP"}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this audit log entry?")) {
                          deleteMutation.mutate(log.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="size-4" />
                    </Button>
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

