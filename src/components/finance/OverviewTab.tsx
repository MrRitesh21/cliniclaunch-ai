import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDown, ArrowUp, IndianRupee, TrendingUp, Users, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getFinanceOverview } from "@/lib/finance.functions";
import { CHART_COLORS, compactInr, inr, pretty } from "@/lib/finance-format";

const RANGES = [
  { key: "today", label: "Today", days: 0 },
  { key: "7d", label: "Last 7 days", days: 6 },
  { key: "30d", label: "This month", days: 29 },
  { key: "90d", label: "Quarter", days: 89 },
  { key: "365d", label: "Year", days: 364 },
];

const day = (offset = 0) => new Date(Date.now() - offset * 864e5).toISOString().slice(0, 10);

function Kpi({ title, value, change, icon, suffix }: { title: string; value: string; change?: number; icon?: React.ReactNode; suffix?: string }) {
  const positive = (change ?? 0) >= 0;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{title}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="font-display text-2xl tracking-tight">{value}</div>
      {change !== undefined && (
        <div className={`text-xs mt-1 flex items-center gap-1 ${positive ? "text-emerald-600" : "text-rose-600"}`}>
          {positive ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
          {Math.abs(change)}% {suffix ?? "vs previous period"}
        </div>
      )}
    </Card>
  );
}

function Split({ title, data, kind }: { title: string; data: Array<{ key: string; amount: number; count: number; average: number }>; kind: "pie" | "bar" }) {
  const rows = data.slice(0, 7).map((d) => ({ ...d, name: pretty(d.key) }));
  if (rows.length === 0) return null;
  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium mb-3">{title}</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          {kind === "pie" ? (
            <PieChart>
              <Pie data={rows} dataKey="amount" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
                {rows.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => inr(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          ) : (
            <BarChart data={rows} margin={{ left: -14, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={54} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={compactInr} />
              <Tooltip formatter={(v: number) => inr(v)} />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]} fill={CHART_COLORS[0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <div className="mt-3 space-y-1">
        {rows.map((r, i) => (
          <div key={r.key} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 min-w-0">
              <span className="size-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="truncate">{r.name}</span>
            </span>
            <span className="text-muted-foreground shrink-0">
              {inr(r.amount)} · {r.count} txn · avg {inr(r.average)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function OverviewTab({ orgId, clinicId }: { orgId: string; clinicId: string | null }) {
  const [range, setRange] = useState("30d");
  const fn = useServerFn(getFinanceOverview);

  const { from, to } = useMemo(() => {
    const r = RANGES.find((x) => x.key === range)!;
    return { from: day(r.days), to: day(0) };
  }, [range]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["finance-overview", orgId, clinicId, from, to],
    queryFn: () => fn({ data: { organizationId: orgId, clinicId, from, to } }),
  });

  // Live dashboard: refetch whenever the ledger changes for this org.
  useEffect(() => {
    const channel = supabase
      .channel(`finance-ledger-${orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_ledger", filter: `organization_id=eq.${orgId}` }, () => {
        void refetch();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId, refetch]);

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const k = data.kpis;
  const a = data.appointments;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Every rupee below was recorded automatically from appointments, payments and expenses.
        </p>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi title="Today's revenue" value={inr(k.today)} change={k.yesterday ? Math.round(((k.today - k.yesterday) / k.yesterday) * 100) : undefined} suffix="vs yesterday" icon={<IndianRupee className="size-4" />} />
        <Kpi title="Revenue (period)" value={inr(k.rangeRevenue)} change={k.revenueGrowth} icon={<TrendingUp className="size-4" />} />
        <Kpi title="Expenses (period)" value={inr(k.rangeExpense)} change={k.expenseGrowth} icon={<Wallet className="size-4" />} />
        <Kpi title="Net profit" value={inr(k.netProfit)} change={k.profitGrowth} icon={<IndianRupee className="size-4" />} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi title="Average ticket" value={inr(k.averageTicket)} />
        <Kpi title="Revenue per patient" value={inr(k.revenuePerPatient)} icon={<Users className="size-4" />} />
        <Kpi title="Net margin" value={`${k.margin}%`} />
        <Kpi title="Digital payments" value={`${k.digitalRatio}%`} />
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3">Revenue vs expenses</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.timeline} margin={{ left: -14, right: 8 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS[5]} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={CHART_COLORS[5]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={compactInr} />
              <Tooltip formatter={(v: number) => inr(v)} />
              <Area type="monotone" dataKey="revenue" stroke={CHART_COLORS[0]} fill="url(#rev)" strokeWidth={2} />
              <Area type="monotone" dataKey="expense" stroke={CHART_COLORS[5]} fill="url(#exp)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Split title="Revenue by source" data={data.sources} kind="pie" />
        <Split title="Payment modes" data={data.paymentModes} kind="pie" />
        <Split title="Revenue by service" data={data.services} kind="bar" />
        {data.doctors.length > 0 ? (
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-3">Doctor leaderboard</h3>
            <div className="divide-y">
              {data.doctors.slice(0, 8).map((d, i) => (
                <div key={d.key} className="py-2.5 flex items-center gap-3">
                  <Badge variant={i === 0 ? "default" : "outline"} className="size-6 justify-center p-0">{i + 1}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{d.key}</div>
                    <div className="text-xs text-muted-foreground">{d.count} consultations · avg {inr(d.average)}</div>
                  </div>
                  <div className="font-medium text-sm">{inr(d.amount)}</div>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Split title="Expense categories" data={data.expenseCategories} kind="bar" />
        )}
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3">Appointment revenue split</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
          {[
            ["Total", a.total],
            ["Completed", a.completed],
            ["Cancelled", a.cancelled],
            ["No-show", a.noShow],
            ["Upcoming", a.pending + a.confirmed],
          ].map(([label, v]) => (
            <div key={label as string} className="rounded-lg border p-3">
              <div className="text-xl font-display">{v as number}</div>
              <div className="text-xs text-muted-foreground">{label as string}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-sm">
          <div className="rounded-lg bg-emerald-500/10 p-3">
            <div className="text-xs text-muted-foreground">Earned from completed</div>
            <div className="font-medium text-emerald-600">{inr(a.completedRevenue)}</div>
          </div>
          <div className="rounded-lg bg-amber-500/10 p-3">
            <div className="text-xs text-muted-foreground">Estimated cancellation loss</div>
            <div className="font-medium text-amber-600">{inr(a.cancellationLoss)}</div>
          </div>
          <div className="rounded-lg bg-rose-500/10 p-3">
            <div className="text-xs text-muted-foreground">Estimated no-show loss</div>
            <div className="font-medium text-rose-600">{inr(a.noShowLoss)}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
