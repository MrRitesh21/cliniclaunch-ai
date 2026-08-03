import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMarketing } from "../context/MarketingContext";
import { getLoyaltyOverview } from "@/lib/marketing-studio.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, Gift, Users, Repeat } from "lucide-react";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

const TIER_STYLES: Record<string, string> = {
  Platinum: "bg-slate-800 text-white",
  Gold: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Silver: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  Bronze: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
};

export function LoyaltyView() {
  const { organizationId } = useMarketing();
  const fetchLoyalty = useServerFn(getLoyaltyOverview);

  const { data, isLoading } = useQuery({
    queryKey: ["marketing-loyalty", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => fetchLoyalty({ data: { organizationId: organizationId! } }),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 w-full" />
        <div className="grid sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const k = data.kpis;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Patient Loyalty</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Points are awarded automatically — 1 point per ₹100 of billed revenue. Tiers upgrade at 200 / 500 / 1000 points.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="p-4 space-y-1">
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <Users className="size-3.5" /> Members
          </span>
          <p className="text-2xl font-bold font-display">{k.members}</p>
        </Card>
        <Card className="p-4 space-y-1">
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <Award className="size-3.5" /> Points outstanding
          </span>
          <p className="text-2xl font-bold font-display text-amber-600">{k.totalPoints.toLocaleString("en-IN")}</p>
          <span className="text-[10px] text-muted-foreground">≈ {inr(k.pointsValue)} of reward liability</span>
        </Card>
        <Card className="p-4 space-y-1">
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <Gift className="size-3.5" /> Gold & Platinum
          </span>
          <p className="text-2xl font-bold font-display text-emerald-600">{k.goldPlus}</p>
          <span className="text-[10px] text-muted-foreground">Your highest-value patients</span>
        </Card>
        <Card className="p-4 space-y-1">
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <Repeat className="size-3.5" /> Member repeat rate
          </span>
          <p className="text-2xl font-bold font-display text-blue-600">{k.repeatRate}%</p>
          <span className="text-[10px] text-muted-foreground">{inr(k.membersRevenue)} member revenue</span>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 space-y-3">
          <h3 className="font-bold text-sm">Tier distribution</h3>
          {k.members === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No members yet. Points are created the moment you bill a patient.
            </p>
          ) : (
            <div className="space-y-2.5">
              {["Platinum", "Gold", "Silver", "Bronze"].map((tier) => {
                const count = (data.tierCounts as Record<string, number>)[tier] ?? 0;
                const pct = k.members ? Math.round((count / k.members) * 100) : 0;
                return (
                  <div key={tier} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{tier}</span>
                      <span className="text-muted-foreground">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5 space-y-3 lg:col-span-2">
          <h3 className="font-bold text-sm">Top loyal patients</h3>
          {data.top.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No loyalty activity recorded yet.</p>
          ) : (
            <div className="divide-y text-xs">
              {data.top.map((p) => (
                <div key={p.patientId} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2">
                    <Badge variant="secondary" className={`text-[10px] shrink-0 ${TIER_STYLES[p.tier] ?? ""}`}>
                      {p.tier}
                    </Badge>
                    <span className="font-semibold truncate">{p.name}</span>
                  </div>
                  <div className="flex gap-5 text-right shrink-0">
                    <div>
                      <span className="block text-[10px] text-muted-foreground">Visits</span>
                      <span className="font-medium">{p.visits}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground">Points</span>
                      <span className="font-medium text-amber-600">{p.points}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground">Revenue</span>
                      <span className="font-bold text-emerald-600">{inr(p.revenue)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {data.programs.length > 0 && (
        <Card className="p-5 space-y-3">
          <h3 className="font-bold text-sm">Reward programmes</h3>
          <div className="divide-y text-xs">
            {data.programs.map((p: any) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.stamps_required} visits → {p.reward_description}
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {p.active ? "active" : "paused"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
