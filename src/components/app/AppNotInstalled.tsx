import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ArrowRight, Lock } from "lucide-react";
import * as Icons from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Module = Database["public"]["Tables"]["modules"]["Row"];
type Plan = Database["public"]["Tables"]["plans"]["Row"];
type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];

export function AppNotInstalled({ appKey }: { appKey: string }) {
  const { org, planModuleIds, refresh } = useOrganization();
  const [mod, setMod] = useState<Module | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!org) return;
    let active = true;
    (async () => {
      const [{ data: m }, { data: s }] = await Promise.all([
        supabase.from("modules").select("*").eq("id", appKey).maybeSingle(),
        supabase.from("subscriptions").select("*").eq("organization_id", org.id).maybeSingle(),
      ]);
      if (!active) return;
      setMod((m ?? null) as Module | null);
      if (s) {
        const { data: p } = await supabase
          .from("plans")
          .select("*")
          .eq("id", (s as Subscription).plan_id)
          .maybeSingle();
        if (active) setPlan((p ?? null) as Plan | null);
      }
    })();
    return () => {
      active = false;
    };
  }, [org, appKey]);

  async function install() {
    if (!org || !mod) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("organization_modules")
        .upsert(
          { organization_id: org.id, module_id: mod.id },
          { onConflict: "organization_id,module_id", ignoreDuplicates: true },
        );
      if (error) toast.error(error.message);
      else {
        toast.success(`${mod.name} installed`);
        await refresh();
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to install module");
    } finally {
      setBusy(false);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon =
    (mod ? ((Icons as any)[mod.icon] as React.ComponentType<{ className?: string }>) : Package) ??
    Package;
  const allowed = (planModuleIds ?? []).includes(appKey) || (plan?.module_ids?.includes(appKey) ?? false);

  return (
    <div className="max-w-xl mx-auto py-12">
      <Card className="p-8 text-center">
        <div className="size-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
          {allowed ? <Icon className="size-8" /> : <Lock className="size-8" />}
        </div>
        <h2 className="font-display text-2xl font-bold mb-2">{mod?.name ?? "Module Not Active"}</h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
          {mod?.description ?? "This feature is not currently enabled for your clinic workspace."}
        </p>

        {allowed ? (
          <Button type="button" onClick={install} disabled={busy} size="lg" className="gap-2">
            {busy ? "Activating..." : `Activate ${mod?.name ?? "Module"}`}
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-3 rounded-lg text-xs font-medium">
              This module requires a higher plan tier.
            </div>
            <Button type="button" asChild size="lg" className="gap-2">
              <Link to="/dashboard/billing">
                Upgrade Plan to Unlock <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
