import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "./dashboard";
import { useOrganization } from "@/hooks/useOrganization";
import { PageHeader } from "@/components/ui/page-header";
import { DashboardPushPrompt } from "@/components/app/DashboardPushPrompt";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Users,
  Clock,
  Copy,
  ExternalLink,
  TrendingUp,
  ArrowRight,
  Zap,
  BarChart2,
  Stethoscope,
  UserPlus,
  MessageSquare,
  Sparkles,
  Phone,
  CheckCircle2,
  QrCode,
  IndianRupee,
  Activity,
  Play,
  FileText,
  AlertCircle,
  RefreshCw,
  Search,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { getPublicClinicUrl } from "@/lib/publicClinicUrl";
import { StatusBadge } from "@/components/ui/status-badge";
import { AvatarInitials, SkeletonStatCards } from "@/components/ui/skeleton-rows";
import { SetupChecklistCard } from "@/components/dashboard/SetupChecklistCard";
import { useServerFn } from "@tanstack/react-start";
import { updateAppointmentStatus } from "@/lib/clinic.functions";
import { readCache, writeCache } from "@/lib/persist-cache";
import { useOnline } from "@/hooks/useOnline";

interface TodayAppointment {
  id: string;
  patient_name: string;
  patient_phone: string;
  patient_age: number | null;
  patient_gender: string | null;
  scheduled_at: string;
  status: string;
  appointment_type: string;
  problem: string | null;
  source: string | null;
}

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: Overview,
});

