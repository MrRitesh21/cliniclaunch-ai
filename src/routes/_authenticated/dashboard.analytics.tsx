import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Users, CalendarCheck, Receipt, Star, Package, FlaskConical } from "lucide-react";
import { AppGuard } from "@/components/app/AppGuard";
import { StatsCard } from "@/components/app/StatsCard";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard/analytics")({
  component: () => (<AppGuard appKey="analytics"><AnalyticsPage /></AppGuard>),
});

type DailyPoint = { date: string; appts: number; revenue: number };

function AnalyticsPage() {
  const { org } = useOrganization();
  const orgId = org?.id;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    patients: number; appointments: number; consultations: number;
    revenue: number; outstanding: number;
    reviews: number; avgRating: number;
    lowStock: number; pendingLabs: number;
    weekly: DailyPoint[];
    statusBreakdown: { status: string; count: number }[];
    topServices: { description: string; revenue: number }[];
  } | null>(null);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      setLoading(true);
      const since = new Date(); since.setDate(since.getDate() - 30);
      const sinceISO = since.toISOString();

      const [pats, apts, cons, invs, revs, items, labs] = await Promise.all([
        supabase.from("patients").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("appointments").select("id, scheduled_at, status").eq("organization_id", orgId).gte("scheduled_at", sinceISO),
        supabase.from("consultations" as any).select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("created_at", sinceISO),
        supabase.from("patient_invoices" as any).select("id, issue_date, total, amount_paid, status").eq("organization_id", orgId).gte("issue_date", sinceISO.slice(0, 10)),
        supabase.from("reviews" as any).select("rating, status").eq("organization_id", orgId),
        supabase.from("inventory_items" as any).select("id, quantity, reorder_level").eq("organization_id", orgId),
        supabase.from("lab_orders" as any).select("id, status").eq("organization_id", orgId).in("status", ["pending", "collected", "in_lab"]),
      ]);

      const apptRows = (apts.data as any[]) ?? [];
      const invRows = (invs.data as any[]) ?? [];
      const revRows = (revs.data as any[]) ?? [];
      const approved = revRows.filter((r) => r.status === "approved");
      const itemRows = (items.data as any[]) ?? [];

      // last 7 days buckets
      const buckets: Record<string, DailyPoint> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        buckets[key] = { date: key, appts: 0, revenue: 0 };
      }
      apptRows.forEach((a) => {
        const k = new Date(a.scheduled_at).toISOString().slice(0, 10);
        if (buckets[k]) buckets[k].appts++;
      });
      invRows.forEach((iv) => {
        if (buckets[iv.issue_date] && iv.status !== "void") buckets[iv.issue_date].revenue += Number(iv.amount_paid ?? 0);
      });

      // appt status breakdown
      const statusMap: Record<string, number> = {};
      apptRows.forEach((a) => { statusMap[a.status ?? "unknown"] = (statusMap[a.status ?? "unknown"] ?? 0) + 1; });
      const statusBreakdown = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

      // top services from invoice items
      const invIds = invRows.map((i) => i.id);
      let topServices: { description: string; revenue: number }[] = [];
      if (invIds.length) {
        const { data: lineItems } = await supabase.from("patient_invoice_items" as any).select("description, amount").in("invoice_id", invIds);
        const agg: Record<string, number> = {};
        ((lineItems as any[]) ?? []).forEach((li) => { agg[li.description] = (agg[li.description] ?? 0) + Number(li.amount); });
        topServices = Object.entries(agg).map(([description, revenue]) => ({ description, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
      }

      setData({
        patients: pats.count ?? 0,
        appointments: apptRows.length,
        consultations: cons.count ?? 0,
        revenue: invRows.filter((i) => i.status !== "void").reduce((s, i) => s + Number(i.amount_paid ?? 0), 0),
        outstanding: invRows.filter((i) => i.status !== "void" && i.status !== "paid" && i.status !== "draft").reduce((s, i) => s + (Number(i.total) - Number(i.amount_paid)), 0),
        reviews: approved.length,
        avgRating: approved.length ? approved.reduce((s, r) => s + r.rating, 0) / approved.length : 0,
        lowStock: itemRows.filter((it) => Number(it.quantity) <= Number(it.reorder_level ?? 0)).length,
        pendingLabs: (labs.data as any[])?.length ?? 0,
        weekly: Object.values(buckets),
        statusBreakdown,
        topServices,
      });
      setLoading(false);
    })();
  }, [orgId]);

  const maxAppts = useMemo(() => Math.max(1, ...(data?.weekly.map((d) => d.appts) ?? [1])), [data]);
  const maxRev = useMemo(() => Math.max(1, ...(data?.weekly.map((d) => d.revenue) ?? [1])), [data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Analytics</h1>
        <p className="text-sm text-muted-foreground">30-day overview across all modules.</p>
      </div>

      {loading || !data ? <Skeleton className="h-64 w-full" /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatsCard title="Patients" value={data.patients} icon={<Users className="size-4" />} />
            <StatsCard title="Appointments (30d)" value={data.appointments} icon={<CalendarCheck className="size-4" />} />
            <StatsCard title="Revenue (30d)" value={`₹${data.revenue.toLocaleString()}`} icon={<Receipt className="size-4" />} />
            <StatsCard title="Outstanding" value={`₹${data.outstanding.toLocaleString()}`} />
            <StatsCard title="Consultations" value={data.consultations} />
            <StatsCard title="Reviews · ⭐" value={`${data.avgRating.toFixed(1)} (${data.reviews})`} icon={<Star className="size-4" />} />
            <StatsCard title="Low stock items" value={data.lowStock} icon={<Package className="size-4" />} />
            <StatsCard title="Pending labs" value={data.pendingLabs} icon={<FlaskConical className="size-4" />} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3"><BarChart3 className="size-4" /><span className="font-medium">Appointments — last 7 days</span></div>
              <div className="flex items-end gap-2 h-40">
                {data.weekly.map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-primary/80 rounded-t" style={{ height: `${(d.appts / maxAppts) * 100}%`, minHeight: d.appts ? 4 : 0 }} />
                    <span className="text-[10px] text-muted-foreground">{new Date(d.date).toLocaleDateString(undefined, { weekday: "short" })}</span>
                    <span className="text-[10px] font-medium">{d.appts}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3"><Receipt className="size-4" /><span className="font-medium">Revenue — last 7 days</span></div>
              <div className="flex items-end gap-2 h-40">
                {data.weekly.map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-emerald-500/80 rounded-t" style={{ height: `${(d.revenue / maxRev) * 100}%`, minHeight: d.revenue ? 4 : 0 }} />
                    <span className="text-[10px] text-muted-foreground">{new Date(d.date).toLocaleDateString(undefined, { weekday: "short" })}</span>
                    <span className="text-[10px] font-medium">₹{Math.round(d.revenue).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <div className="font-medium mb-3">Appointment status</div>
              {data.statusBreakdown.length === 0 ? <p className="text-sm text-muted-foreground">No data.</p> : (
                <div className="space-y-2">
                  {data.statusBreakdown.map((s) => {
                    const pct = (s.count / data.appointments) * 100;
                    return (
                      <div key={s.status}>
                        <div className="flex justify-between text-xs mb-1"><span className="capitalize">{s.status}</span><span>{s.count} ({pct.toFixed(0)}%)</span></div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <div className="font-medium mb-3">Top services (revenue)</div>
              {data.topServices.length === 0 ? <p className="text-sm text-muted-foreground">No invoiced items yet.</p> : (
                <div className="space-y-2">
                  {data.topServices.map((s) => (
                    <div key={s.description} className="flex justify-between text-sm border-b pb-1"><span className="truncate">{s.description}</span><span className="font-medium">₹{s.revenue.toLocaleString()}</span></div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
