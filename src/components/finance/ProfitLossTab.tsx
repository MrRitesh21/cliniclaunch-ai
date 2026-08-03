import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDown, ArrowUp, IndianRupee, TrendingUp, Wallet, FileText, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFinanceOverview } from "@/lib/finance.functions";
import { CHART_COLORS, compactInr, downloadCsv, inr, printReport, tableHtml } from "@/lib/finance-format";

const PERIODS = [
  { key: "daily", label: "Daily (Last 30 Days)", days: 29 },
  { key: "weekly", label: "Weekly (Last 12 Weeks)", days: 83 },
  { key: "monthly", label: "Monthly (This Year)", days: 364 },
  { key: "quarterly", label: "Quarterly", days: 364 },
  { key: "yearly", label: "Yearly", days: 729 },
];

const day = (offset = 0) => new Date(Date.now() - offset * 864e5).toISOString().slice(0, 10);

export function ProfitLossTab({ orgId, clinicId }: { orgId: string; clinicId: string | null }) {
  const [period, setPeriod] = useState("monthly");
  const getOverview = useServerFn(getFinanceOverview);

  const { from, to } = useMemo(() => {
    const p = PERIODS.find((x) => x.key === period) || PERIODS[2];
    return { from: day(p.days), to: day(0) };
  }, [period]);

  const { data, isLoading } = useQuery({
    queryKey: ["pnl-overview", orgId, clinicId, from, to],
    queryFn: () => getOverview({ data: { organizationId: orgId, clinicId, from, to } }),
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const { kpis, timeline, expenseCategories, sources } = data;
  const isPositiveProfit = kpis.netProfit >= 0;

  function exportPnlReportPdf() {
    const headers = ["Period / Date", "Revenue (₹)", "Expenses (₹)", "Net Profit (₹)", "Margin %"];
    const rows = timeline.map((t) => [
      t.date,
      inr(t.revenue),
      inr(t.expense),
      inr(t.profit),
      t.revenue > 0 ? `${Math.round((t.profit / t.revenue) * 100)}%` : "0%",
    ]);
    const summaryHtml = `
      <div style="margin-bottom:20px; font-size:13px; line-height:1.6;">
        <p><strong>Total Revenue:</strong> ${inr(kpis.rangeRevenue)}</p>
        <p><strong>Total Expenses:</strong> ${inr(kpis.rangeExpense)}</p>
        <p><strong>Net Operating Profit:</strong> ${inr(kpis.netProfit)} (Net Margin: ${kpis.margin}%)</p>
      </div>
    `;
    printReport(`Profit & Loss Statement (${from} to ${to})`, summaryHtml + tableHtml(headers, rows, 1));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl">Profit &amp; Loss Statement</h2>
          <p className="text-sm text-muted-foreground">
            Automatic calculation of gross revenue, operational expenses, and net profit margins.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportPnlReportPdf}>
            <FileText className="size-4 mr-1.5" /> Print P&amp;L
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadCsv(`pnl-${from}-${to}`, timeline as any)}>
            <Download className="size-4 mr-1.5" /> CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>TOTAL REVENUE</span>
            <IndianRupee className="size-4" />
          </div>
          <div className="font-display text-2xl mt-2 tracking-tight">{inr(kpis.rangeRevenue)}</div>
          <div className={`text-xs mt-1.5 flex items-center gap-1 ${kpis.revenueGrowth >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {kpis.revenueGrowth >= 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {Math.abs(kpis.revenueGrowth)}% vs prior period
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>TOTAL EXPENSES</span>
            <Wallet className="size-4" />
          </div>
          <div className="font-display text-2xl mt-2 tracking-tight text-rose-600">{inr(kpis.rangeExpense)}</div>
          <div className={`text-xs mt-1.5 flex items-center gap-1 ${kpis.expenseGrowth <= 0 ? "text-emerald-600" : "text-amber-600"}`}>
            {kpis.expenseGrowth > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {Math.abs(kpis.expenseGrowth)}% vs prior period
          </div>
        </Card>

        <Card className={`p-4 border-l-4 ${isPositiveProfit ? "border-l-emerald-500" : "border-l-rose-500"}`}>
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>NET PROFIT</span>
            <TrendingUp className="size-4" />
          </div>
          <div className={`font-display text-2xl mt-2 tracking-tight ${isPositiveProfit ? "text-emerald-600" : "text-rose-600"}`}>
            {inr(kpis.netProfit)}
          </div>
          <div className={`text-xs mt-1.5 flex items-center gap-1 ${kpis.profitGrowth >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {kpis.profitGrowth >= 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {Math.abs(kpis.profitGrowth)}% profit growth
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>NET PROFIT MARGIN</span>
            <span className="font-mono text-xs">%</span>
          </div>
          <div className="font-display text-2xl mt-2 tracking-tight">{kpis.margin}%</div>
          <p className="text-xs text-muted-foreground mt-1.5">Net profit ratio of revenue</p>
        </Card>
      </div>

      {/* Revenue vs Expenses Trend Chart */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-4">Revenue vs Expenses Comparison Trend</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeline} margin={{ left: -14, right: 8 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS[5]} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={CHART_COLORS[5]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={compactInr} />
              <Tooltip formatter={(v: number) => inr(v)} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke={CHART_COLORS[0]} fill="url(#revGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="expense" name="Expense" stroke={CHART_COLORS[5]} fill="url(#expGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Profit Trend Chart & Expense Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4">Net Profit Bar Breakdown</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeline} margin={{ left: -14, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={compactInr} />
                <Tooltip formatter={(v: number) => inr(v)} />
                <Bar dataKey="profit" name="Net Profit" radius={[4, 4, 0, 0]} fill={CHART_COLORS[1]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Expense Structure Breakdown</h3>
          <div className="space-y-3 mt-2">
            {expenseCategories.length === 0 ? (
              <p className="text-xs text-muted-foreground">No expenses recorded for this period.</p>
            ) : (
              expenseCategories.slice(0, 7).map((c, i) => {
                const pct = kpis.rangeExpense > 0 ? Math.round((c.amount / kpis.rangeExpense) * 100) : 0;
                return (
                  <div key={c.key} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span>{c.key}</span>
                      <span className="font-mono">{inr(c.amount)} ({pct}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
