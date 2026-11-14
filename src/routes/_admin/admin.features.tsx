import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  listFeatureFlags,
  toggleFeatureFlag,
  updateFeatureFlagOverrides,
} from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Flag, Settings2, ToggleLeft, ToggleRight, Search, CheckCircle2, Sliders } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/features")({
  component: FeatureFlagsPage,
});

function FeatureFlagsPage() {
  const queryClient = useQueryClient();

  const getFlagsFn = useServerFn(listFeatureFlags);
  const toggleFlagFn = useServerFn(toggleFeatureFlag);
  const updateOverridesFn = useServerFn(updateFeatureFlagOverrides);

  const { data: flags = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-feature-flags"],
    queryFn: () => getFlagsFn(),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  const [search, setSearch] = useState("");
  const [editingFlagKey, setEditingFlagKey] = useState<string | null>(null);
  const [plansText, setPlansText] = useState("");
  const [doctorsText, setDoctorsText] = useState("");

  const toggleMut = useMutation({
    mutationFn: (args: { key: string; enabled: boolean }) => toggleFlagFn({ data: args }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feature-flags"] });
      toast.success("Flag status toggled globally");
    },
    onError: (err: any) => toast.error(err.message || "Failed to toggle flag"),
  });

  const updateOverridesMut = useMutation({
    mutationFn: () =>
      updateOverridesFn({
        data: {
          key: editingFlagKey!,
          plans: plansText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          doctorIds: doctorsText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feature-flags"] });
      setEditingFlagKey(null);
      toast.success("Overrides updated successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update overrides"),
  });

  const filteredFlags = useMemo(() => {
    if (!search.trim()) return flags;
    const q = search.toLowerCase();
    return flags.filter(
      (f: any) =>
        f.name?.toLowerCase().includes(q) ||
        f.key?.toLowerCase().includes(q) ||
        f.description?.toLowerCase().includes(q)
    );
  }, [flags, search]);

  const activeCount = useMemo(() => {
    return flags.filter((f: any) => f.is_enabled_globally).length;
  }, [flags]);

  if (isLoading && flags.length === 0) {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center text-muted-foreground min-h-[350px]">
        <Loader2 className="size-8 animate-spin text-primary mb-2" />
        <span className="text-sm font-medium">Loading feature flags...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display flex items-center gap-2">
            <Flag className="size-6 text-primary" />
            Feature Flags
          </h1>
          <p className="text-sm text-muted-foreground">
            Toggle capabilities globally or roll them out progressively to subscription plans or specific doctors.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && <Loader2 className="size-4 animate-spin text-primary" />}
          <Badge variant="outline" className="text-xs">
            {activeCount} of {flags.length} active globally
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 text-xs">
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex items-center gap-3 bg-card p-3 rounded-lg border">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by flag name, key or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-background"
          />
        </div>
        <span className="text-xs text-muted-foreground ml-auto hidden sm:inline">
          Showing {filteredFlags.length} of {flags.length} flags
        </span>
      </div>

      {/* Flags List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredFlags.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground text-sm">
            No feature flags match your search.
          </Card>
        ) : (
          filteredFlags.map((f: any) => {
            const isEditing = editingFlagKey === f.key;
            return (
              <Card key={f.key} className="p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-base text-foreground">{f.name}</h3>
                      <code className="text-xs bg-muted text-foreground/80 px-2 py-0.5 rounded font-mono border">
                        {f.key}
                      </code>
                      <Badge
                        variant={f.is_enabled_globally ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {f.is_enabled_globally ? "Global ON" : "Global OFF"}
                      </Badge>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">{f.description}</p>
                  </div>

                  <button
                    onClick={() => toggleMut.mutate({ key: f.key, enabled: !f.is_enabled_globally })}
                    className="self-end sm:self-auto focus:outline-none transition-transform active:scale-95"
                    title={f.is_enabled_globally ? "Disable globally" : "Enable globally"}
                  >
                    {f.is_enabled_globally ? (
                      <ToggleRight className="size-8 text-primary" />
                    ) : (
                      <ToggleLeft className="size-8 text-muted-foreground/50" />
                    )}
                  </button>
                </div>

                {isEditing ? (
                  <Card className="p-4 bg-muted/40 border space-y-3 mt-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`plans-${f.key}`} className="text-xs">
                          Enable for Plans (comma separated)
                        </Label>
                        <Input
                          id={`plans-${f.key}`}
                          value={plansText}
                          onChange={(e) => setPlansText(e.target.value)}
                          placeholder="e.g. starter, growth, professional"
                          className="mt-1 h-9 text-xs bg-background"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`docs-${f.key}`} className="text-xs">
                          Enable for Specific Doctor IDs (comma separated)
                        </Label>
                        <Input
                          id={`docs-${f.key}`}
                          value={doctorsText}
                          onChange={(e) => setDoctorsText(e.target.value)}
                          placeholder="e.g. clinic-uuid-1, clinic-uuid-2"
                          className="mt-1 h-9 text-xs bg-background"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditingFlagKey(null)} className="h-8 text-xs">
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={updateOverridesMut.isPending}
                        onClick={() => updateOverridesMut.mutate()}
                        className="h-8 text-xs"
                      >
                        {updateOverridesMut.isPending && <Loader2 className="size-3.5 animate-spin mr-1" />}
                        Save Overrides
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-3 border-t">
                    <div className="flex flex-wrap items-center gap-1.5 mr-4">
                      <span className="font-semibold text-foreground/80">Plans:</span>
                      {(f.enabled_for_plans ?? []).length === 0 ? (
                        <span className="text-muted-foreground/70 italic text-[11px]">All/Inherit</span>
                      ) : (
                        (f.enabled_for_plans ?? []).map((p: string) => (
                          <Badge key={p} variant="secondary" className="text-[10px] py-0">
                            {p}
                          </Badge>
                        ))
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground/80">Custom Clinic Overrides:</span>
                      {(f.enabled_for_doctor_ids ?? []).length === 0 ? (
                        <span className="text-muted-foreground/70 italic text-[11px]">None</span>
                      ) : (
                        <Badge variant="outline" className="text-[10px] py-0">
                          {(f.enabled_for_doctor_ids ?? []).length} overridden
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto text-xs h-7 text-primary hover:text-primary"
                      onClick={() => {
                        setEditingFlagKey(f.key);
                        setPlansText((f.enabled_for_plans ?? []).join(", "));
                        setDoctorsText((f.enabled_for_doctor_ids ?? []).join(", "));
                      }}
                    >
                      <Sliders className="size-3 mr-1" />
                      Configure Overrides
                    </Button>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
