import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Loader2, Flag, Settings2, ToggleLeft, ToggleRight } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/features")({
  component: FeatureFlagsPage,
});

function FeatureFlagsPage() {
  const queryClient = useQueryClient();

  const getFlagsFn = useServerFn(listFeatureFlags);
  const toggleFlagFn = useServerFn(toggleFeatureFlag);
  const updateOverridesFn = useServerFn(updateFeatureFlagOverrides);

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ["admin-feature-flags"],
    queryFn: () => getFlagsFn(),
  });

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

  if (isLoading) {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary mb-2" />
        <span>Loading feature flags...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display flex items-center gap-2">
          <Flag className="size-6 text-primary" />
          Feature Flags
        </h1>
        <p className="text-sm text-muted-foreground">
          Toggle capabilities globally or roll them out progressively to segments or specific
          doctors.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {flags.map((f: any) => {
          const isEditing = editingFlagKey === f.key;
          return (
            <Card key={f.key} className="p-4 sm:p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-foreground">{f.name}</h3>
                    <code className="text-xs bg-muted text-foreground/80 px-1.5 py-0.5 rounded font-mono">
                      {f.key}
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{f.description}</p>
                </div>
                <button
                  onClick={() => toggleMut.mutate({ key: f.key, enabled: !f.is_enabled_globally })}
                  className="focus:outline-none"
                >
                  {f.is_enabled_globally ? (
                    <ToggleRight className="size-8 text-primary" />
                  ) : (
                    <ToggleLeft className="size-8 text-muted-foreground/50" />
                  )}
                </button>
              </div>

              {isEditing ? (
                <Card className="p-4 bg-muted/50 border space-y-3 mt-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`plans-${f.key}`}>Enable for Plans (comma separated)</Label>
                      <Input
                        id={`plans-${f.key}`}
                        value={plansText}
                        onChange={(e) => setPlansText(e.target.value)}
                        placeholder="e.g. pro_plan, clinic_plan"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`docs-${f.key}`}>
                        Enable for Specific Doctor IDs (comma separated)
                      </Label>
                      <Input
                        id={`docs-${f.key}`}
                        value={doctorsText}
                        onChange={(e) => setDoctorsText(e.target.value)}
                        placeholder="e.g. uuid-1, uuid-2"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={updateOverridesMut.isPending}
                      onClick={() => updateOverridesMut.mutate()}
                    >
                      Save Overrides
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingFlagKey(null)}>
                      Cancel
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground pt-2 border-t">
                  <div className="flex items-center gap-1.5 mr-4">
                    <span className="font-semibold text-foreground/80">Plans:</span>
                    {(f.enabled_for_plans ?? []).length === 0 ? (
                      <span>None</span>
                    ) : (
                      (f.enabled_for_plans ?? []).map((p: string) => (
                        <Badge key={p} variant="secondary">
                          {p}
                        </Badge>
                      ))
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground/80">Doctor IDs override:</span>
                    {(f.enabled_for_doctor_ids ?? []).length === 0 ? (
                      <span>None</span>
                    ) : (
                      <Badge variant="outline">
                        {(f.enabled_for_doctor_ids ?? []).length} overridden
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-xs h-7 text-primary"
                    onClick={() => {
                      setEditingFlagKey(f.key);
                      setPlansText((f.enabled_for_plans ?? []).join(", "));
                      setDoctorsText((f.enabled_for_doctor_ids ?? []).join(", "));
                    }}
                  >
                    <Settings2 className="size-3.5 mr-1" />
                    Edit Overrides
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
