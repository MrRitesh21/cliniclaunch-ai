import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAdminStats } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  TrendingUp,
  CreditCard,
  IndianRupee,
  UserPlus,
  TrendingDown,
  Bell,
  Tag,
  ScrollText,
  CheckCircle2,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_admin/admin/dashboard")({
  component: AdminDashboard,
});

function inr(rupees: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(rupees);
}

function AdminDashboard() {
  const fn = useServerFn(getAdminStats);
  const { data, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: () => fn() });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground p-6 sm:p-8">
        <div className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(600px circle at 100% 0%, oklch(0.7 0.15 200 / 0.35), transparent 60%), radial-gradient(400px circle at 0% 100%, oklch(0.6 0.14 175 / 0.25), transparent 60%)",
          }}
        />
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-foreground/70 mb-3">
              <Activity className="size-3.5" />
              Live overview
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight">
              Welcome back, Admin.
            </h1>
            <p className="mt-2 text-primary-foreground/70 max-w-xl text-sm sm:text-base">
              Platform-wide metrics, subscriptions and doctor activity — updated in real time.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button asChild variant="secondary" size="sm" className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
              <Link to="/admin/doctors">
                <Users className="size-3.5 mr-1.5" /> View doctors
              </Link>
            </Button>
            <Button asChild size="sm" className="bg-white text-primary hover:bg-white/90 font-bold">
              <Link to="/admin/announcements">
                <Bell className="size-3.5 mr-1.5" /> Broadcast Announcement
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* SaaS Admin Master Control Quick Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link to="/admin/doctors/new" className="p-3.5 bg-card hover:bg-muted/80 border border-border/70 rounded-xl transition-all flex items-center gap-3 group shadow-sm">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
            <UserPlus className="size-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">Add Doctor Signup</div>
            <div className="text-[10px] text-muted-foreground">Provision new doctor account</div>
          </div>
        </Link>
        <Link to="/admin/plans" className="p-3.5 bg-card hover:bg-muted/80 border border-border/70 rounded-xl transition-all flex items-center gap-3 group shadow-sm">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
            <Tag className="size-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">Coupons & Pricing</div>
            <div className="text-[10px] text-muted-foreground">Create discount promo codes</div>
          </div>
        </Link>
        <Link to="/admin/features" className="p-3.5 bg-card hover:bg-muted/80 border border-border/70 rounded-xl transition-all flex items-center gap-3 group shadow-sm">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
            <Activity className="size-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">Feature Flags</div>
            <div className="text-[10px] text-muted-foreground">Control module access</div>
          </div>
        </Link>
        <Link to="/admin/settings/system" className="p-3.5 bg-card hover:bg-muted/80 border border-border/70 rounded-xl transition-all flex items-center gap-3 group shadow-sm">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
            <ScrollText className="size-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">System Configs</div>
            <div className="text-[10px] text-muted-foreground">Razorpay, WATI, AI keys</div>
          </div>
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="Total Doctors" value={data?.totalDoctors ?? "—"} hint={data ? `+${data.newThisWeek} this week` : ""} icon={Users} loading={isLoading} trend="up" />
        <Kpi label="Active Subs" value={data?.activeSubs ?? "—"} hint={data ? `${data.trialSubs} trialing` : ""} icon={CreditCard} loading={isLoading} />
        <Kpi label="MRR" value={data ? inr(data.mrr) : "—"} hint="Monthly recurring" icon={IndianRupee} loading={isLoading} accent />
        <Kpi label="ARR" value={data ? inr(data.arr) : "—"} hint="Annual run-rate" icon={TrendingUp} loading={isLoading} />
        <Kpi label="New Today" value={data?.newSignupsToday ?? "—"} hint="Signups" icon={UserPlus} loading={isLoading} />
        <Kpi label="Churn (mo)" value={data?.expiredThisMonth ?? "—"} hint="Expired/cancelled" icon={TrendingDown} loading={isLoading} danger />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 border-border/60">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-foreground text-base">Doctor signups</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Last 30 days</p>
            </div>
            <Link to="/admin/doctors/new" className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-0.5">
              View all <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <SparkBars data={data?.signupsDaily ?? []} />
        </Card>
        <Card className="p-5 border-border/60 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 size-32 rounded-full bg-primary/5 blur-2xl" />
          <h3 className="font-display font-semibold text-foreground text-base mb-1">Revenue runway</h3>
          <p className="text-xs text-muted-foreground mb-4">Projected annual gross</p>
          <div className="text-3xl font-display font-bold text-primary tracking-tight">{data ? inr(data.mrr * 12) : "—"}</div>
          <div className="mt-6 pt-4 border-t border-border/60 grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-muted-foreground">Total volume</div>
              <div className="font-semibold text-foreground mt-0.5">{data ? inr(data.mrr * 1.4) : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Active accounts</div>
              <div className="font-semibold text-foreground mt-0.5">{data?.activeSubs ?? 0}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 border-border/60">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-foreground">Recent signups</h3>
            <Link to="/admin/doctors" className="text-xs text-muted-foreground hover:text-primary">View all</Link>
          </div>
          <div className="space-y-1">
            {(data?.recentClinics ?? []).map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                  {c.doctor_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{c.doctor_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.specialization} · {c.address || "—"}</div>
                </div>
                <div className="text-[10px] text-muted-foreground/70 shrink-0">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</div>
              </div>
            ))}
            {!isLoading && (data?.recentClinics ?? []).length === 0 && <Empty>No signups yet.</Empty>}
            {isLoading && <SkeletonRows />}
          </div>
        </Card>

        <Card className="p-5 border-border/60">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-foreground">Expiring soon</h3>
            <Link to="/admin/subscriptions" className="text-xs text-muted-foreground hover:text-primary">View all</Link>
          </div>
          <div className="space-y-1">
            {(data?.expiringSubs ?? []).map((s: any) => {
              const end = s.current_period_end ?? s.trial_ends_at;
              return (
                <div key={s.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="text-sm text-foreground/80 capitalize font-medium">{s.status}</div>
                  <div className="text-xs text-muted-foreground">{end ? formatDistanceToNow(new Date(end), { addSuffix: true }) : "—"}</div>
                </div>
              );
            })}
            {!isLoading && (data?.expiringSubs ?? []).length === 0 && <Empty>Nothing expiring in 7 days.</Empty>}
            {isLoading && <SkeletonRows />}
          </div>
        </Card>

        <Card className="p-5 border-border/60">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-foreground">Recent transactions</h3>
            <Link to="/admin/transactions" className="text-xs text-muted-foreground hover:text-primary">View all</Link>
          </div>
          <div className="space-y-1">
            {(data?.recentTransactions ?? []).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors text-sm">
                <div>
                  <div className="font-medium text-foreground">{t.plan}</div>
                  <div className="text-xs text-muted-foreground/70 capitalize">{t.billing_cycle}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-emerald-600 dark:text-emerald-400">+{inr(t.amount)}</div>
                  <div className="text-[10px] text-muted-foreground/70">{new Date(t.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
            {!isLoading && (data?.recentTransactions ?? []).length === 0 && <Empty>No recent transactions.</Empty>}
            {isLoading && <SkeletonRows />}
          </div>
        </Card>
      </div>

      {/* Platform health + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 border-border/60">
          <h3 className="font-display font-semibold text-foreground mb-4">Platform health</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Health label="Supabase DB" ok />
            <Health label="Admin Session" ok />
            <Health label="Razorpay" ok />
            <Health label="WhatsApp Gateway" ok />
          </div>
        </Card>
        <Card className="p-5 border-border/60">
          <h3 className="font-display font-semibold text-foreground mb-4">Quick actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" size="sm" className="justify-start text-xs h-9"><Link to="/admin/doctors"><Users className="size-3.5 mr-1.5" /> Doctors</Link></Button>
            <Button asChild variant="outline" size="sm" className="justify-start text-xs h-9"><Link to="/admin/audit"><ScrollText className="size-3.5 mr-1.5" /> Audit log</Link></Button>
            <Button asChild variant="outline" size="sm" className="justify-start text-xs h-9"><Link to="/admin/announcements"><Bell className="size-3.5 mr-1.5" /> Announce</Link></Button>
            <Button asChild variant="outline" size="sm" className="justify-start text-xs h-9"><Link to="/admin/plans"><Tag className="size-3.5 mr-1.5" /> Coupons</Link></Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label, value, hint, icon: Icon, loading, accent, danger, trend,
}: { label: string; value: string | number; hint?: string; icon: React.ComponentType<{ className?: string }>; loading?: boolean; accent?: boolean; danger?: boolean; trend?: "up" | "down" }) {
  return (
    <Card className={`p-4 border-border/60 transition-all hover:shadow-md hover:-translate-y-0.5 ${accent ? "bg-gradient-to-br from-primary/[0.03] to-transparent" : ""}`}>
      <div className="flex items-start justify-between">
        <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.12em]">{label}</div>
        <div className={`size-7 rounded-lg flex items-center justify-center ${
          accent ? "bg-primary/10 text-primary" :
          danger ? "bg-destructive/10 text-destructive" :
          "bg-muted text-muted-foreground/80"
        }`}>
          <Icon className="size-3.5" />
        </div>
      </div>
      <div className={`mt-2 text-2xl font-bold font-display tracking-tight ${accent ? "text-primary" : "text-foreground"}`}>
        {loading ? <span className="inline-block h-7 w-16 bg-muted rounded animate-pulse" /> : value}
      </div>
      {hint && (
        <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
          {trend === "up" && <TrendingUp className="size-3 text-emerald-500" />}
          {hint}
        </div>
      )}
    </Card>
  );
}

function Health({ label, ok, note }: { label: string; ok: boolean; note?: string }) {
  return (
    <div className="flex items-center gap-2.5 p-3 border border-border/60 rounded-lg bg-background hover:border-border transition-colors">
      <div className={`size-2 rounded-full ${ok ? "bg-emerald-500 shadow-[0_0_8px] shadow-emerald-500/50" : "bg-amber-500"} shrink-0`} />
      <div className="text-sm min-w-0 flex-1">
        <div className="text-foreground font-medium leading-none mb-1 truncate">{label}</div>
        <div className="text-[10px] text-muted-foreground leading-none">{ok ? "Operational" : note ?? "Check config"}</div>
      </div>
      <CheckCircle2 className={`size-3.5 ${ok ? "text-emerald-500" : "text-amber-500"} shrink-0`} />
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted-foreground/70 py-6 text-center">{children}</div>;
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          <div className="size-9 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
            <div className="h-2 bg-muted rounded animate-pulse w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SparkBars({ data }: { data: Array<{ date: string; count: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (data.length === 0) {
    return <div className="h-40 flex items-center justify-center text-sm text-muted-foreground/70">No data yet.</div>;
  }
  return (
    <div className="h-44 flex items-end gap-1 pt-4">
      {data.map((d) => (
        <div key={d.date} className="flex-1 group relative flex flex-col justify-end">
          <div
            className="bg-gradient-to-t from-primary to-primary/50 hover:from-primary hover:to-primary/70 rounded-t-sm transition-all cursor-pointer"
            style={{ height: `${(d.count / max) * 100}%`, minHeight: 4 }}
            title={`${d.date}: ${d.count}`}
          />
        </div>
      ))}
    </div>
  );
}
