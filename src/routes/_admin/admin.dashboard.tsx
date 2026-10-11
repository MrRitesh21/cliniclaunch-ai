import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  getAdminStats,
  getPlatformSystemHealth,
  listAdminDoctors,
  createAnnouncement,
  changeDoctorPlan,
  impersonateDoctor,
  runDatabaseCleanup,
  checkMaintenanceStatus,
  saveSystemSettings,
} from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Search,
  Download,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Globe,
  ExternalLink,
  LogIn,
  Clock,
  Sparkles,
  Database,
  Cpu,
  MessageSquare,
  Loader2,
  Send,
  Zap,
  Building2,
  CalendarCheck,
  Server,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { utcDate } from "@/lib/subscription-analytics";

export const Route = createFileRoute("/_admin/admin/dashboard")({
  component: AdminDashboard,
});

function inr(rupees: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

function AdminDashboard() {
  const queryClient = useQueryClient();

  // Server functions
  const statsFn = useServerFn(getAdminStats);
  const healthFn = useServerFn(getPlatformSystemHealth);
  const doctorsFn = useServerFn(listAdminDoctors);
  const announceFn = useServerFn(createAnnouncement);
  const extendPlanFn = useServerFn(changeDoctorPlan);
  const impersonateFn = useServerFn(impersonateDoctor);
  const dbCleanupFn = useServerFn(runDatabaseCleanup);
  const maintenanceFn = useServerFn(checkMaintenanceStatus);
  const saveSettingsFn = useServerFn(saveSystemSettings);

  // Queries
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
    isFetching: statsFetching,
  } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => statsFn(),
  });

  const {
    data: health,
    isLoading: healthLoading,
    refetch: refetchHealth,
    isFetching: healthFetching,
  } = useQuery({
    queryKey: ["admin-platform-health"],
    queryFn: () => healthFn(),
    refetchInterval: 30000, // background heartbeat every 30s
  });

  const { data: doctorsData, isLoading: doctorsLoading } = useQuery({
    queryKey: ["admin-dashboard-doctors"],
    queryFn: () => doctorsFn({ data: { limit: 50 } }),
  });

  const { data: maintenanceData, refetch: refetchMaintenance } = useQuery({
    queryKey: ["admin-maintenance-status"],
    queryFn: () => maintenanceFn(),
  });

  // State
  const [activeTab, setActiveTab] = useState<"overview" | "tenants" | "health" | "activity">("overview");
  const [doctorSearch, setDoctorSearch] = useState("");
  const [doctorStatusFilter, setDoctorStatusFilter] = useState("all");

  // Broadcast Modal State
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceBody, setAnnounceBody] = useState("");
  const [announceType, setAnnounceType] = useState<"info" | "warning" | "success" | "maintenance">("info");

  // Extend Trial Modal State
  const [extendOpen, setExtendOpen] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<{ id: string; name: string } | null>(null);
  const [extendDays, setExtendDays] = useState(7);

  // Mutations
  const broadcastMut = useMutation({
    mutationFn: () =>
      announceFn({
        data: {
          title: announceTitle,
          body: announceBody,
          type: announceType,
          targetPlans: ["all"],
        },
      }),
    onSuccess: () => {
      toast.success("Broadcast sent to all doctors successfully");
      setAnnounceOpen(false);
      setAnnounceTitle("");
      setAnnounceBody("");
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to broadcast announcement"),
  });

  const extendTrialMut = useMutation({
    mutationFn: () =>
      extendPlanFn({
        data: {
          clinicId: selectedClinic?.id || "",
          planId: "starter",
          extendDays,
        },
      }),
    onSuccess: () => {
      toast.success(`Extended access by ${extendDays} days for ${selectedClinic?.name}`);
      setExtendOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-doctors"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to extend trial"),
  });

  const impersonateMut = useMutation({
    mutationFn: (clinicId: string) => impersonateFn({ data: { clinicId } }),
    onSuccess: (res: any) => {
      if (res?.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
        toast.success(`Opening doctor dashboard in new tab (${res.email})`);
      } else {
        toast.error("No impersonation session returned");
      }
    },
    onError: (err: any) => toast.error(err.message || "Impersonation failed"),
  });

  const cleanupMut = useMutation({
    mutationFn: (tool: "unverified" | "sessions" | "archive") => dbCleanupFn({ data: { tool } }),
    onSuccess: (res: any) => {
      toast.success(res?.message || "Database task executed successfully");
      refetchHealth();
    },
    onError: (err: any) => toast.error(err.message || "Database cleanup failed"),
  });

  const toggleMaintenanceMut = useMutation({
    mutationFn: async (enabled: boolean) => {
      await saveSettingsFn({
        data: {
          maintenance_mode: enabled ? "true" : "false",
          maintenance_message: enabled
            ? "We are currently conducting scheduled upgrades. Back shortly."
            : "",
        },
      });
    },
    onSuccess: () => {
      refetchMaintenance();
      refetchHealth();
      toast.success("Maintenance mode state updated");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update maintenance mode"),
  });

  const handleRefreshAll = () => {
    refetchStats();
    refetchHealth();
    queryClient.invalidateQueries({ queryKey: ["admin-dashboard-doctors"] });
    toast.success("Live metrics and diagnostics refreshed");
  };

  const handleExportCSV = () => {
    if (!doctorsData || doctorsData.length === 0) {
      toast.error("No clinic data available to export");
      return;
    }
    const headers = ["Clinic Name", "Doctor Name", "Specialization", "City", "Email", "Phone", "Plan", "Status", "Joined"];
    const rows = (doctorsData as any[]).map((d) => [
      `"${d.clinicName || ""}"`,
      `"${d.doctorName || ""}"`,
      `"${d.specialization || ""}"`,
      `"${d.city || ""}"`,
      `"${d.email || ""}"`,
      `"${d.phone || ""}"`,
      `"${d.plan || ""}"`,
      `"${d.status || ""}"`,
      `"${d.joined || ""}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `clinicx-doctors-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Clinic fleet export generated successfully");
  };

  // Filtered doctors list for tenants tab
  const filteredDoctors = useMemo(() => {
    const list = (doctorsData ?? []) as any[];
    return list.filter((doc) => {
      const matchSearch =
        !doctorSearch ||
        doc.doctorName?.toLowerCase().includes(doctorSearch.toLowerCase()) ||
        doc.clinicName?.toLowerCase().includes(doctorSearch.toLowerCase()) ||
        doc.phone?.includes(doctorSearch) ||
        doc.specialization?.toLowerCase().includes(doctorSearch.toLowerCase());

      const matchStatus = doctorStatusFilter === "all" || doc.status === doctorStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [doctorsData, doctorSearch, doctorStatusFilter]);

  const isMaintenanceActive = maintenanceData?.maintenance_mode === "true";

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1700px] mx-auto animate-in fade-in-50 duration-200">
      {/* ─── Hero Executive Header ─── */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-6 sm:p-8 shadow-xl">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background:
              "radial-gradient(700px circle at 100% 0%, oklch(0.65 0.22 260 / 0.35), transparent 70%), radial-gradient(500px circle at 0% 100%, oklch(0.6 0.18 190 / 0.2), transparent 70%)",
          }}
        />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Control Center
              </span>
              {isMaintenanceActive && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  <AlertTriangle className="size-3 text-rose-400" />
                  Maintenance Mode Active
                </span>
              )}
              <span className="text-xs text-slate-400">
                UTC: {new Date().toISOString().slice(11, 19)} · IST:{" "}
                {new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-white flex items-center gap-3">
              ClinicX Platform Command
              <Sparkles className="size-6 text-amber-400 shrink-0" />
            </h1>
            <p className="text-slate-300 max-w-2xl text-sm sm:text-base leading-relaxed">
              Real-time multi-tenant health, revenue analytics, AI WhatsApp receptionist gateway, and doctor fleet operations.
            </p>
          </div>

          {/* Quick Action Top Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              disabled={statsFetching || healthFetching}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur transition-all"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${statsFetching || healthFetching ? "animate-spin" : ""}`} />
              Sync Live
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setAnnounceOpen(true)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur transition-all"
            >
              <Bell className="size-3.5 mr-1.5 text-amber-400" />
              Broadcast
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur transition-all"
            >
              <Download className="size-3.5 mr-1.5 text-cyan-400" />
              Export Fleet
            </Button>

            <Button
              asChild
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold shadow-lg shadow-emerald-500/25"
            >
              <Link to="/admin/doctors/new">
                <UserPlus className="size-3.5 mr-1.5" />
                Add Doctor
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Master KPI Strip ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <Kpi
          label="Total Clinics"
          value={stats?.totalDoctors ?? "—"}
          hint={stats ? `+${stats.newThisWeek} this week` : ""}
          icon={Users}
          loading={statsLoading}
          trend="up"
        />
        <Kpi
          label="Paid Doctors"
          value={stats?.activeSubs ?? "—"}
          hint={stats ? `${stats.trialSubs} trialing` : ""}
          icon={CreditCard}
          loading={statsLoading}
          accent
        />
        <Kpi
          label="Verified MRR"
          value={stats ? inr(stats.mrr) : "—"}
          hint="Normalized monthly"
          icon={IndianRupee}
          loading={statsLoading}
          accent
        />
        <Kpi
          label="Run-rate ARR"
          value={stats ? inr(stats.arr) : "—"}
          hint="Annualized run-rate"
          icon={TrendingUp}
          loading={statsLoading}
        />
        <Kpi
          label="New Today"
          value={stats?.newSignupsToday ?? "—"}
          hint="Daily signups"
          icon={UserPlus}
          loading={statsLoading}
        />
        <Kpi
          label="30-Day Churn"
          value={stats?.churnRate == null ? "—" : `${stats.churnRate}%`}
          hint={stats ? `${stats.churnedCustomers} churned` : ""}
          icon={TrendingDown}
          loading={statsLoading}
          danger={Boolean(stats && stats.churnRate && stats.churnRate > 5)}
        />
      </div>

      {/* ─── Interactive Navigation Tabs ─── */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-3">
          <TabsList className="bg-muted/80 p-1 rounded-xl h-auto flex flex-wrap gap-1">
            <TabsTrigger
              value="overview"
              className="gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg"
            >
              <TrendingUp className="size-3.5 text-primary" />
              Overview & Financials
            </TabsTrigger>
            <TabsTrigger
              value="tenants"
              className="gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg"
            >
              <Building2 className="size-3.5 text-blue-500" />
              Doctor Fleet Command
              {doctorsData && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                  {(doctorsData as any[]).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="health"
              className="gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg"
            >
              <Server className="size-3.5 text-emerald-500" />
              Live Diagnostics & Health
              {health && (
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
              )}
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-lg"
            >
              <Activity className="size-3.5 text-purple-500" />
              Activity Stream
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 text-xs border-dashed text-muted-foreground hover:text-foreground"
            >
              <Link to="/admin/modules">
                <SlidersHorizontal className="size-3 mr-1" /> Module Flags
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 text-xs border-dashed text-muted-foreground hover:text-foreground"
            >
              <Link to="/admin/settings/system">
                <ScrollText className="size-3 mr-1" /> System Keys
              </Link>
            </Button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 1: OVERVIEW & FINANCIALS
        ═══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="overview" className="space-y-6 m-0">
          {/* Unit Economics Secondary Strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi
              label="Active Trials"
              value={stats?.trialSubs ?? "—"}
              icon={Users}
              loading={statsLoading}
            />
            <Kpi
              label="Ending in 7 Days"
              value={stats?.trialsEndingSoon ?? "—"}
              icon={Bell}
              loading={statsLoading}
              danger={Boolean(stats && stats.trialsEndingSoon && stats.trialsEndingSoon > 0)}
            />
            <Kpi
              label="Expired Trials"
              value={stats?.expiredTrials ?? "—"}
              icon={TrendingDown}
              loading={statsLoading}
            />
            <Kpi
              label="Trial Conversion"
              value={stats?.conversionRate == null ? "—" : `${stats.conversionRate}%`}
              hint={stats ? `${stats.convertedTrials} converted` : ""}
              icon={TrendingUp}
              loading={statsLoading}
            />
            <Kpi
              label="Failed Payments"
              value={stats?.failedPayments ?? "—"}
              hint={stats ? `${stats.failedPaymentCustomers} customers` : ""}
              icon={CreditCard}
              loading={statsLoading}
              danger={Boolean(stats && stats.failedPayments && stats.failedPayments > 0)}
            />
            <Kpi
              label="ARPU (Paid)"
              value={stats?.averageRevenuePerClinic == null ? "—" : inr(stats.averageRevenuePerClinic)}
              hint="MRR / Paid Org"
              icon={IndianRupee}
              loading={statsLoading}
            />
          </div>

          {/* Growth & Distribution Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* 30-Day Velocity Chart */}
            <Card className="p-5 lg:col-span-2 border-border/70 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-display font-semibold text-foreground text-base flex items-center gap-2">
                    <TrendingUp className="size-4 text-emerald-500" />
                    Doctor Signups Velocity
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Daily registrations across the last 30 days
                  </p>
                </div>
                <Badge variant="outline" className="text-xs bg-muted/40 font-mono">
                  {stats?.signupsDaily ? `${stats.signupsDaily.reduce((acc: number, d: any) => acc + d.count, 0)} total` : "—"}
                </Badge>
              </div>

              <div className="pt-2">
                <SparkBars data={stats?.signupsDaily ?? []} />
              </div>

              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span>Earliest: 30 days ago</span>
                <span className="font-medium text-foreground">Peak velocity tracked</span>
                <span>Today</span>
              </div>
            </Card>

            {/* Plan and Subscription Breakdown */}
            <Card className="p-5 border-border/70 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="font-display font-semibold text-foreground text-base mb-1 flex items-center gap-2">
                  <Tag className="size-4 text-primary" />
                  Plan Distribution
                </h3>
                <p className="text-xs text-muted-foreground">
                  Breakdown by paying customer tiers
                </p>
              </div>

              <div className="space-y-3">
                {(stats?.planDistribution ?? []).map((p: any) => {
                  const total = stats?.activeSubs || 1;
                  const pct = Math.round((p.customers / total) * 100);
                  return (
                    <div key={p.planId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium capitalize text-foreground">{p.planId}</span>
                        <span className="text-muted-foreground font-mono">
                          {p.customers} clinics ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {!statsLoading && (stats?.planDistribution ?? []).length === 0 && (
                  <div className="text-xs text-muted-foreground py-4 text-center">No active paid tiers yet.</div>
                )}
              </div>

              <div className="pt-3 border-t border-border/60">
                <div className="text-xs font-medium text-foreground mb-2">Status distribution</div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {(stats?.statusDistribution ?? []).map((s: any) => (
                    <Badge key={s.status} variant="outline" className="capitalize font-mono">
                      {s.status}: {s.customers}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 2: TENANT & DOCTOR FLEET COMMAND
        ═══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="tenants" className="space-y-4 m-0">
          <Card className="p-4 sm:p-5 border-border/70 shadow-sm space-y-4">
            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                  placeholder="Search doctor, clinic name, phone, or specialty..."
                  className="pl-9 h-9 text-xs sm:text-sm"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Select value={doctorStatusFilter} onValueChange={(v) => setDoctorStatusFilter(v)}>
                  <SelectTrigger className="w-36 h-9 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="trialing">Trialing</SelectItem>
                    <SelectItem value="past_due">Past Due</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="canceled">Canceled</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDoctorSearch("");
                    setDoctorStatusFilter("all");
                  }}
                  className="h-9 text-xs"
                >
                  Reset
                </Button>
              </div>
            </div>

            {/* Doctors Fleet Table */}
            <div className="border border-border/70 rounded-xl overflow-x-auto bg-card">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/60 text-muted-foreground font-semibold uppercase tracking-wider text-[10px] border-b border-border/60">
                  <tr>
                    <th className="py-3 px-4">Doctor & Clinic</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Specialization</th>
                    <th className="py-3 px-4">Subscription</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredDoctors.map((doc: any) => (
                    <tr key={doc.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                          {doc.doctorName}
                          {doc.slug && (
                            <a
                              href={`/c/${doc.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              title="View public patient booking portal"
                              className="text-muted-foreground hover:text-primary transition-colors"
                            >
                              <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{doc.clinicName}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-foreground font-mono">{doc.phone || "—"}</div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                          {doc.email || "—"}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-foreground">{doc.specialization || "General"}</div>
                        <div className="text-[11px] text-muted-foreground">{doc.city || "—"}</div>
                      </td>

                      <td className="py-3 px-4">
                        <Badge variant="outline" className="font-medium capitalize text-[11px]">
                          {doc.plan || "Free / Trial"}
                        </Badge>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                            doc.status === "active"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : doc.status === "trialing"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : doc.status === "past_due"
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                  : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {doc.status || "trialing"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => impersonateMut.mutate(doc.id)}
                            disabled={impersonateMut.isPending}
                            title="Log into doctor dashboard as admin"
                            className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
                          >
                            <LogIn className="size-3 mr-1" /> Login
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedClinic({ id: doc.id, name: doc.doctorName });
                              setExtendOpen(true);
                            }}
                            title="Extend trial or free days"
                            className="h-7 px-2 text-xs"
                          >
                            <Clock className="size-3 mr-1 text-amber-500" /> +Days
                          </Button>

                          <Button asChild variant="secondary" size="sm" className="h-7 px-2 text-xs">
                            <Link to="/admin/doctors/$id" params={{ id: doc.id }}>Manage</Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredDoctors.length === 0 && !doctorsLoading && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                        No doctors match the selected search criteria.
                      </td>
                    </tr>
                  )}
                  {doctorsLoading && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">
                        Loading doctor fleet...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 3: LIVE DIAGNOSTICS & INFRASTRUCTURE HEALTH
        ═══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="health" className="space-y-6 m-0">
          {/* Real-time Health Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <HealthServiceCard
              icon={Database}
              title="PostgreSQL Database"
              status={health?.services?.database?.status || (healthLoading ? "Checking..." : "Operational")}
              ok={health?.services?.database?.ok ?? true}
              metric={health?.services?.database?.latencyMs != null ? `${health.services.database.latencyMs} ms latency` : "Active"}
              description="Supabase connection pool, RLS policies & tenant database transactions."
            />

            <HealthServiceCard
              icon={MessageSquare}
              title="WhatsApp AI Gateway"
              status={health?.services?.whatsapp?.status || (healthLoading ? "Checking..." : "Operational")}
              ok={health?.services?.whatsapp?.ok ?? true}
              metric={health?.services?.whatsapp?.connectedClinics != null ? `${health.services.whatsapp.connectedClinics} clinics live` : "Active"}
              description="Baileys multi-session bridge, webhook ingress, and automatic AI appointments."
            />

            <HealthServiceCard
              icon={Cpu}
              title="AI Neural Receptionist"
              status={health?.services?.aiEngine?.status || (healthLoading ? "Checking..." : "Online")}
              ok={health?.services?.aiEngine?.ok ?? true}
              metric="Dual-Engine"
              description="OpenRouter/Gemini LLM model inference with deterministic Hindi/English fallback rules."
            />

            <HealthServiceCard
              icon={Zap}
              title="Payment Gateway (Razorpay)"
              status={health?.services?.payments?.status || (healthLoading ? "Checking..." : "Operational")}
              ok={health?.services?.payments?.ok ?? true}
              metric="Webhook Ready"
              description="Automated recurring subscriptions, invoice processing and instant payment webhooks."
            />
          </div>

          {/* 24-Hour Pulse Metrics */}
          <Card className="p-5 border-border/70 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold text-foreground text-base flex items-center gap-2">
                  <Activity className="size-4 text-emerald-500" />
                  Live Platform Heartbeat (Last 24 Hours)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Real-time throughput metrics aggregated across all registered clinics
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchHealth()}
                disabled={healthFetching}
                className="h-8 text-xs"
              >
                <RefreshCw className={`size-3 mr-1 ${healthFetching ? "animate-spin" : ""}`} /> Ping Services
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Appointments Booked
                </div>
                <div className="text-2xl font-bold font-display text-foreground mt-1">
                  {health?.liveActivity?.appointments24h ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">In last 24 hours</div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  WhatsApp AI Chats
                </div>
                <div className="text-2xl font-bold font-display text-foreground mt-1">
                  {health?.liveActivity?.waMessages24h ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Messages processed</div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Active WhatsApp Clinics
                </div>
                <div className="text-2xl font-bold font-display text-foreground mt-1">
                  {health?.liveActivity?.activeWhatsAppClinics ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Sockets connected</div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Total Tenants
                </div>
                <div className="text-2xl font-bold font-display text-foreground mt-1">
                  {health?.liveActivity?.totalClinics ?? 0}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Registered clinics</div>
              </div>
            </div>
          </Card>

          {/* Quick Maintenance Controls & Emergency Tools */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card className="p-5 border-border/70 shadow-sm space-y-4">
              <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                Emergency Platform Governance
              </h3>
              <p className="text-xs text-muted-foreground">
                Lock out doctor logins during database schema upgrades or emergency platform maintenance.
              </p>

              <div className="p-4 rounded-xl border border-border/80 bg-muted/30 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    Maintenance Mode
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {isMaintenanceActive ? "Platform is currently LOCKED to doctors" : "All services operational and public"}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant={isMaintenanceActive ? "destructive" : "outline"}
                  onClick={() => toggleMaintenanceMut.mutate(!isMaintenanceActive)}
                  disabled={toggleMaintenanceMut.isPending}
                  className="shrink-0 text-xs font-semibold"
                >
                  {isMaintenanceActive ? "Deactivate Lockout" : "Activate Lockout"}
                </Button>
              </div>
            </Card>

            <Card className="p-5 border-border/70 shadow-sm space-y-4">
              <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
                <Database className="size-4 text-purple-500" />
                Database Hygiene & Optimization
              </h3>
              <p className="text-xs text-muted-foreground">
                Run background maintenance routines to clear stale caches and optimize query execution.
              </p>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cleanupMut.mutate("sessions")}
                  disabled={cleanupMut.isPending}
                  className="text-xs h-9 justify-start"
                >
                  <RefreshCw className="size-3 mr-1.5" /> Prune Stale Sessions
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cleanupMut.mutate("unverified")}
                  disabled={cleanupMut.isPending}
                  className="text-xs h-9 justify-start"
                >
                  <AlertTriangle className="size-3 mr-1.5" /> Clean Unverified
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════════
            TAB 4: ACTIVITY STREAM
        ═══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="activity" className="space-y-4 m-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Recent Signups */}
            <Card className="p-5 border-border/70 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
                  <UserPlus className="size-4 text-emerald-500" />
                  Recent Signups
                </h3>
                <Link to="/admin/doctors" className="text-xs text-primary hover:underline">
                  View all
                </Link>
              </div>

              <div className="space-y-2">
                {(stats?.recentClinics ?? []).map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                      {(c.doctor_name || "D").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-foreground truncate">
                        {c.doctor_name}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {c.specialization || "General"} · {c.clinic_name}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground shrink-0 font-mono">
                      {utcDate(c.created_at)}
                    </div>
                  </div>
                ))}
                {!statsLoading && (stats?.recentClinics ?? []).length === 0 && (
                  <div className="text-xs text-muted-foreground py-6 text-center">No signups yet.</div>
                )}
              </div>
            </Card>

            {/* Expiring Trials with Action */}
            <Card className="p-5 border-border/70 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
                  <Clock className="size-4 text-amber-500" />
                  Maturing Trials (7 Days)
                </h3>
                <Link to="/admin/subscriptions" className="text-xs text-primary hover:underline">
                  View all
                </Link>
              </div>

              <div className="space-y-2">
                {(stats?.expiringSubs ?? []).map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-xs"
                  >
                    <div>
                      <div className="font-semibold text-foreground capitalize">
                        {s.clinic_name || `Clinic ${s.id.slice(0, 8)}`}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Ends: {s.trial_ends_at ? utcDate(s.trial_ends_at) : "Soon"}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px] text-amber-600 hover:text-amber-700"
                      onClick={() => {
                        setSelectedClinic({ id: s.clinic_id || s.id, name: s.clinic_name || "Doctor" });
                        setExtendOpen(true);
                      }}
                    >
                      +7 Days
                    </Button>
                  </div>
                ))}
                {!statsLoading && (stats?.expiringSubs ?? []).length === 0 && (
                  <div className="text-xs text-muted-foreground py-6 text-center">
                    No trials expiring in next 7 days.
                  </div>
                )}
              </div>
            </Card>

            {/* Recent Payments */}
            <Card className="p-5 border-border/70 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
                  <CreditCard className="size-4 text-blue-500" />
                  Recent Captured Payments
                </h3>
                <Link to="/admin/transactions" className="text-xs text-primary hover:underline">
                  View all
                </Link>
              </div>

              <div className="space-y-2">
                {(stats?.recentTransactions ?? []).map((t: any) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-xs"
                  >
                    <div>
                      <div className="font-semibold text-foreground capitalize">{t.plan}</div>
                      <div className="text-[11px] text-muted-foreground/70 capitalize">
                        {t.billing_cycle}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                        +{inr(t.amount)}
                      </div>
                      <div className="text-[10px] text-muted-foreground/70 font-mono">
                        {utcDate(t.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
                {!statsLoading && (stats?.recentTransactions ?? []).length === 0 && (
                  <div className="text-xs text-muted-foreground py-6 text-center">
                    No transactions captured yet.
                  </div>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── MODAL: BROADCAST ANNOUNCEMENT ─── */}
      <Dialog open={announceOpen} onOpenChange={setAnnounceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="size-5 text-primary" />
              Broadcast to All Doctors
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs sm:text-sm">
            <div>
              <Label htmlFor="announce_title">Announcement Title</Label>
              <Input
                id="announce_title"
                value={announceTitle}
                onChange={(e) => setAnnounceTitle(e.target.value)}
                placeholder="e.g. Scheduled System Upgrade Tonight"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="announce_type">Notice Type</Label>
              <Select value={announceType} onValueChange={(v: any) => setAnnounceType(v)}>
                <SelectTrigger id="announce_type" className="mt-1">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Information (Blue)</SelectItem>
                  <SelectItem value="warning">Important Alert (Amber)</SelectItem>
                  <SelectItem value="maintenance">Maintenance Notice (Purple)</SelectItem>
                  <SelectItem value="success">Feature Release (Green)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="announce_body">Message Body</Label>
              <Textarea
                id="announce_body"
                value={announceBody}
                onChange={(e) => setAnnounceBody(e.target.value)}
                rows={4}
                placeholder="Details of the announcement displayed inside every doctor dashboard..."
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAnnounceOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => broadcastMut.mutate()}
              disabled={broadcastMut.isPending || !announceTitle.trim() || !announceBody.trim()}
              className="bg-primary"
            >
              {broadcastMut.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
              Send Broadcast
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: EXTEND TRIAL / SUBSCRIPTION ─── */}
      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4 text-amber-500" />
              Extend Access: {selectedClinic?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs sm:text-sm">
            <p className="text-muted-foreground text-xs">
              Grant additional complimentary days without charging the doctor's payment method.
            </p>

            <div>
              <Label htmlFor="extend_days">Additional Days to Add</Label>
              <Select
                value={String(extendDays)}
                onValueChange={(v) => setExtendDays(Number(v))}
              >
                <SelectTrigger id="extend_days" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">+7 Days Complimentary</SelectItem>
                  <SelectItem value="14">+14 Days Complimentary</SelectItem>
                  <SelectItem value="30">+30 Days (1 Full Month)</SelectItem>
                  <SelectItem value="60">+60 Days (2 Months)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setExtendOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => extendTrialMut.mutate()}
              disabled={extendTrialMut.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {extendTrialMut.isPending ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
              Apply Extension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  loading,
  accent,
  danger,
  trend,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  accent?: boolean;
  danger?: boolean;
  trend?: "up" | "down";
}) {
  return (
    <Card
      className={`p-4 border-border/70 transition-all hover:shadow-md hover:-translate-y-0.5 ${
        accent ? "bg-gradient-to-br from-primary/[0.04] to-transparent border-primary/25" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.12em]">
          {label}
        </div>
        <div
          className={`size-7 rounded-lg flex items-center justify-center ${
            accent
              ? "bg-primary/10 text-primary"
              : danger
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground/80"
          }`}
        >
          <Icon className="size-3.5" />
        </div>
      </div>
      <div
        className={`mt-2 text-2xl font-bold font-display tracking-tight ${
          accent ? "text-primary" : danger ? "text-destructive" : "text-foreground"
        }`}
      >
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

function HealthServiceCard({
  icon: Icon,
  title,
  status,
  ok,
  metric,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  status: string;
  ok: boolean;
  metric?: string;
  description: string;
}) {
  return (
    <Card className="p-4 border-border/70 shadow-sm space-y-3 hover:border-border transition-all">
      <div className="flex items-start justify-between">
        <div className="p-2 rounded-xl bg-muted/70 text-foreground">
          <Icon className="size-4 text-primary" />
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            ok
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
          }`}
        >
          <span className={`size-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />
          {status}
        </span>
      </div>

      <div>
        <h4 className="font-semibold text-foreground text-sm">{title}</h4>
        <div className="text-xs font-mono font-medium text-primary mt-0.5">{metric}</div>
        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{description}</p>
      </div>
    </Card>
  );
}

function SparkBars({ data }: { data: Array<{ date: string; count: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-xs text-muted-foreground/70">
        No registration data recorded in the last 30 days.
      </div>
    );
  }
  return (
    <div className="h-40 flex items-end gap-1.5 pt-4">
      {data.map((d) => (
        <div key={d.date} className="flex-1 group relative flex flex-col justify-end">
          <div
            className="bg-gradient-to-t from-primary to-primary/60 hover:from-primary hover:to-primary/90 rounded-t-sm transition-all cursor-pointer"
            style={{ height: `${Math.max(6, (d.count / max) * 100)}%` }}
            title={`${d.date}: ${d.count} signups`}
          />
        </div>
      ))}
    </div>
  );
}
