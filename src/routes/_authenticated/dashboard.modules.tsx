import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import * as Icons from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { SkeletonCards } from "@/components/ui/skeleton-rows";
import { Crown, Check, Lock, Search } from "lucide-react";

type Module = Database["public"]["Tables"]["modules"]["Row"];
type Plan = Database["public"]["Tables"]["plans"]["Row"];
type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];

export const Route = createFileRoute("/_authenticated/dashboard/modules")({
  component: ModulesPage,
});

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Marketing: Icons.Megaphone,
  Operations: Icons.Settings2,
  Clinical: Icons.Stethoscope,
};

const CATEGORY_COLORS: Record<string, string> = {
  Marketing: "bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400",
  Operations: "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400",
  Clinical: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400",
};

function ModulesPage() {
  const { org, installedModuleIds, refresh } = useOrganization();
  const [modules, setModules] = useState<Module[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org) return;
    (async () => {
      setLoading(true);
      const [{ data: m }, { data: p }, { data: s }] = await Promise.all([
        supabase.from("modules").select("*").order("sort_order"),
        supabase.from("plans").select("*").order("sort_order"),
        supabase.from("subscriptions").select("*").eq("organization_id", org.id).maybeSingle(),
      ]);
      let modulesList = (m ?? []) as Module[];
      if (!modulesList.some((mod) => mod.id === "seo")) {
        modulesList.push({
          id: "seo",
          name: "SEO & AI Ranking",
          description: "Local SEO, Answer Engine & Generative Engine optimization to rank #1 on Google and AI search",
          category: "Marketing",
          icon: "Search",
          is_core: false,
          is_available: true,
          min_plan: "starter",
          sort_order: 17,
          created_at: new Date().toISOString()
        } as any);
      }
      setModules(modulesList);
      setPlans((p ?? []) as Plan[]);
      setSub((s ?? null) as Subscription | null);
      setLoading(false);
    })();
  }, [org]);

  // Mirror useOrganization: no valid/active subscription → no active plan → everything locked.
  const targetEnd = sub?.current_period_end ?? sub?.trial_ends_at;
  const periodEndMs = targetEnd ? new Date(targetEnd).getTime() : null;
  const periodElapsed = periodEndMs !== null && periodEndMs < Date.now();
  const statusActive = sub && (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due");
  const statusCancelledNotElapsed = sub && 
    (sub.status === "cancelled" || sub.status === "canceled") && 
    periodEndMs !== null && 
    !periodElapsed;
  const activePlanId = (statusActive && !periodElapsed) || statusCancelledNotElapsed ? sub!.plan_id : null;
  const currentPlan = activePlanId ? plans.find((p) => p.id === activePlanId) : undefined;
  const allowedModuleIds = new Set(currentPlan?.module_ids ?? []);
  const noActivePlan = !currentPlan;

  async function toggle(m: Module) {
    if (!org) return;
    const installed = installedModuleIds.includes(m.id);
    const allowed = allowedModuleIds.has(m.id);

    if (!installed && !allowed) {
      toast.error(`Upgrade to ${m.min_plan} or higher to install this module`);
      return;
    }

    setBusy(m.id);
    if (installed) {
      const { error } = await supabase
        .from("organization_modules").delete()
        .eq("organization_id", org.id).eq("module_id", m.id);
      if (error) toast.error(error.message); else toast.success(`${m.name} uninstalled`);
    } else {
      const { error } = await supabase.from("organization_modules")
        .upsert(
          { organization_id: org.id, module_id: m.id },
          { onConflict: "organization_id,module_id", ignoreDuplicates: true },
        );
      if (error) toast.error(error.message); else toast.success(`${m.name} installed`);
    }
    await refresh();
    setBusy(null);
  }

  const categories = ["All", ...Array.from(new Set(modules.map((m) => m.category)))];

  const filtered = modules.filter((m) => {
    const matchesSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "All" || m.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedByCategory = Array.from(new Set(filtered.map((m) => m.category)));

  const installedCount = installedModuleIds.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="App Store"
        subtitle="Install or remove modules to customize your workspace."
        actions={
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search modules…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-48"
            />
          </div>
        }
      />

      {/* Plan banner */}
      {currentPlan && (
        <Card className="p-4 flex items-center justify-between flex-wrap gap-3 bg-gradient-to-r from-primary/5 to-primary/3 border-primary/15">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
              <Crown className="size-5 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Current plan</div>
              <div className="font-display text-lg leading-tight">{currentPlan.name}</div>
            </div>
            <div className="hidden sm:block h-8 w-px bg-border mx-2" />
            <div className="hidden sm:block text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{installedCount}</span> app{installedCount !== 1 ? "s" : ""} installed
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/dashboard/billing">Upgrade plan</a>
          </Button>
        </Card>
      )}

      {/* No active plan banner */}
      {!loading && noActivePlan && (
        <Card className="p-4 flex items-center justify-between flex-wrap gap-3 border-destructive/40 bg-destructive/5">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-destructive/10 grid place-items-center">
              <Icons.AlertTriangle className="size-5 text-destructive" />
            </div>
            <div>
              <div className="font-medium text-sm">No active subscription</div>
              <div className="text-xs text-muted-foreground">
                {sub ? "Your plan has expired or was cancelled." : "You don't have an active plan yet."} Choose a plan to unlock apps.
              </div>
            </div>
          </div>
          <Button size="sm" asChild>
            <a href="/dashboard/billing">Choose a plan</a>
          </Button>
        </Card>
      )}

      {/* Category filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`text-sm px-3.5 py-1.5 rounded-full border transition-all font-medium ${
              activeCategory === cat
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-accent/50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Module grid */}
      {loading ? (
        <SkeletonCards count={6} />
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">No modules match your search.</div>
      ) : (
        groupedByCategory.map((cat) => {
          const items = filtered.filter((m) => m.category === cat);
          if (items.length === 0) return null;
          const CatIcon = CATEGORY_ICONS[cat] ?? Icons.Package;
          const catColor = CATEGORY_COLORS[cat] ?? "bg-muted text-muted-foreground";
          return (
            <section key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`size-6 rounded-md grid place-items-center ${catColor}`}>
                  <CatIcon className="size-3.5" />
                </div>
                <h2 className="font-display text-lg">{cat}</h2>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((m) => {
                  const installed = installedModuleIds.includes(m.id);
                  const allowed = allowedModuleIds.has(m.id);
                  const locked = !installed && !allowed;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const Icon = ((Icons as any)[m.icon] as React.ComponentType<{ className?: string }>) ?? Icons.Package;
                  const iconColor = catColor;
                  return (
                    <Card
                      key={m.id}
                      className={`module-card p-4 flex flex-col relative overflow-hidden ${locked ? "opacity-70" : ""} ${installed ? "border-emerald-200 dark:border-emerald-900" : ""}`}
                    >
                      {/* Installed glow strip */}
                      {installed && (
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-400" />
                      )}
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`size-10 rounded-xl grid place-items-center shrink-0 relative ${iconColor}`}>
                          <Icon className="size-5" />
                          {installed && (
                            <div className="absolute -top-1 -right-1 size-4 rounded-full bg-emerald-500 grid place-items-center">
                              <Check className="size-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-medium text-sm truncate">{m.name}</h3>
                            {m.is_core && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-medium">Core</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{m.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-3 border-t">
                        {locked ? (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Lock className="size-3" />
                            Requires {m.min_plan}
                          </div>
                        ) : (
                          <StatusBadge status={installed ? "installed" : "inactive"} />
                        )}
                        <Button
                          size="sm"
                          variant={installed ? "ghost" : locked ? "outline" : "default"}
                          className={`text-xs h-7 px-3 ${installed ? "text-destructive hover:text-destructive hover:bg-destructive/10" : locked ? "text-muted-foreground cursor-not-allowed" : ""}`}
                          disabled={busy === m.id || locked}
                          onClick={() => toggle(m)}
                        >
                          {busy === m.id ? (
                            <Icons.Loader2 className="size-3.5 animate-spin" />
                          ) : installed ? (
                            "Uninstall"
                          ) : locked ? (
                            <><Lock className="size-3" /> Locked</>
                          ) : (
                            "Install"
                          )}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
