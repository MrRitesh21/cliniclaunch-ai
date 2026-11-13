import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardDoctors } from "@/lib/clinic.functions";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Users,
  CalendarCheck,
  Receipt,
  Star,
  Package,
  FlaskConical,
  Download,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Activity,
  Stethoscope,
  PieChart as PieChartIcon,
  Filter,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { AppGuard } from "@/components/app/AppGuard";
import { StatsCard } from "@/components/app/StatsCard";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/analytics")({
  component: () => (
    <AppGuard appKey="analytics">
      <AnalyticsPage />
    </AppGuard>
  ),
});

type RangeOption = "7d" | "30d" | "90d" | "ytd";

type DailyPoint = {
  date: string;
  displayDate: string;
  appts: number;
  revenue: number;
  consultations: number;
};

type DoctorLeaderboardItem = {
  name: string;
  consultations: number;
  revenue: number;
};

const CHART_COLORS = ["#0284c7", "#10b981", "#6366f1", "#f59e0b", "#ec4899", "#8b5cf6"];

function AnalyticsPage() {
  const { org } = useOrganization();
  const orgId = org?.id;
  const fetchDoctorsFn = useServerFn(getDashboardDoctors);
  const [timeRange, setTimeRange] = useState<RangeOption>("30d");
  const [loading, setLoading] = useState(true);

  const [data, setData] = useState<{
    totalPatients: number;
    newPatientsInRange: number;
    appointments: number;
    completedAppts: number;
    cancelledAppts: number;
    consultations: number;
    grossRevenue: number;
    outstandingRevenue: number;
    reviewsCount: number;
    avgRating: number;
    lowStockItems: number;
    pendingLabs: number;
    dailyData: DailyPoint[];
    statusBreakdown: { status: string; count: number }[];
    topServices: { description: string; revenue: number }[];
    doctorLeaderboard: DoctorLeaderboardItem[];
  } | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let active = true;

    (async () => {
      setLoading(true);
      try {
        const now = new Date();
        let daysAgo = 30;
        if (timeRange === "7d") daysAgo = 7;
        else if (timeRange === "90d") daysAgo = 90;
        else if (timeRange === "ytd") {
          const jan1 = new Date(now.getFullYear(), 0, 1);
          daysAgo = Math.max(
            1,
            Math.ceil((now.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24)),
          );
        }

        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - daysAgo);
        const sinceISO = sinceDate.toISOString();
        const sinceYMD = sinceISO.slice(0, 10);

        const [pats, newPats, apts, cons, invs, revs, items, labs, docList] = await Promise.all([
          supabase
            .from("patients")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId),
          supabase
            .from("patients")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .gte("created_at", sinceISO),
          supabase
            .from("appointments")
            .select("id, scheduled_at, status, doctor_id, doctor_name")
            .eq("organization_id", orgId)
            .gte("scheduled_at", sinceISO),
          supabase
            .from("consultations" as any)
            .select("id, created_at, doctor_id")
            .eq("organization_id", orgId)
            .gte("created_at", sinceISO),
          supabase
            .from("patient_invoices" as any)
            .select("id, issue_date, total, amount_paid, status")
            .eq("organization_id", orgId)
            .gte("issue_date", sinceYMD),
          supabase
            .from("reviews" as any)
            .select("rating, status")
            .eq("organization_id", orgId),
          supabase
            .from("inventory_items" as any)
            .select("id, quantity, reorder_level")
            .eq("organization_id", orgId),
          supabase
            .from("lab_orders" as any)
            .select("id, status")
            .eq("organization_id", orgId)
            .in("status", ["pending", "collected", "in_lab"]),
          fetchDoctorsFn({ data: { organization_id: orgId } })
            .then((d) => ({ data: (d || []).map((x: any) => ({ id: x.id, name: x.name })) }))
            .catch(() => ({ data: [] })),
        ]);

        const apptRows = (apts.data as any[]) ?? [];
        const consRows = (cons.data as any[]) ?? [];
        const invRows = (invs.data as any[]) ?? [];
        const revRows = (revs.data as any[]) ?? [];
        const approvedRevs = revRows.filter((r) => r.status === "approved");
        const itemRows = (items.data as any[]) ?? [];
        const doctorsMap = new Map<string, string>();
        ((docList.data as any[]) ?? []).forEach((d) => doctorsMap.set(d.id, d.name));

        // Group daily points
        const buckets: Record<string, DailyPoint> = {};
        for (let i = daysAgo - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          const displayDate = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          buckets[key] = { date: key, displayDate, appts: 0, revenue: 0, consultations: 0 };
        }

        apptRows.forEach((a) => {
          const k = new Date(a.scheduled_at).toISOString().slice(0, 10);
          if (buckets[k]) buckets[k].appts++;
        });

        consRows.forEach((c) => {
          const k = new Date(c.created_at).toISOString().slice(0, 10);
          if (buckets[k]) buckets[k].consultations++;
        });

        invRows.forEach((iv) => {
          if (buckets[iv.issue_date] && iv.status !== "void") {
            buckets[iv.issue_date].revenue += Number(iv.amount_paid ?? 0);
          }
        });

        // Appt status breakdown
        const statusMap: Record<string, number> = {};
        let completed = 0;
        let cancelled = 0;
        apptRows.forEach((a) => {
          const st = a.status ?? "scheduled";
          statusMap[st] = (statusMap[st] ?? 0) + 1;
          if (st === "completed") completed++;
          if (st === "cancelled") cancelled++;
        });

        const statusBreakdown = Object.entries(statusMap).map(([status, count]) => ({
          status,
          count,
        }));

        // Top Services by revenue
        const invIds = invRows.map((i) => i.id);
        let topServices: { description: string; revenue: number }[] = [];
        if (invIds.length > 0) {
          const { data: lineItems } = await supabase
            .from("patient_invoice_items" as any)
            .select("description, amount")
            .in("invoice_id", invIds);

          const agg: Record<string, number> = {};
          ((lineItems as any[]) ?? []).forEach((li) => {
            const desc = li.description || "General Consultation";
            agg[desc] = (agg[desc] ?? 0) + Number(li.amount);
          });

          topServices = Object.entries(agg)
            .map(([description, revenue]) => ({ description, revenue }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);
        }

        // Doctor OPD Leaderboard
        const docAgg: Record<string, { name: string; consultations: number; revenue: number }> = {};
        apptRows.forEach((a) => {
          const name =
            a.doctor_name || (a.doctor_id ? doctorsMap.get(a.doctor_id) : null) || "Primary Doctor";
          if (!docAgg[name]) docAgg[name] = { name, consultations: 0, revenue: 0 };
          if (a.status === "completed") docAgg[name].consultations++;
        });

        const doctorLeaderboard = Object.values(docAgg).sort(
          (a, b) => b.consultations - a.consultations,
        );

        if (!active) return;

        setData({
          totalPatients: pats.count ?? 0,
          newPatientsInRange: newPats.count ?? 0,
          appointments: apptRows.length,
          completedAppts: completed,
          cancelledAppts: cancelled,
          consultations: consRows.length,
          grossRevenue: invRows
            .filter((i) => i.status !== "void")
            .reduce((s, i) => s + Number(i.amount_paid ?? 0), 0),
          outstandingRevenue: invRows
            .filter((i) => i.status !== "void" && i.status !== "paid" && i.status !== "draft")
            .reduce((s, i) => s + (Number(i.total ?? 0) - Number(i.amount_paid ?? 0)), 0),
          reviewsCount: approvedRevs.length,
          avgRating: approvedRevs.length
            ? approvedRevs.reduce((s, r) => s + r.rating, 0) / approvedRevs.length
            : 4.8,
          lowStockItems: itemRows.filter(
            (it) => Number(it.quantity) <= Number(it.reorder_level ?? 0),
          ).length,
          pendingLabs: (labs.data as any[])?.length ?? 0,
          dailyData: Object.values(buckets),
          statusBreakdown,
          topServices,
          doctorLeaderboard,
        });
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [orgId, timeRange]);

  function exportReport() {
    if (!data) return;
    const csvLines = [
      `Clinic Analytics Performance Report (${timeRange.toUpperCase()})`,
      `Generated Date: ${new Date().toLocaleString()}`,
      "",
      `Metric,Value`,
      `Total Registered Patients,${data.totalPatients}`,
      `New Patients in Period,${data.newPatientsInRange}`,
      `Total Appointments,${data.appointments}`,
      `Completed Appointments,${data.completedAppts}`,
      `Cancelled Appointments,${data.cancelledAppts}`,
      `Gross Collected Revenue (₹),${data.grossRevenue}`,
      `Outstanding Revenue (₹),${data.outstandingRevenue}`,
      `Average Rating,${data.avgRating.toFixed(1)} ⭐ (${data.reviewsCount} reviews)`,
      `Low Stock Inventory Alert Items,${data.lowStockItems}`,
      `Pending Lab Orders,${data.pendingLabs}`,
      "",
      `Daily Breakdown:`,
      `Date,Appointments,Consultations,Revenue (₹)`,
      ...data.dailyData.map((d) => `${d.date},${d.appts},${d.consultations},${d.revenue}`),
    ];

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Clinic_Analytics_${timeRange}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.success("Executive Analytics Report downloaded");
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Range Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Analytics & Insights</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time financial velocity, OPD patient flow, and clinical performance metrics.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-muted/60 p-1 rounded-xl border">
            {(["7d", "30d", "90d", "ytd"] as RangeOption[]).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  timeRange === r
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r === "7d"
                  ? "Last 7 Days"
                  : r === "30d"
                    ? "30 Days"
                    : r === "90d"
                      ? "90 Days"
                      : "Year to Date"}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={exportReport}
            disabled={!data}
            className="gap-1.5 rounded-xl"
          >
            <Download className="size-3.5" /> Export Report
          </Button>
        </div>
      </div>

      {loading || !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          {/* Executive Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatsCard
              title="Gross Revenue"
              value={`₹${data.grossRevenue.toLocaleString()}`}
              icon={<Receipt className="size-4 text-emerald-600" />}
            />
            <StatsCard
              title="Total Appointments"
              value={data.appointments}
              icon={<CalendarCheck className="size-4 text-primary" />}
            />
            <StatsCard
              title="Total Patients"
              value={data.totalPatients}
              icon={<Users className="size-4 text-indigo-500" />}
            />
            <StatsCard
              title="Patient Rating"
              value={`${data.avgRating.toFixed(1)} ⭐`}
              icon={<Star className="size-4 text-amber-500" />}
            />
          </div>

          {/* secondary stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4 space-y-1 bg-muted/20">
              <span className="text-xs text-muted-foreground">New Patients ({timeRange})</span>
              <p className="text-xl font-bold text-foreground">+{data.newPatientsInRange}</p>
            </Card>
            <Card className="p-4 space-y-1 bg-muted/20">
              <span className="text-xs text-muted-foreground">Outstanding Pending</span>
              <p className="text-xl font-bold text-amber-600">
                ₹{data.outstandingRevenue.toLocaleString()}
              </p>
            </Card>
            <Card className="p-4 space-y-1 bg-muted/20">
              <span className="text-xs text-muted-foreground">Low Stock Inventory</span>
              <p className="text-xl font-bold text-destructive">{data.lowStockItems} items</p>
            </Card>
            <Card className="p-4 space-y-1 bg-muted/20">
              <span className="text-xs text-muted-foreground">Pending Lab Reports</span>
              <p className="text-xl font-bold text-blue-600">{data.pendingLabs} orders</p>
            </Card>
          </div>

          {/* Interactive Recharts Charts Section */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Area Chart: Revenue & Appointment Trend */}
            <Card className="lg:col-span-2 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-base flex items-center gap-2">
                    <TrendingUp className="size-4 text-primary" /> Revenue & OPD Volume Trend
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Daily progression of clinic collections and patient visits
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="text-[11px] bg-primary/5 text-primary border-primary/20"
                >
                  Live Data
                </Badge>
              </div>

              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.dailyData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorAppt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                    <XAxis
                      dataKey="displayDate"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.9)",
                        borderRadius: "12px",
                        border: "none",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                      formatter={(val: any, name: string) => [
                        name === "revenue" ? `₹${Number(val).toLocaleString()}` : val,
                        name === "revenue" ? "Revenue (₹)" : "Appointments",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorRev)"
                    />
                    <Area
                      type="monotone"
                      dataKey="appts"
                      stroke="#0284c7"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorAppt)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Top Services Bar Breakdown */}
            <Card className="p-5 space-y-4">
              <div>
                <h2 className="font-semibold text-base flex items-center gap-2">
                  <BarChart3 className="size-4 text-emerald-500" /> Top Services Revenue
                </h2>
                <p className="text-xs text-muted-foreground">
                  Highest grossing clinical procedures & consultations
                </p>
              </div>

              {data.topServices.length === 0 ? (
                <div className="h-60 grid place-items-center text-center text-xs text-muted-foreground p-4">
                  No billed services recorded in selected range.
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {data.topServices.map((ts, idx) => {
                    const maxRevenue = data.topServices[0]?.revenue || 1;
                    const pct = Math.round((ts.revenue / maxRevenue) * 100);
                    return (
                      <div key={ts.description} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="truncate max-w-[180px] font-medium text-foreground">
                            {ts.description}
                          </span>
                          <span className="font-mono font-semibold text-primary">
                            ₹{ts.revenue.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Bottom Row: Doctor OPD Performance & Status Breakdown */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Doctor Leaderboard */}
            <Card className="p-5 space-y-4">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <Stethoscope className="size-4 text-indigo-500" /> Doctor OPD Consultations
              </h2>
              {data.doctorLeaderboard.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No completed consultations in this period.
                </p>
              ) : (
                <div className="divide-y text-sm">
                  {data.doctorLeaderboard.map((doc, idx) => (
                    <div key={doc.name} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="size-6 rounded-full bg-primary/10 text-primary font-bold text-xs grid place-items-center">
                          #{idx + 1}
                        </span>
                        <div>
                          <p className="font-medium text-foreground leading-tight">{doc.name}</p>
                          <span className="text-xs text-muted-foreground">
                            {doc.consultations} completed visits
                          </span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="font-mono font-medium">
                        {doc.consultations} Visits
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Appointment Status Breakdown */}
            <Card className="p-5 space-y-4">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <PieChartIcon className="size-4 text-amber-500" /> Appointment Status Ratio
              </h2>
              {data.statusBreakdown.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No appointment data found for selected period.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.statusBreakdown.map((sb) => {
                    const pct = Math.round((sb.count / Math.max(1, data.appointments)) * 100);
                    return (
                      <div
                        key={sb.status}
                        className="flex items-center justify-between text-sm p-2.5 rounded-xl bg-muted/30"
                      >
                        <span className="capitalize font-medium text-foreground">
                          {sb.status.replace("_", " ")}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                          <Badge variant="outline" className="font-mono">
                            {sb.count}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
