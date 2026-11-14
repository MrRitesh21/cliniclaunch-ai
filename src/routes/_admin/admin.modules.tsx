import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { listModuleControls, setModuleGlobal, setOrgModuleOverride } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Package, Search, Building2, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/modules")({
  head: () => ({ meta: [{ title: "App On / Off — ClinicX Admin" }] }),
  component: ModuleControlsPage,
});

type State = "on" | "off" | "default";

function ModuleControlsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listModuleControls);
  const globalFn = useServerFn(setModuleGlobal);
  const overrideFn = useServerFn(setOrgModuleOverride);
  const [search, setSearch] = useState("");
  const [moduleSearch, setModuleSearch] = useState("");
  const [orgId, setOrgId] = useState<string | undefined>();

  const key = ["admin-module-controls", orgId, search];
  const { data, isLoading, isFetching } = useQuery({
    queryKey: key,
    queryFn: () => listFn({ data: { orgId, search: search || undefined } }),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  const onErr = (e: any) => toast.error(e?.message || "Update failed");
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-module-controls"] });

  const globalMut = useMutation({
    mutationFn: (a: { moduleId: string; enabled: boolean }) => globalFn({ data: a }),
    onSuccess: () => (refresh(), toast.success("Updated for all clinics")),
    onError: onErr,
  });
  const overrideMut = useMutation({
    mutationFn: (a: { moduleId: string; state: State }) =>
      overrideFn({ data: { orgId: orgId!, ...a } }),
    onSuccess: () => (refresh(), toast.success("Updated for this clinic")),
    onError: onErr,
  });

  const overrides = new Map((data?.overrides ?? []).map((o) => [o.module_id, o.enabled]));
  const selectedOrg = data?.orgs.find((o) => o.id === orgId);

  const filteredModules = useMemo(() => {
    const list = data?.modules ?? [];
    if (!moduleSearch.trim()) return list;
    const q = moduleSearch.toLowerCase();
    return list.filter(
      (m: any) =>
        m.name?.toLowerCase().includes(q) ||
        m.id?.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q) ||
        m.category?.toLowerCase().includes(q)
    );
  }, [data?.modules, moduleSearch]);

  if (isLoading && !data) {
    return (
      <div className="p-10 flex flex-col items-center justify-center text-muted-foreground min-h-[350px]">
        <Loader2 className="size-8 animate-spin text-primary mb-2" />
        <span className="text-sm font-medium">Loading app controls...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <Package className="size-6 text-primary" /> App On / Off Controls
          </h1>
          <p className="text-sm text-muted-foreground">
            Switch an app off for the whole platform, or choose a specific clinic to turn apps on or off just
            for them.
          </p>
        </div>
        {isFetching && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin text-primary" /> Updating...
          </div>
        )}
      </div>

      {/* Target Selector */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm flex items-center gap-1.5">
            <Building2 className="size-4 text-muted-foreground" />
            Target Scope: {selectedOrg ? selectedOrg.name : "Whole Platform"}
          </span>
          {orgId && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOrgId(undefined)}>
              Reset to platform
            </Button>
          )}
        </div>

        <Input
          placeholder="Search clinic by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 text-xs bg-background"
        />

        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1">
          <Button
            size="sm"
            variant={!orgId ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setOrgId(undefined)}
          >
            Whole platform
          </Button>
          {(data?.orgs ?? []).map((o) => (
            <Button
              key={o.id}
              size="sm"
              variant={orgId === o.id ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setOrgId(o.id)}
            >
              {o.name}
            </Button>
          ))}
        </div>
      </Card>

      {/* Modules Filter & List */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Filter apps by name or category..."
              value={moduleSearch}
              onChange={(e) => setModuleSearch(e.target.value)}
              className="pl-9 h-9 text-xs bg-background"
            />
          </div>
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredModules.length} apps available
          </span>
        </div>

        <div className="grid gap-3">
          {filteredModules.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm">
              No apps match your search.
            </Card>
          ) : (
            filteredModules.map((m) => {
              const ov = overrides.get(m.id);
              const state: State = ov === undefined ? "default" : ov ? "on" : "off";
              const effective = ov ?? m.is_available;
              return (
                <Card key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm sm:text-base text-foreground">{m.name}</span>
                      <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                        {m.id}
                      </code>
                      {m.category && (
                        <Badge variant="outline" className="text-[10px] py-0">
                          {m.category}
                        </Badge>
                      )}
                      {orgId && (
                        <Badge
                          variant={effective ? "default" : "destructive"}
                          className="text-[10px] py-0"
                        >
                          {effective ? "Active" : "Disabled"} for {selectedOrg?.name ?? "clinic"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{m.description}</p>
                  </div>

                  {!orgId ? (
                    <div className="flex items-center gap-3 self-end sm:self-auto pt-2 sm:pt-0 border-t sm:border-0 w-full sm:w-auto justify-between sm:justify-start">
                      <span className="text-xs text-muted-foreground font-medium">All clinics</span>
                      <Switch
                        checked={!!m.is_available}
                        disabled={globalMut.isPending}
                        onCheckedChange={(v) => globalMut.mutate({ moduleId: m.id, enabled: v })}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 self-end sm:self-auto pt-2 sm:pt-0">
                      {(["default", "on", "off"] as State[]).map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant={state === s ? "default" : "outline"}
                          disabled={overrideMut.isPending}
                          className="h-8 text-xs"
                          onClick={() => overrideMut.mutate({ moduleId: m.id, state: s })}
                        >
                          {s === "default"
                            ? `Inherit (${m.is_available ? "On" : "Off"})`
                            : s === "on"
                              ? "Force On"
                              : "Force Off"}
                        </Button>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