function Overview() {
  const clinic = useClinic();
  const { org } = useOrganization();
  const navigate = useNavigate();

  const [stats, setStats] = useState<{
    todayTotal: number;
    todayCompleted: number;
    pending: number;
    week: number;
    patients: number;
    waitingQueue: number;
    todayRevenue: number;
  } | null>(null);

  const [todayAppts, setTodayAppts] = useState<TodayAppointment[]>([]);
  const [activeFilter, setActiveFilter] = useState<"all" | "pending" | "confirmed" | "completed">(
    "all",
  );
  const [loadingAppts, setLoadingAppts] = useState(true);

  const updateStatusFn = useServerFn(updateAppointmentStatus);
  const online = useOnline();
  const [usingCachedStats, setUsingCachedStats] = useState(false);

  const fetchDashboardData = async () => {
    if (!clinic?.id) return;

    // Offline: paint the last saved counts (no patient details) instead of a blank page.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const cached = readCache<typeof stats>(`dash:stats:${clinic.id}`, 24 * 60 * 60 * 1000);
      if (cached) setStats(cached);
      setUsingCachedStats(true);
      setTodayAppts([]);
      setLoadingAppts(false);
      return;
    }

    setUsingCachedStats(false);
    setLoadingAppts(true);

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const todayDateStr = now.toISOString().slice(0, 10);

    const [todayRes, completedRes, pendingRes, weekRes, allApptsRes, todayListRes, queueRes] =
      await Promise.all([
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinic.id)
          .gte("scheduled_at", startOfDay.toISOString())
          .lte("scheduled_at", endOfDay.toISOString()),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinic.id)
          .gte("scheduled_at", startOfDay.toISOString())
          .lte("scheduled_at", endOfDay.toISOString())
          .eq("status", "completed"),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinic.id)
          .eq("status", "pending"),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinic.id)
          .gte("scheduled_at", now.toISOString())
          .lte("scheduled_at", weekEnd.toISOString()),
        supabase.from("appointments").select("patient_phone").eq("clinic_id", clinic.id),
        supabase
          .from("appointments")
          .select(
            "id, patient_name, patient_phone, patient_age, patient_gender, scheduled_at, status, appointment_type, problem, source",
          )
          .eq("clinic_id", clinic.id)
          .gte("scheduled_at", startOfDay.toISOString())
          .lte("scheduled_at", endOfDay.toISOString())
          .order("scheduled_at", { ascending: true }),
        clinic.organization_id
          ? supabase
              .from("queue_tokens" as any)
              .select("id", { count: "exact", head: true })
              .eq("organization_id", clinic.organization_id)
              .eq("queue_date", todayDateStr)
              .eq("status", "waiting")
          : Promise.resolve({ count: 0 }),
      ]);

    const uniquePhones = new Set(
      (allApptsRes.data ?? []).map((r: any) => r.patient_phone).filter(Boolean),
    );

    const completedCount = completedRes.count ?? 0;
    const fee = clinic.consultation_fee ?? 500;
    const estRevenue = completedCount * fee;

    const nextStats = {
      todayTotal: todayRes.count ?? 0,
      todayCompleted: completedCount,
      pending: pendingRes.count ?? 0,
      week: weekRes.count ?? 0,
      patients: uniquePhones.size,
      waitingQueue: queueRes.count ?? 0,
      todayRevenue: estRevenue,
    };
    setStats(nextStats);
    writeCache(`dash:stats:${clinic.id}`, nextStats);

    setTodayAppts((todayListRes.data as TodayAppointment[]) ?? []);
    setLoadingAppts(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, [clinic?.id, online]);

  const handleUpdateStatus = async (
    id: string,
    status: "confirmed" | "completed" | "cancelled",
  ) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("You're offline — reconnect and try again", {
        action: { label: "Retry", onClick: () => handleUpdateStatus(id, status) },
      });
      return;
    }
    try {
      await updateStatusFn({ data: { id, status } });
      toast.success(`Appointment marked as ${status}`);
      setTodayAppts((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      if (status === "completed") {
        setStats((prev) =>
          prev
            ? {
                ...prev,
                todayCompleted: prev.todayCompleted + 1,
                todayRevenue: prev.todayRevenue + (clinic?.consultation_fee ?? 500),
              }
            : null,
        );
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status", {
        action: { label: "Retry", onClick: () => handleUpdateStatus(id, status) },
      });
    }
  };

  if (!clinic) {
    return <SkeletonStatCards count={4} />;
  }

  const url = getPublicClinicUrl(
    clinic,
    typeof window !== "undefined" ? window.location.origin : "",
  );

  const getGreetingName = () => {
    if (!clinic.doctor_name) return "Doctor";
    const cleaned = clinic.doctor_name.trim().replace(/^dr\.?\s*/i, "");
    if (!cleaned) return "Doctor";
    const firstName = cleaned.split(" ")[0];
    return `Dr. ${firstName}`;
  };

  const displayName = getGreetingName();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const filteredAppts = todayAppts.filter((a) => {
    if (activeFilter === "all") return true;
    return a.status === activeFilter;
  });

  return (
    <div className="space-y-4">
      {usingCachedStats && (
        <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground flex items-center justify-between gap-2">
          <span>
            Offline — showing your last saved totals. Patient details stay hidden until you
            reconnect.
          </span>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={fetchDashboardData}>
            <RefreshCw className="size-3 mr-1" /> Retry
          </Button>
        </div>
      )}

      {/* Executive Doctor Header Card */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {clinic.clinic_name} • Practice Active
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-extrabold tracking-tight text-foreground">
              {greeting}, <span className="text-primary">{displayName}</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 sm:pt-0 w-full sm:w-auto">
            <Button
              size="default"
              onClick={() => navigate({ to: "/dashboard/prescriptions" })}
              className="h-10 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs sm:text-sm shadow-md hover:bg-primary/90 gap-2 w-full sm:w-auto justify-center"
            >
              <Stethoscope className="size-4" /> Start Consultation
            </Button>
            <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="default"
                onClick={() => navigate({ to: "/dashboard/walkins" })}
                className="h-10 px-3.5 rounded-xl text-xs sm:text-sm font-semibold gap-1.5 border-border/80 hover:bg-accent justify-center"
              >
                <UserPlus className="size-4 text-emerald-600 dark:text-emerald-400" /> Walk-in
              </Button>
              <Button
                variant="outline"
                size="default"
                onClick={() => navigate({ to: "/dashboard/queue" })}
                className="h-10 px-3.5 rounded-xl text-xs sm:text-sm font-semibold gap-1.5 border-border/80 hover:bg-accent justify-center"
              >
                <Clock className="size-4 text-amber-600 dark:text-amber-400" /> Queue
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Push Notification Opt-in Prompt */}
      <DashboardPushPrompt />

      {/* Quick Toolbar Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-6 pt-5 border-t border-border/60">
        <Link
          to="/dashboard/prescriptions"
          className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border/80 bg-muted/20 hover:bg-primary/5 hover:border-primary/30 transition-all text-xs font-medium text-foreground"
        >
          <div className="size-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 grid place-items-center">
            <FileText className="size-4" />
          </div>
          <span>New E-Prescription</span>
        </Link>
        <Link
          to="/dashboard/assistant"
          className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border/80 bg-muted/20 hover:bg-purple/5 hover:border-purple/30 transition-all text-xs font-medium text-foreground"
        >
          <div className="size-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 grid place-items-center">
            <Sparkles className="size-4" />
          </div>
          <span>AI SOAP Assistant</span>
        </Link>
        <Link
          to="/dashboard/qr"
          className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border/80 bg-muted/20 hover:bg-emerald/5 hover:border-emerald/30 transition-all text-xs font-medium text-foreground"
        >
          <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center">
            <QrCode className="size-4" />
          </div>
          <span>Walk-in QR Stand</span>
        </Link>
        <Link
          to="/dashboard/whatsapp"
          className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border/80 bg-muted/20 hover:bg-amber/5 hover:border-amber/30 transition-all text-xs font-medium text-foreground"
        >
          <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center">
            <MessageSquare className="size-4" />
          </div>
          <span>WhatsApp Bot Status</span>
        </Link>
      </div>
      {/* End Quick Toolbar Shortcuts */}

      <SetupChecklistCard clinic={clinic} />

      {/* Key Practice Statistics */}
      {stats === null ? (
        <SkeletonStatCards count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            icon={<Calendar className="size-4" />}
            title="Today's Consultations"
            value={`${stats.todayCompleted} / ${stats.todayTotal}`}
            description="Completed vs Total"
          />
          <StatCard
            icon={<Clock className="size-4" />}
            title="Waiting Room Queue"
            value={stats.waitingQueue}
            description="Patients waiting at clinic"
            className={
              stats.waitingQueue > 0
                ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20"
                : ""
            }
          />
          <StatCard
            icon={<AlertCircle className="size-4" />}
            title="Pending Approvals"
            value={stats.pending}
            description="Awaiting confirmation"
          />
          <StatCard
            icon={<IndianRupee className="size-4" />}
            title="Est. Today Collections"
            value={`₹${stats.todayRevenue.toLocaleString()}`}
            description={`₹${clinic.consultation_fee ?? 500} / patient`}
          />
        </div>
      )}

      {/* Today's Clinical Schedule Feed */}
      <Card className="overflow-hidden border-border shadow-xs">
        <div className="p-5 border-b border-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold text-foreground">
                  Today's Patient Feed & Schedule
                </h2>
                <Badge variant="secondary" className="font-mono text-xs">
                  {todayAppts.length} appointments
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage your appointments, call patients, or launch instant consultations.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchDashboardData}
                className="h-8 text-xs gap-1"
                title="Refresh schedule"
              >
                <RefreshCw className="size-3.5" /> Refresh
              </Button>
              <Link to="/dashboard/appointments">
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                  Full Schedule <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {(["all", "pending", "confirmed", "completed"] as const).map((filterKey) => (
              <button
                key={filterKey}
                type="button"
                onClick={() => setActiveFilter(filterKey)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all capitalize shrink-0 ${
                  activeFilter === filterKey
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted"
                }`}
              >
                {filterKey === "all" ? `All Today (${todayAppts.length})` : filterKey}
              </button>
            ))}
          </div>
        </div>

        {/* Patient Feed Rows */}
        {loadingAppts ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Loading today's schedule...
          </div>
        ) : filteredAppts.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Calendar className="size-6" />}
              title="No appointments for this filter"
              description={
                activeFilter === "all"
                  ? "No patients booked yet for today. Share your clinic booking link or add a walk-in patient."
                  : `No ${activeFilter} appointments scheduled for today.`
              }
              action={
                <Button
                  size="sm"
                  onClick={() => navigate({ to: "/dashboard/walkins" })}
                  className="h-8 text-xs gap-1.5"
                >
                  <UserPlus className="size-3.5" /> Add Walk-in
                </Button>
              }
              secondaryAction={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(url);
                    toast.success("Booking link copied!");
                  }}
                  className="h-8 text-xs gap-1.5"
                >
                  <Copy className="size-3.5" /> Copy Booking Link
                </Button>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredAppts.map((a) => {
              const timeStr = new Date(a.scheduled_at).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const cleanPhone = a.patient_phone ? a.patient_phone.replace(/[^\d]/g, "") : "";
              const waUrl = cleanPhone
                ? `https://wa.me/${cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone}`
                : null;

              return (
                <div
                  key={a.id}
                  className="p-4 md:px-6 hover:bg-muted/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="text-center shrink-0 min-w-[65px] p-2 rounded-xl bg-muted/40 border border-border/60">
                      <span className="block font-mono text-xs font-bold text-foreground">
                        {timeStr}
                      </span>
                      <span className="block text-[10px] text-muted-foreground uppercase font-mono mt-0.5">
                        {a.appointment_type === "online" ? "Video" : "In-Person"}
                      </span>
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm text-foreground truncate">
                          {a.patient_name}
                        </h4>
                        {a.patient_age && (
                          <span className="text-xs text-muted-foreground font-mono">
                            ({a.patient_age}y{a.patient_gender ? `, ${a.patient_gender}` : ""})
                          </span>
                        )}
                        <StatusBadge status={a.status} />
                        {a.source === "walkin" && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          >
                            Walk-in QR
                          </Badge>
                        )}
                      </div>

                      {a.problem ? (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          <span className="font-medium text-foreground">Complaint:</span>{" "}
                          {a.problem}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          No symptoms mentioned
                        </p>
                      )}

                      <p className="text-[11px] text-muted-foreground font-mono">
                        Ph: {a.patient_phone}
                      </p>
                    </div>
                  </div>

                  {/* Doctor Row Actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/40 justify-end">
                    {a.status !== "completed" && (
                      <Button
                        size="sm"
                        onClick={() => navigate({ to: "/dashboard/prescriptions" })}
                        className="h-8 text-xs font-semibold bg-primary text-primary-foreground gap-1.5"
                      >
                        <Stethoscope className="size-3.5" /> Consult
                      </Button>
                    )}

                    {waUrl && (
                      <a href={waUrl} target="_blank" rel="noreferrer">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                          title="Open WhatsApp chat with patient"
                        >
                          <MessageSquare className="size-3.5" /> WhatsApp
                        </Button>
                      </a>
                    )}

                    {a.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateStatus(a.id, "confirmed")}
                        className="h-8 text-xs gap-1 border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
                      >
                        <Check className="size-3.5" /> Confirm
                      </Button>
                    )}

                    {a.status !== "completed" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateStatus(a.id, "completed")}
                        className="h-8 text-xs gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                      >
                        <CheckCircle2 className="size-3.5" /> Done
                      </Button>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-xs text-emerald-600 bg-emerald-500/10 border-emerald-500/20"
                      >
                        ✓ Completed
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Doctor Quick Tools Grid */}
      <div className="grid sm:grid-cols-3 gap-3 md:gap-4">
        <QuickActionCard
          icon={<FileText className="size-5 text-blue-600" />}
          label="E-Prescriptions & EHR"
          desc="Create & print digital prescriptions or view medical history."
          to="/dashboard/prescriptions"
          color="blue"
        />
        <QuickActionCard
          icon={<Users className="size-5 text-purple-600" />}
          label="Patient Directory"
          desc="Full record of past consultations, phone numbers & history."
          to="/dashboard/patients"
          color="purple"
        />
        <QuickActionCard
          icon={<BarChart2 className="size-5 text-emerald-600" />}
          label="Practice Analytics"
          desc="Track patient retention, revenue trends & booking sources."
          to="/dashboard/analytics"
          color="emerald"
        />
      </div>
    </div>
  );
}

const COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200/50",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200/50",
  emerald:
    "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/50",
  purple:
    "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200/50",
};

function QuickActionCard({
  icon,
  label,
  desc,
  to,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  to: string;
  color: string;
}) {
  return (
    <Link to={to}>
      <Card className="p-5 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group h-full flex flex-col justify-between">
        <div>
          <div
            className={`size-10 rounded-xl grid place-items-center mb-3 border ${COLOR_MAP[color] ?? COLOR_MAP.blue}`}
          >
            {icon}
          </div>
          <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
            {label}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
        </div>
        <div className="flex items-center gap-1 mt-4 text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform">
          Open <ArrowRight className="size-3.5" />
        </div>
      </Card>
    </Link>
  );
}
