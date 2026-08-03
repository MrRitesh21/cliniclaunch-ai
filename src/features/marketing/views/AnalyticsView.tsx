import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMarketing } from "../context/MarketingContext";
import { getMarketingAnalytics } from "@/lib/marketing-studio.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function AnalyticsView() {
  const { organizationId } = useMarketing();
  const fetchAnalytics = useServerFn(getMarketingAnalytics);

  const { data, isLoading } = useQuery({
    queryKey: ["marketing-analytics", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => fetchAnalytics({ data: { organizationId: organizationId! } }),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const k = data.kpis;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Marketing ROI & Patient Acquisition</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Live numbers from your campaigns, leads and finance ledger — no estimates.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="p-4 space-y-1 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Marketing ROI</span>
          <p className="text-3xl font-bold font-display text-emerald-900 dark:text-emerald-100">
            {k.roi > 0 ? `${k.roi}x` : "—"}
          </p>
          <span className="text-[10px] text-emerald-600 font-medium">
            {inr(k.attributedRevenue)} attributed on {inr(k.spend)} spend
          </span>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Cost per acquisition</span>
          <p className="text-2xl font-bold font-display text-blue-600">{k.cac > 0 ? inr(k.cac) : "—"}</p>
          <span className="text-[10px] text-muted-foreground font-medium">
            {k.newPatients} converted lead{k.newPatients === 1 ? "" : "s"} (12 months)
          </span>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Click-through rate</span>
          <p className="text-2xl font-bold font-display text-purple-600">{k.ctr}%</p>
          <span className="text-[10px] text-muted-foreground font-medium">
            {k.clicked} clicks on {k.delivered} delivered
          </span>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Repeat patient rate</span>
          <p className="text-2xl font-bold font-display text-indigo-600">{k.retention}%</p>
          <span className="text-[10px] text-muted-foreground font-medium">
            Avg ticket {k.avgTicket > 0 ? inr(k.avgTicket) : "—"}
          </span>
        </Card>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm">Monthly campaign spend vs clinic revenue</h3>
            <p className="text-xs text-muted-foreground">Revenue comes from your finance ledger</p>
          </div>
          <Badge variant="outline" className="text-[10px]">6 Months</Badge>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.series} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => inr(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="spend" fill="#94a3b8" name="Spend" radius={[4, 4, 0, 0]} />
              <Bar dataKey="revenue" fill="#10b981" name="Revenue" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 space-y-3">
          <h3 className="font-bold text-sm">Channel performance</h3>
          {data.channels.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No campaigns sent yet. Launch one from Campaign Builder.
            </p>
          ) : (
            <div className="divide-y text-xs">
              {data.channels.map((c) => (
                <div key={c.channel} className="py-2.5 flex items-center justify-between gap-3">
                  <span className="font-semibold capitalize">{c.channel}</span>
                  <div className="flex gap-5 text-right">
                    <div>
                      <span className="block text-[10px] text-muted-foreground">Delivered</span>
                      <span className="font-medium">{c.delivered}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground">Clicked</span>
                      <span className="font-medium text-purple-600">{c.clicked}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground">Booked</span>
                      <span className="font-bold text-emerald-600">{c.booked}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 space-y-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" /> Top campaigns by revenue
          </h3>
          {data.topCampaigns.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No campaign revenue recorded yet.</p>
          ) : (
            <div className="divide-y text-xs">
              {data.topCampaigns.map((c) => (
                <div key={c.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {c.channel} · {c.status} · {c.delivered} delivered
                    </p>
                  </div>
                  <span className="font-bold text-emerald-600 shrink-0">{inr(c.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
