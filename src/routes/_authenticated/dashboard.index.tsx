import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "./dashboard";
import { useOrganization } from "@/hooks/useOrganization";
import { ValueHero } from "@/components/value/ValueHero";

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
  const [activeFilter, setActiveFilter] = useState<"all" | "pending" | "confirmed" | "completed">("all");
  const [loadingAppts, setLoadingAppts] = useState(true);

  const updateStatusFn = useServerFn(updateAppointmentStatus);

  const fetchDashboardData = async () => {
    if (!clinic?.id) return;
    setLoadingAppts(true);

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const todayDateStr = now.toISOString().slice(0, 10);

    const [
      todayRes,
      completedRes,
      pendingRes,
      weekRes,
      allApptsRes,
      todayListRes,
      queueRes
    ] = await Promise.all([
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
        .select("id, patient_name, patient_phone, patient_age, patient_gender, scheduled_at, status, appointment_type, problem, source")
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
      (allApptsRes.data ?? []).map((r: any) => r.patient_phone).filter(Boolean)
    );

    const completedCount = completedRes.count ?? 0;
    const fee = clinic.consultation_fee ?? 500;
    const estRevenue = completedCount * fee;

    setStats({
      todayTotal: todayRes.count ?? 0,
      todayCompleted: completedCount,
      pending: pendingRes.count ?? 0,
      week: weekRes.count ?? 0,
      patients: uniquePhones.size,
      waitingQueue: queueRes.count ?? 0,
      todayRevenue: estRevenue,
    });

    setTodayAppts((todayListRes.data as TodayAppointment[]) ?? []);
    setLoadingAppts(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, [clinic?.id]);

  const handleUpdateStatus = async (id: string, status: "confirmed" | "completed" | "cancelled") => {
    try {
      await updateStatusFn({ data: { id, status } });
      toast.success(`Appointment marked as ${status}`);
      setTodayAppts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
      if (status === "completed") {
        setStats((prev) =>
          prev
            ? {
                ...prev,
                todayCompleted: prev.todayCompleted + 1,
                todayRevenue: prev.todayRevenue + (clinic?.consultation_fee ?? 500),
              }
            : null
        );
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status");
    }
  };

  if (!clinic) {
    return <SkeletonStatCards count={4} />;
  }

  const url = getPublicClinicUrl(
    clinic,
    typeof window !== "undefined" ? window.location.origin : ""
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
      {/* Doctor Header & Operational Cockpit */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                DOCTOR'S CLINICAL CONSOLE
              </span>
              {clinic.specialization && (
                <Badge variant="outline" className="text-xs font-normal">
                  {clinic.specialization}
                </Badge>
              )}
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-extrabold text-foreground tracking-tight pt-1">
              {greeting}, {displayName}
            </h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <Activity className="size-4 text-emerald-500" />
              <span>{clinic.clinic_name}</span> &bull;{" "}
              <span className="font-mono text-xs">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </p>
          </div>

          {/* Quick Doctor Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              onClick={() => navigate({ to: "/dashboard/prescriptions" })}
              className="bg-primary text-primary-foreground font-semibold shadow-xs hover:bg-primary/90 h-10 px-4 text-xs gap-2"
            >
              <Stethoscope className="size-4" /> Start Consultation / E-Rx
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/dashboard/walkins" })}
              className="h-10 text-xs gap-1.5"
            >
              <UserPlus className="size-4 text-emerald-600" /> Add Walk-in
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/dashboard/queue" })}
              className="h-10 text-xs gap-1.5"
            >
              <Clock className="size-4 text-amber-600" /> Live Queue
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(url);
                toast.success("Clinic booking link copied!");
              }}
              title="Copy Booking Link"
              className="h-10 w-10"
            >
              <Copy className="size-4" />
            </Button>
            <a href={url} target="_blank" rel="noreferrer">
              <Button variant="ghost" size="icon" title="View Public Website" className="h-10 w-10">
                <ExternalLink className="size-4" />
              </Button>
            </a>
          </div>
        </div>

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
      </div>

      <SetupChecklistCard clinic={clinic} />

      {org?.id && <ValueHero organizationId={org.id} />}

      {/* Key Practice Statistics */}
      {stats === null ? (
        <SkeletonStatCards count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatCard
            icon={Calendar}
            label="Today's Consultations"
            value={`${stats.todayCompleted} / ${stats.todayTotal}`}
            subText="Completed vs Total"
            color="blue"
          />
          <StatCard
            icon={Clock}
            label="Waiting Room Queue"
            value={stats.waitingQueue}
            subText="Patients waiting at clinic"
            color="amber"
            accent={stats.waitingQueue > 0}
          />
          <StatCard
            icon={AlertCircle}
            label="Pending Approvals"
            value={stats.pending}
            subText="Awaiting confirmation"
            color="purple"
          />
          <StatCard
            icon={IndianRupee}
            label="Est. Today Collections"
            value={`₹${stats.todayRevenue.toLocaleString()}`}
            subText={`₹${clinic.consultation_fee ?? 500} / patient`}
            color="emerald"
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
          <div className="p-12 text-center">
            <div className="size-12 rounded-full bg-primary/10 text-primary grid place-items-center mx-auto mb-3">
              <Calendar className="size-6" />
            </div>
            <h3 className="font-display font-semibold text-base">No appointments for this filter</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {activeFilter === "all"
                ? "No patients booked yet for today. Share your clinic booking link or add a walk-in patient."
                : `No ${activeFilter} appointments scheduled for today.`}
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                size="sm"
                onClick={() => navigate({ to: "/dashboard/walkins" })}
                className="h-8 text-xs gap-1.5"
              >
                <UserPlus className="size-3.5" /> Add Walk-in
              </Button>
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
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredAppts.map((a) => {
              const timeStr = new Date(a.scheduled_at).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const cleanPhone = a.patient_phone ? a.patient_phone.replace(/[^\d]/g, "") : "";
              const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone}` : null;

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
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            Walk-in QR
                          </Badge>
                        )}
                      </div>

                      {a.problem ? (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          <span className="font-medium text-foreground">Complaint:</span> {a.problem}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No symptoms mentioned</p>
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
                      <Badge variant="secondary" className="text-xs text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
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
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/50",
  purple: "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200/50",
};

function StatCard({
  icon: Icon,
  label,
  value,
  subText,
  color = "blue",
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subText?: string;
  color?: string;
  accent?: boolean;
}) {
  return (
    <Card className={`p-5 card-soft transition-all ${accent ? "border-primary/40 bg-primary/5 shadow-xs" : ""}`}>
      <div className="flex items-center justify-between">
        <div className={`size-10 rounded-xl grid place-items-center border ${COLOR_MAP[color] ?? COLOR_MAP.blue}`}>
          <Icon className="size-5" />
        </div>
      </div>
      <p className="mt-3 text-2xl md:text-3xl font-display font-extrabold tracking-tight text-foreground">{value}</p>
      <p className="text-xs font-semibold text-foreground/80 mt-1">{label}</p>
      {subText && <p className="text-[11px] text-muted-foreground mt-0.5">{subText}</p>}
    </Card>
  );
}

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
          <div className={`size-10 rounded-xl grid place-items-center mb-3 border ${COLOR_MAP[color] ?? COLOR_MAP.blue}`}>
            {icon}
          </div>
          <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{label}</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
        </div>
        <div className="flex items-center gap-1 mt-4 text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform">
          Open <ArrowRight className="size-3.5" />
        </div>
      </Card>
    </Link>
  );
}
