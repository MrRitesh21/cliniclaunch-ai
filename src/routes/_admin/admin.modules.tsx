import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listModuleControls, setModuleGlobal, setOrgModuleOverride } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Package } from "lucide-react";

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
  const [orgId, setOrgId] = useState<string | undefined>();

  const key = ["admin-module-controls", orgId, search];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => listFn({ data: { orgId, search: search || undefined } }),
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

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display flex items-center gap-2">
          <Package className="size-6 text-primary" /> App On / Off
        </h1>
        <p className="text-sm text-muted-foreground">
          Switch an app off for the whole platform, or choose a clinic to turn apps on or off just
          for them. A clinic setting always wins over the platform setting.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="font-semibold text-sm">Clinic (optional)</div>
        <Input
          placeholder="Search clinic by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={!orgId ? "default" : "outline"} onClick={() => setOrgId(undefined)}>
            Whole platform
          </Button>
          {(data?.orgs ?? []).map((o) => (
            <Button
              key={o.id}
              size="sm"
              variant={orgId === o.id ? "default" : "outline"}
              onClick={() => setOrgId(o.id)}
            >
              {o.name}
            </Button>
          ))}
        </div>
      </Card>

      {isLoading ? (
        <div className="p-10 grid place-items-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3">
          {(data?.modules ?? []).map((m) => {
            const ov = overrides.get(m.id);
            const state: State = ov === undefined ? "default" : ov ? "on" : "off";
            const effective = ov ?? m.is_available;
            return (
              <Card key={m.id} className="p-4 flex flex-wrap items-center gap-4 justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{m.name}</span>
                    <code className="text-xs bg-muted px-1.5 rounded">{m.id}</code>
                    {orgId && (
                      <Badge variant={effective ? "secondary" : "destructive"}>
                        {effective ? "On" : "Off"} for {selectedOrg?.name ?? "clinic"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
                </div>
                {!orgId ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">All clinics</span>
                    <Switch
                      checked={!!m.is_available}
                      disabled={globalMut.isPending}
                      onCheckedChange={(v) => globalMut.mutate({ moduleId: m.id, enabled: v })}
                    />
                  </div>
                ) : (
                  <div className="flex gap-1">
                    {(["default", "on", "off"] as State[]).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={state === s ? "default" : "outline"}
                        disabled={overrideMut.isPending}
                        onClick={() => overrideMut.mutate({ moduleId: m.id, state: s })}
                      >
                        {s === "default" ? `Platform (${m.is_available ? "on" : "off"})` : s === "on" ? "On" : "Off"}
                      </Button>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
