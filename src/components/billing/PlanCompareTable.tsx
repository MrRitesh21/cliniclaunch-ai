import { Fragment, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Minus } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Plan = Database["public"]["Tables"]["plans"]["Row"];
type Module = Database["public"]["Tables"]["modules"]["Row"];

// Plan usage limits shown in the comparison. Mirrors the limits enforced in
// dashboard.billing.tsx usage cards — keep both in sync if limits change.
const PLAN_LIMITS: Record<string, { patients: string; staff: string }> = {
  starter: { patients: "100", staff: "1" },
  growth: { patients: "1,000", staff: "5" },
  professional: { patients: "Unlimited", staff: "20" },
  enterprise: { patients: "Unlimited", staff: "Unlimited" },
};

export function PlanCompareTable({
  plans,
  modules,
  currentPlanId,
  billingCycle = "yearly",
  onSelectPlan,
}: {
  plans: Plan[];
  modules: Module[];
  currentPlanId?: string | null;
  billingCycle?: "monthly" | "yearly";
  onSelectPlan?: (planId: string) => void;
}) {
  const groupedModules = useMemo(() => {
    const cats = Array.from(new Set(modules.map((m) => m.category)));
    return cats.map((cat) => ({
      category: cat,
      items: modules.filter((m) => m.category === cat),
    }));
  }, [modules]);

  if (plans.length === 0) return null;

  const priceFor = (p: Plan) =>
    billingCycle === "monthly"
      ? (p.discounted_monthly_price ?? p.monthly_price)
      : Math.round((p.discounted_yearly_price ?? p.yearly_price) / 12);

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="text-left p-3 font-medium text-muted-foreground w-[220px]">
              What's included
            </th>
            {plans.map((p) => (
              <th
                key={p.id}
                className={`p-3 text-center align-top ${p.is_popular ? "bg-primary/5" : ""}`}
              >
                <div className="font-display text-base flex items-center justify-center gap-1.5">
                  {p.name}
                  {p.is_popular && <Badge className="text-[10px]">Popular</Badge>}
                </div>
                <div className="mt-1">
                  <span className="font-display text-lg">₹{priceFor(p).toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">/mo</span>
                </div>
                {currentPlanId === p.id && (
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    Current
                  </Badge>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Usage limits */}
          <tr className="border-b bg-muted/20">
            <td
              colSpan={plans.length + 1}
              className="p-2.5 pl-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Limits
            </td>
          </tr>
          <tr className="border-b">
            <td className="p-3 text-muted-foreground">Patient records</td>
            {plans.map((p) => (
              <td
                key={p.id}
                className={`p-3 text-center font-medium ${p.is_popular ? "bg-primary/5" : ""}`}
              >
                {PLAN_LIMITS[p.id]?.patients ?? "—"}
              </td>
            ))}
          </tr>
          <tr className="border-b">
            <td className="p-3 text-muted-foreground">Staff seats</td>
            {plans.map((p) => (
              <td
                key={p.id}
                className={`p-3 text-center font-medium ${p.is_popular ? "bg-primary/5" : ""}`}
              >
                {PLAN_LIMITS[p.id]?.staff ?? "—"}
              </td>
            ))}
          </tr>

          {/* Modules grouped by category */}
          {groupedModules.map((group) => (
            <Fragment key={group.category}>
              <tr className="border-b bg-muted/20">
                <td
                  colSpan={plans.length + 1}
                  className="p-2.5 pl-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {group.category}
                </td>
              </tr>
              {group.items.map((m) => (
                <tr
                  key={m.id}
                  className="border-b last:border-b-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="p-3">
                    <div className="font-medium text-xs">{m.name}</div>
                    <div className="text-[11px] text-muted-foreground line-clamp-1">
                      {m.description}
                    </div>
                  </td>
                  {plans.map((p) => {
                    const included = (p.module_ids ?? []).includes(m.id);
                    return (
                      <td
                        key={p.id}
                        className={`p-3 text-center ${p.is_popular ? "bg-primary/5" : ""}`}
                      >
                        {included ? (
                          <Check className="size-4 text-primary inline-block" />
                        ) : (
                          <Minus className="size-4 text-muted-foreground/30 inline-block" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}

          {/* CTA row */}
          {onSelectPlan && (
            <tr>
              <td className="p-3" />
              {plans.map((p) => (
                <td key={p.id} className={`p-3 text-center ${p.is_popular ? "bg-primary/5" : ""}`}>
                  <Button
                    size="sm"
                    variant={p.is_popular ? "default" : "outline"}
                    disabled={currentPlanId === p.id}
                    onClick={() => onSelectPlan(p.id)}
                    className="w-full text-xs"
                  >
                    {currentPlanId === p.id ? "Current" : `Choose ${p.name}`}
                  </Button>
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
