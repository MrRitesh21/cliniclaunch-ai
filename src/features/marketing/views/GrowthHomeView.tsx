import React, { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getGrowthOverview } from "@/lib/growth.functions";
import { useOrganization } from "@/hooks/useOrganization";
import { useMarketing } from "../context/MarketingContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/EmptyState";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Users,
  CalendarCheck,
  Star,
  Store,
  Megaphone,
  ArrowRight,
  Target,
} from "lucide-react";

type Overview = Awaited<ReturnType<typeof getGrowthOverview>>;

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function Tile({
  label,
  value,
  sub,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon: React.ElementType;
  tone?: "primary" | "emerald" | "amber" | "sky";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600",
    sky: "bg-sky-500/10 text-sky-600",
  };
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={`size-8 rounded-lg grid place-items-center ${tones[tone]}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="text-2xl font-bold font-display tracking-tight">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function FunnelBar({
  label,
  value,
  max,
  hint,
}: {
  label: string;
  value: number;
  max: number;
  hint?: string;
}) {
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 3;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-muted-foreground">
          {value}
          {hint ? ` · ${hint}` : ""}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary/80 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function GrowthHomeView() {
  const { org } = useOrganization();
  const { setActiveTab } = useMarketing();
  const fetchOverview = useServerFn(getGrowthOverview);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!org?.id) return;
    setLoading(true);
    fetchOverview({ data: { organizationId: org.id } })
      .then((res) => setData(res))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [org?.id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={<Store className="size-6" />}
        title="Growth data unavailable"
        description={error ?? "We couldn't load your growth numbers. Try again in a moment."}
      />
    );
  }

  const { sales, funnel, channels, reputation } = data;
  const hasAnyData = sales.last30 > 0 || funnel.leads > 0 || funnel.bookings > 0;
  const up = sales.trendPct >= 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Growth Home
            </h1>
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary border-primary/20 gap-1 text-[11px]"
            >
              <Store className="size-3" /> Clinic Commerce
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Your clinic's sales, patient funnel and campaign performance — live from your own data.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl text-xs"
            onClick={() => setActiveTab("templates")}
          >
            <Store className="size-3.5 mr-1.5" /> App Store
          </Button>
          <Button size="sm" className="rounded-xl text-xs" onClick={() => setActiveTab("builder")}>
            <Megaphone className="size-3.5 mr-1.5" /> New campaign
          </Button>
        </div>
      </div>

      {!hasAnyData && (
        <Card className="p-4 bg-amber-500/5 border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
          No revenue, leads or bookings recorded in the last 30 days yet. As soon as appointments
          and invoices start flowing, this dashboard fills itself — nothing to enter manually.
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile
          label="Sales today"
          value={inr(sales.today)}
          icon={IndianRupee}
          tone="emerald"
          sub={`${inr(sales.last30)} in last 30 days`}
        />
        <Tile
          label="30-day trend"
          value={`${up ? "+" : ""}${sales.trendPct}%`}
          icon={up ? TrendingUp : TrendingDown}
          tone={up ? "emerald" : "amber"}
          sub="Last 15 days vs previous 15"
        />
        <Tile
          label="Avg ticket size"
          value={inr(sales.avgTicket)}
          icon={Target}
          sub="Per completed visit"
        />
        <Tile
          label="Reputation"
          value={reputation.avgRating ? `${reputation.avgRating}★` : "—"}
          icon={Star}
          tone="amber"
          sub={`${reputation.reviews} approved · ${reputation.pending} pending`}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-sm">Revenue — last 30 days</h2>
              <p className="text-[11px] text-muted-foreground">
                Auto-captured from appointments, invoices & pharmacy
              </p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {inr(sales.last30)}
            </Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sales.series}>
                <defs>
                  <linearGradient id="growthRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border/40"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => v.slice(8)}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
                <Tooltip
                  formatter={(v: number) => inr(v)}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  fill="url(#growthRev)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-sm">Patient funnel</h2>
            <p className="text-[11px] text-muted-foreground">Leads → bookings → visits (30 days)</p>
          </div>
          <div className="space-y-3.5">
            <FunnelBar
              label="Leads captured"
              value={funnel.leads}
              max={Math.max(funnel.leads, funnel.bookings, 1)}
            />
            <FunnelBar
              label="Appointments booked"
              value={funnel.bookings}
              max={Math.max(funnel.leads, funnel.bookings, 1)}
              hint={`${funnel.leadToBooking}%`}
            />
            <FunnelBar
              label="Visits completed"
              value={funnel.completed}
              max={Math.max(funnel.leads, funnel.bookings, 1)}
              hint={`${funnel.bookingToVisit}%`}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="rounded-xl border p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                No-shows
              </div>
              <div className="text-lg font-bold">{funnel.noShow}</div>
            </div>
            <div className="rounded-xl border p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Cancelled
              </div>
              <div className="text-lg font-bold">{funnel.cancelled}</div>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full rounded-xl text-xs"
            onClick={() => setActiveTab("templates")}
          >
            Fix leaks with campaign apps <ArrowRight className="size-3.5 ml-1.5" />
          </Button>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4 sm:p-5 space-y-3">
          <h2 className="font-semibold text-sm flex items-center gap-1.5">
            <Users className="size-4 text-muted-foreground" /> Where patients come from
          </h2>
          {channels.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No leads yet. Publish your clinic website and share the booking link to start
              capturing sources.
            </p>
          ) : (
            <div className="space-y-2">
              {channels.map((c) => (
                <div
                  key={c.source}
                  className="flex items-center justify-between text-xs border-b last:border-0 pb-2"
                >
                  <span className="capitalize font-medium">{c.source.replace(/_/g, " ")}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {c.count} leads
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-5 space-y-3">
          <h2 className="font-semibold text-sm flex items-center gap-1.5">
            <CalendarCheck className="size-4 text-muted-foreground" /> Recent campaigns
          </h2>
          {data.campaigns.length === 0 ? (
            <div className="py-5 text-center space-y-2">
              <p className="text-xs text-muted-foreground">
                No campaigns yet — install a ready-made one in seconds.
              </p>
              <Button
                size="sm"
                className="rounded-xl text-xs"
                onClick={() => setActiveTab("templates")}
              >
                Browse campaign apps
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {data.campaigns.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 text-xs border-b last:border-0 pb-2"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground capitalize">
                      {c.channel ?? "whatsapp"} · {c.recipient_count ?? 0} recipients
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                    {c.status ?? "draft"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
