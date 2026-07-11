import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ArrowRight } from "lucide-react";
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
  const { org, refresh } = useOrganization();
  const [mod, setMod] = useState<Module | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!org) return;
    (async () => {
      const [{ data: m }, { data: s }] = await Promise.all([
        supabase.from("modules").select("*").eq("id", appKey).maybeSingle(),
        supabase.from("subscriptions").select("*").eq("organization_id", org.id).maybeSingle(),
      ]);
      setMod((m ?? null) as Module | null);
      if (s) {
        const { data: p } = await supabase.from("plans").select("*").eq("id", (s as Subscription).plan_id).maybeSingle();
        setPlan((p ?? null) as Plan | null);
      }
    })();
  }, [org, appKey]);

  async function install() {
    if (!org || !mod) return;
    setBusy(true);
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
    setBusy(false);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = (mod ? ((Icons as any)[mod.icon] as React.ComponentType<{ className?: string }>) : Package) ?? Package;
  const allowed = plan?.module_ids?.includes(appKey) ?? false;

  return (
    <div className="max-w-xl mx-auto py-12">
      <Card className="p-8 text-center">
        <div className="mx-auto size-16 rounded-2xl bg-primary/10 grid place-items-center mb-4">
          <Icon className="size-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl mb-2">{mod?.name ?? "App not installed"}</h1>
        <p className="text-muted-foreground mb-6">
          {mod?.description ?? "Install this app from the App Store to start using it."}
        </p>
        {mod && allowed ? (
          <Button onClick={install} disabled={busy} size="lg" className="gap-2">
            {busy ? "Installing…" : <>Install {mod.name} <ArrowRight className="size-4" /></>}
          </Button>
        ) : mod ? (
          <div className="space-y-3">
            <p className="text-sm text-amber-600">Requires {mod.min_plan} plan or higher.</p>
            <Button asChild size="lg"><Link to="/dashboard/billing">Upgrade plan</Link></Button>
          </div>
        ) : null}
        <div className="mt-4">
          <Link to="/dashboard/modules" className="text-sm text-muted-foreground hover:text-foreground underline">
            Back to App Store
          </Link>
        </div>
      </Card>
    </div>
  );
}
