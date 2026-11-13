import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "./dashboard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Check,
  X,
  CheckCircle2,
  Video,
  MapPin,
  Search,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  Clock,
  CalendarCheck,
  UserRound,
  Plus,
  Stethoscope,
  Receipt,
  Filter,
  FileText,
  Globe,
  MessageCircle,
  QrCode,
  Code2,
  Loader2,
  UserCheck,
  UserX,
  Flame,
  Zap,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { updateAppointmentStatus, createBooking, getClinicAppointments } from "@/lib/clinic.functions";
import { Label } from "@/components/ui/label";
import { AppGuard } from "@/components/app/AppGuard";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { AvatarInitials, SkeletonRows } from "@/components/ui/skeleton-rows";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cleanProblemAndService } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/appointments")({
  component: () => (
    <AppGuard appKey="appointments">
      <AppointmentsPage />
    </AppGuard>
  ),
});

type Appt = {
  id: string;
  patient_name: string;
  patient_phone: string;
  patient_email: string;
  patient_age: number | null;
  patient_gender: string | null;
  problem: string;
  scheduled_at: string;
  status: string;
  appointment_type: "online" | "offline";
  doctor_id: string | null;
  source?: string | null;
  doctors?: { name: string } | null;
};

function AppointmentsPage() {
  const clinic = useClinic();
  const updateStatus = useServerFn(updateAppointmentStatus);
  const fetchAppointmentsFn = useServerFn(getClinicAppointments);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null); // tracks which row is being updated

  // Add Appointment form states
  const [addOpen, setAddOpen] = useState(false);
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [apptName, setApptName] = useState("");
  const [apptPhone, setApptPhone] = useState("");
  const [apptEmail, setApptEmail] = useState("");
  const [apptAge, setApptAge] = useState("");
  const [apptGender, setApptGender] = useState<"male" | "female" | "other" | "">("");
  const [apptScheduledAt, setApptScheduledAt] = useState("");
  const [apptType, setApptType] = useState<"online" | "offline">("offline");
  const [apptDoctorId, setApptDoctorId] = useState("");
  const [apptProblem, setApptProblem] = useState("");
  const [apptFee, setApptFee] = useState("");

  const bookingFn = useServerFn(createBooking);

  const loadDoctors = useCallback(async () => {
    if (!clinic?.id) return;
    try {
      const { data } = await supabase
        .from("doctors")
        .select("id, name")
        .eq("clinic_id", clinic.id)
        .eq("is_active", true);
      const list = Array.isArray(data) && data.length > 0 ? data : [];
      if (list.length === 0 && clinic.doctor_name) {
        setDoctors([{ id: clinic.id, name: clinic.doctor_name }]);
        setApptDoctorId(clinic.id);
      } else {
        setDoctors(list);
        if (list[0]) setApptDoctorId(list[0].id);
      }
    } catch {
      if (clinic.doctor_name) {
        setDoctors([{ id: clinic.id, name: clinic.doctor_name }]);
        setApptDoctorId(clinic.id);
      }
    }
  }, [clinic?.id, clinic?.doctor_name]);

  useEffect(() => {
    if (addOpen) {
      loadDoctors();
      const now = new Date();
      now.setHours(now.getHours() + 1);
      now.setMinutes(now.getMinutes() > 30 ? 0 : 30, 0, 0);
      const offset = now.getTimezoneOffset();
      const local = new Date(now.getTime() - offset * 60 * 1000);
      setApptScheduledAt(local.toISOString().slice(0, 16));
      setApptFee(String(clinic?.consultation_fee ?? 500));
    }
  }, [addOpen, loadDoctors, clinic]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinic?.id) return;
    const cleanName = apptName.trim();
    const cleanPhone = apptPhone.trim();
    if (!cleanName || !cleanPhone) {
      toast.error("Please enter patient name and phone number");
      return;
    }
    setLoading(true);

    try {
      const scheduledDate = new Date(apptScheduledAt);
      const cleanAge = apptAge.trim() ? Math.min(130, Math.max(0, parseInt(apptAge.trim(), 10))) : null;
      const cleanDoctorId = apptDoctorId && apptDoctorId.trim().length === 36 ? apptDoctorId.trim() : null;
      const feeNum = apptFee ? Math.max(0, Number(apptFee) || 0) : (clinic?.consultation_fee ?? 500);

      // Check for duplicate booking on same day
      const startOfDay = new Date(scheduledDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(scheduledDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: existingAppt } = await supabase
        .from("appointments")
        .select("id, scheduled_at")
        .eq("clinic_id", clinic.id)
        .eq("patient_phone", cleanPhone)
        .gte("scheduled_at", startOfDay.toISOString())
        .lte("scheduled_at", endOfDay.toISOString())
        .neq("status", "cancelled")
        .maybeSingle();

      if (existingAppt) {
        const timeStr = existingAppt.scheduled_at ? new Date(existingAppt.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "an unspecified time";
        toast.error(`Patient already has an appointment today at ${timeStr}.`);
        setAddOpen(false);
        return;
      }

      // 1. Direct authenticated appointment creation
      const apptPayload = {
        clinic_id: clinic.id,
        organization_id: clinic.organization_id || null,
        patient_name: cleanName,
        patient_phone: cleanPhone,
        patient_email: apptEmail.trim() || null,
        patient_age: cleanAge && !isNaN(cleanAge) ? cleanAge : null,
        patient_gender: apptGender || null,
        problem: apptProblem.trim() || "Consultation appointment",
        scheduled_at: scheduledDate.toISOString(),
        appointment_type: apptType,
        status: "confirmed",
        source: "manual",
        doctor_id: cleanDoctorId,
        consultation_fee: feeNum,
      };

      const { data: createdAppt, error: insertErr } = await supabase
        .from("appointments")
        .insert(apptPayload as any)
        .select("id")
        .maybeSingle();

      if (insertErr) {
        // Fallback to serverFn if client RLS insert fails
        await bookingFn({
          data: {
            clinic_id: clinic.id,
            patient_name: cleanName,
            patient_phone: cleanPhone,
            patient_email: apptEmail.trim(),
            patient_age: cleanAge && !isNaN(cleanAge) ? cleanAge : null,
            patient_gender: apptGender || null,
            problem: apptProblem.trim() || "Consultation appointment",
            scheduled_at: scheduledDate.toISOString(),
            appointment_type: apptType,
            source: "booking",
            doctor_id: cleanDoctorId,
          },
        });
      }

      // 2. Ensure patient is upserted into clinic directory
      await supabase
        .from("patients" as any)
        .upsert(
          {
            clinic_id: clinic.id,
            organization_id: clinic.organization_id || null,
            name: cleanName,
            phone: cleanPhone,
            email: apptEmail.trim() || null,
            age: cleanAge && !isNaN(cleanAge) ? cleanAge : null,
            gender: apptGender || null,
            last_visit_at: scheduledDate.toISOString(),
          },
          { onConflict: "clinic_id,phone" },
        )
        .then(() => {}, () => {});

      const newApptId = createdAppt?.id;
      toast.success("✅ Appointment confirmed & added to queue!", {
        action: newApptId
          ? {
              label: "Start Consult",
              onClick: () => {
                window.location.href = `/dashboard/consult?appointmentId=${newApptId}`;
              },
            }
          : undefined,
      });
      setAddOpen(false);
      setApptName("");
      setApptPhone("");
      setApptEmail("");
      setApptAge("");
      setApptGender("");
      setApptProblem("");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to create appointment");
    } finally {
      setLoading(false);
    }
  };

  const load = useCallback(async () => {
    if (!clinic?.id) return;
    setLoading(true);
    try {
      // 1. Robust server-side fetch with service authority (bypasses client-side RLS hurdles)
      let apptRows: any[] | null = null;
      try {
        const serverData = await fetchAppointmentsFn({
          data: {
            clinic_id: clinic.id,
            organization_id: clinic.organization_id || null,
          },
        });
        if (Array.isArray(serverData)) {
          apptRows = serverData;
        }
      } catch (serverErr) {
        console.warn("[Appointments] ServerFn fetch notice, falling back to client query:", serverErr);
      }

      // Fallback to client query if server function is unavailable
      if (!apptRows) {
        let q = supabase
          .from("appointments")
          .select("*")
          .order("scheduled_at", { ascending: false });

        if (clinic.organization_id) {
          q = q.or(`clinic_id.eq.${clinic.id},organization_id.eq.${clinic.organization_id}`);
        } else {
          q = q.eq("clinic_id", clinic.id);
        }

        const { data: clientData, error } = await q;
        if (error) {
          console.error("[Appointments] Failed to load appointments via client:", error);
        }
        apptRows = clientData || [];
      }

      // 2. Fetch consultations so direct walk-in visits also show up in appointments
      const { data: consultData } = await supabase
        .from("consultations" as any)
        .select("*")
        .eq("clinic_id", clinic.id)
        .order("created_at", { ascending: false })
        .limit(100);

      const existingApptIds = new Set((apptRows ?? []).map((a: any) => a.id));
      const directConsults: Appt[] = [];

      ((consultData as any[]) ?? []).forEach((c) => {
        if (c.appointment_id && existingApptIds.has(c.appointment_id)) return;
        directConsults.push({
          id: c.id,
          patient_name: c.patient_name || "Walk-in Patient",
          patient_phone: c.patient_phone || "",
          patient_email: "",
          patient_age: null,
          patient_gender: null,
          problem: c.chief_complaint || c.diagnosis || "In-clinic Consultation",
          scheduled_at: c.created_at,
          status: "completed",
          appointment_type: "offline",
          doctor_id: c.doctor_id || null,
        });
      });

      // 3. Resolve doctor names safely without fragile embedded joins
      let docData: Array<{ id: string; name: string }> = [];
      try {
        const { data } = await supabase
          .from("doctors")
          .select("id, name")
          .eq("clinic_id", clinic.id);
        if (Array.isArray(data)) docData = data;
      } catch {}

      if (docData.length === 0 && clinic.doctor_name) {
        docData = [{ id: clinic.id, name: clinic.doctor_name }];
      }
      const docMap = new Map<string, string>(docData.map((d) => [d.id, d.name]));

      const combined = [...(apptRows ?? []), ...directConsults].sort(
        (a, b) => new Date(b.scheduled_at || 0).getTime() - new Date(a.scheduled_at || 0).getTime()
      );

      const apptList = combined.map((r: any) => ({
        ...r,
        doctors: r.doctor_id && docMap.has(r.doctor_id) ? { name: docMap.get(r.doctor_id)! } : (r.doctors ?? null),
      }));

      setRows(apptList as unknown as Appt[]);
    } catch (e) {
      console.error("Failed to load appointments:", e);
    } finally {
      setLoading(false);
    }
  }, [clinic?.id, clinic?.organization_id, fetchAppointmentsFn]);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time subscription: auto-refresh list when any appointment changes
  useEffect(() => {
    if (!clinic?.id) return () => {};
    const channel = supabase
      .channel(`appointments-${clinic.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `clinic_id=eq.${clinic.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinic?.id, load]);

  const [dateFilter, setDateFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchesName = (r.patient_name || "").toLowerCase().includes(q);
        const matchesPhone = r.patient_phone?.includes(q);
        if (!matchesName && !matchesPhone) return false;
      }
      if (typeFilter !== "all" && r.appointment_type !== typeFilter) return false;

      if (dateFilter !== "all" && r.scheduled_at) {
        const d = new Date(r.scheduled_at);
        if (isNaN(d.getTime())) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dateFilter === "today") {
          const end = new Date(today);
          end.setHours(23, 59, 59, 999);
          if (d < today || d > end) return false;
        } else if (dateFilter === "tomorrow") {
          const tomStart = new Date(today);
          tomStart.setDate(tomStart.getDate() + 1);
          const tomEnd = new Date(tomStart);
          tomEnd.setHours(23, 59, 59, 999);
          if (d < tomStart || d > tomEnd) return false;
        } else if (dateFilter === "week") {
          const weekEnd = new Date(today);
          weekEnd.setDate(weekEnd.getDate() + 7);
          if (d < today || d > weekEnd) return false;
        }
      }

      return true;
    });
  }, [rows, filter, search, typeFilter, dateFilter]);

  async function setStatus(
    id: string,
    status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show" | "waiting" | "serving",
  ) {
    setUpdating(id);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));

    try {
      await updateStatus({ data: { id, status } });
      if (status === "completed") {
        toast.success("✅ Appointment completed! Follow-up scheduled.", { duration: 4000 });
        setExpanded(null);
      } else if (status === "confirmed") {
        toast.success("Appointment confirmed! WhatsApp notification queued.");
      } else if (status === "waiting") {
        const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
        const orgId = clinic?.organization_id;
        if (orgId) {
          const { data: maxToken } = await supabase
            .from("queue_tokens")
            .select("token_number")
            .eq("organization_id", orgId)
            .eq("queue_date", todayStr)
            .order("token_number", { ascending: false })
            .limit(1)
            .maybeSingle();

          const nextTokenNum = (maxToken?.token_number ?? 0) + 1;
          const appt = rows.find((x) => x.id === id);

          await supabase.from("queue_tokens").insert({
            organization_id: orgId,
            queue_date: todayStr,
            token_number: nextTokenNum,
            appointment_id: id,
            patient_name: appt?.patient_name || "Patient",
            patient_phone: appt?.patient_phone || null,
            status: "waiting",
            priority: false,
            note: appt?.problem || null,
            doctor_id: appt?.doctor_id || null,
          });
        }
        toast.success("✅ Checked in! Patient added to Live OPD Queue.");
      } else if (status === "serving") {
        toast.success("🩺 Calling patient for consultation.");
      } else if (status === "cancelled") {
        toast.success("Appointment cancelled.");
      } else if (status === "no_show") {
        toast.info("Patient marked as No Show.");
      }
    } catch (error) {
      toast.error((error as Error).message);
      load();
    } finally {
      setUpdating(null);
    }
  }

  const counts = {
    all: rows.length,
    waiting: rows.filter((r) => r.status === "waiting").length,
    serving: rows.filter((r) => r.status === "serving" || r.status === "in_consultation").length,
    confirmed: rows.filter((r) => r.status === "confirmed").length,
    pending: rows.filter((r) => r.status === "pending").length,
    completed: rows.filter((r) => r.status === "completed").length,
    no_show: rows.filter((r) => r.status === "no_show").length,
    cancelled: rows.filter((r) => r.status === "cancelled").length,
  };

  const filterTabs = [
    { key: "all", label: "All Statuses", count: counts.all },
    { key: "waiting", label: "Waiting in OPD", count: counts.waiting },
    { key: "serving", label: "In Consult", count: counts.serving },
    { key: "confirmed", label: "Confirmed", count: counts.confirmed },
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "completed", label: "Completed", count: counts.completed },
    { key: "no_show", label: "No Show", count: counts.no_show },
    { key: "cancelled", label: "Cancelled", count: counts.cancelled },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Mobile-First Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-foreground">
            Appointments
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
            Confirm, complete, or check-in bookings directly to Live OPD Queue.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/dashboard/queue">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 px-3 text-xs font-semibold rounded-xl border-border/80 shrink-0"
            >
              <Clock className="size-3.5 text-primary" />
              <span>Live OPD Queue</span>
              {counts.waiting > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold">
                  {counts.waiting}
                </Badge>
              )}
            </Button>
          </Link>
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search patient or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs sm:text-sm rounded-xl"
            />
          </div>
          <Button
            onClick={() => setAddOpen(true)}
            size="sm"
            className="gap-1.5 h-9 px-3 text-xs font-semibold rounded-xl shadow-xs shrink-0"
          >
            <Plus className="size-4" /> <span className="hidden xs:inline">Add</span> Appt
          </Button>
        </div>
      </div>

      {/* Horizontal Scrollable Status Tabs (Native Pill Bar) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
        {filterTabs.map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 border ${
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                  : "bg-card hover:bg-muted/60 text-muted-foreground border-border/80"
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Secondary Quick Date & Type Filters */}
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {[
            { key: "all", label: "All Dates" },
            { key: "today", label: "Today" },
            { key: "tomorrow", label: "Tomorrow" },
            { key: "week", label: "7 Days" },
          ].map((d) => (
            <button
              key={d.key}
              onClick={() => setDateFilter(d.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                dateFilter === d.key
                  ? "bg-muted font-semibold text-foreground border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {[
            { key: "all", label: "All" },
            { key: "offline", label: "In-clinic" },
            { key: "online", label: "Video" },
          ].map((tp) => (
            <button
              key={tp.key}
              onClick={() => setTypeFilter(tp.key)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                typeFilter === tp.key
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Appointments List View / Native Cards */}
      {loading ? (
        <Card className="p-4">
          <SkeletonRows rows={6} cols={5} />
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center border-border/80">
          <EmptyState
            icon={<Search className="size-6" />}
            title="No appointments found"
            description={
              search ? `No appointments match "${search}"` : "No appointments scheduled for this selection."
            }
            action={
              <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 h-8 text-xs">
                <Plus className="size-3.5" /> Add Appointment
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const isExpanded = expanded === r.id;
            const isBusy = updating === r.id;
            const isOnline = r.appointment_type === "online";
            const apptDate = new Date(r.scheduled_at);
            const timeStr = apptDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            const dateStr = apptDate.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" });

            return (
              <Card
                key={r.id}
                className={`overflow-hidden border-border/80 shadow-xs transition-all ${
                  r.status === "completed" ? "opacity-75 bg-muted/10" : "bg-card"
                }`}
              >
                <div className="p-3.5 sm:p-4">
                  {/* Top Bar: Time, Type, Status */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs font-semibold text-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                        <Clock className="size-3 text-primary" />
                        <span>{timeStr}</span>
                        <span className="text-muted-foreground font-normal">({dateStr})</span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 font-medium ${
                          isOnline ? "border-purple-500/30 text-purple-600 bg-purple-50/50 dark:bg-purple-950/20" : "border-emerald-500/30 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20"
                        }`}
                      >
                        {isOnline ? <Video className="size-2.5 mr-1" /> : <MapPin className="size-2.5 mr-1" />}
                        {isOnline ? "Video" : "Clinic"}
                      </Badge>

                      {/* Source badge */}
                      {r.source === "website_widget" || r.source === "website" || r.source === "custom_website" ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 font-medium border-blue-500/30 text-blue-600 bg-blue-50/50 dark:bg-blue-950/20"
                        >
                          <Globe className="size-2.5 mr-1" />
                          Website
                        </Badge>
                      ) : r.source === "whatsapp" ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 font-medium border-emerald-500/30 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20"
                        >
                          <MessageCircle className="size-2.5 mr-1" />
                          WhatsApp
                        </Badge>
                      ) : r.source === "walkin" ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 font-medium border-amber-500/30 text-amber-600 bg-amber-50/50 dark:bg-amber-950/20"
                        >
                          <QrCode className="size-2.5 mr-1" />
                          Walk-in
                        </Badge>
                      ) : null}
                    </div>
                    <StatusBadge status={r.status} />
                  </div>

                  {/* Patient Info Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <AvatarInitials
                        name={
                          !r.patient_name || r.patient_name.startsWith("/")
                            ? "Patient"
                            : r.patient_name
                        }
                      />
                      <div className="min-w-0">
                        <h3 className="font-display font-bold text-sm text-foreground truncate">
                          {!r.patient_name || r.patient_name.startsWith("/")
                            ? "Patient"
                            : r.patient_name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {r.patient_phone && (
                            <a
                              href={`tel:${r.patient_phone}`}
                              className="hover:text-primary font-medium flex items-center gap-1"
                            >
                              <Phone className="size-3 text-emerald-600" />
                              {r.patient_phone}
                            </a>
                          )}
                          {(r.patient_age || r.patient_gender) && (
                            <span>
                              • {[r.patient_age && `${r.patient_age}y`, r.patient_gender].filter(Boolean).join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : r.id)}
                      className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted shrink-0"
                    >
                      {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </button>
                  </div>

                  {/* Problem snippet if present */}
                  {(() => {
                    const parsed = cleanProblemAndService(r.problem);
                    if (!parsed.displaySummary) return null;
                    return (
                      <div className="mt-2.5 text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border/50">
                        <span className="font-semibold text-foreground">
                          {parsed.service ? `${parsed.service}: ` : "Symptoms: "}
                        </span>
                        {parsed.problem || parsed.displaySummary}
                      </div>
                    );
                  })()}

                  {/* Quick Action Touch Bar */}
                  <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-border/60 flex-wrap">
                    {r.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => setStatus(r.id, "waiting")}
                          disabled={isBusy}
                          className="bg-primary text-primary-foreground font-semibold h-8 text-xs gap-1.5 flex-1 sm:flex-initial shadow-xs hover:bg-primary/90 rounded-xl"
                        >
                          {isBusy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <UserCheck className="size-3.5" />
                          )}
                          <span>{isBusy ? "Checking in…" : "✓ Confirm & Check-in"}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStatus(r.id, "confirmed")}
                          disabled={isBusy}
                          className="h-8 text-xs font-medium rounded-xl border-border/80"
                        >
                          Confirm Only
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStatus(r.id, "cancelled")}
                          disabled={isBusy}
                          className="h-8 text-xs text-destructive border-destructive/20 hover:bg-destructive/10 hover:border-destructive/30 px-3 font-medium rounded-xl"
                        >
                          <X className="size-3.5 mr-1" /> Cancel
                        </Button>
                      </>
                    )}

                    {r.status === "confirmed" && (
                      <>
                        <Link to="/dashboard/consult" search={{ appointmentId: r.id }} className="flex-1 sm:flex-initial">
                          <Button
                            size="sm"
                            onClick={() => {
                              void setStatus(r.id, "serving");
                            }}
                            className="w-full bg-primary text-primary-foreground font-semibold h-8 text-xs gap-1.5 shadow-xs rounded-xl hover:opacity-95"
                          >
                            <Stethoscope className="size-3.5" /> Start Consult
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStatus(r.id, "waiting")}
                          disabled={isBusy}
                          className="h-8 text-xs gap-1.5 font-medium rounded-xl border-border/80"
                        >
                          {isBusy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <UserCheck className="size-3.5" />
                          )}
                          <span>Check-in to Queue</span>
                        </Button>
                        {isOnline && (
                          <a href={`/consult/${r.id}`} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="secondary" className="h-8 text-xs gap-1 rounded-xl">
                              <Video className="size-3.5 text-purple-600" /> Call
                            </Button>
                          </a>
                        )}
                      </>
                    )}

                    {r.status === "waiting" && (
                      <>
                        <a href={`/dashboard/consult?appointmentId=${r.id}`} className="flex-1 sm:flex-initial">
                          <Button
                            size="sm"
                            onClick={() => setStatus(r.id, "serving")}
                            className="w-full bg-primary text-primary-foreground font-semibold h-8 text-xs gap-1.5 shadow-xs rounded-xl"
                          >
                            <Stethoscope className="size-3.5" /> ▶ Go to Consult
                          </Button>
                        </a>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStatus(r.id, "completed")}
                          disabled={isBusy}
                          className="h-8 text-xs gap-1 text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl"
                        >
                          <CheckCircle2 className="size-3.5" /> Done
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setStatus(r.id, "no_show")}
                          disabled={isBusy}
                          title="Mark No Show"
                          className="h-8 text-xs text-rose-600 hover:bg-rose-500/10 rounded-xl px-2"
                        >
                          <UserX className="size-3.5" />
                        </Button>
                      </>
                    )}

                    {r.status === "serving" && (
                      <>
                        <a href={`/dashboard/consult?appointmentId=${r.id}`} className="flex-1 sm:flex-initial">
                          <Button size="sm" className="w-full bg-primary text-primary-foreground font-semibold h-8 text-xs gap-1.5 shadow-xs rounded-xl">
                            <Stethoscope className="size-3.5" /> Resume Consult
                          </Button>
                        </a>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStatus(r.id, "completed")}
                          disabled={isBusy}
                          className="h-8 text-xs gap-1 text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl"
                        >
                          <CheckCircle2 className="size-3.5" /> Done
                        </Button>
                      </>
                    )}

                    {r.status === "completed" && (
                      <div className="flex items-center gap-2 w-full">
                        <a href="/dashboard/finance" className="flex-1">
                          <Button size="sm" variant="outline" className="w-full h-8 text-xs gap-1.5 text-emerald-600 border-emerald-500/20 rounded-xl">
                            <Receipt className="size-3.5" /> Invoice
                          </Button>
                        </a>
                        <a href="/dashboard/prescriptions" className="flex-1">
                          <Button size="sm" variant="outline" className="w-full h-8 text-xs gap-1.5 text-blue-600 border-blue-500/20 rounded-xl">
                            <FileText className="size-3.5" /> E-Prescription
                          </Button>
                        </a>
                      </div>
                    )}

                    {r.status === "no_show" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus(r.id, "waiting")}
                        disabled={isBusy}
                        className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground rounded-xl"
                      >
                        <UserCheck className="size-3.5" /> Re-checkin
                      </Button>
                    )}
                  </div>

                  {/* Collapsible Expanded Details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2 text-xs text-muted-foreground bg-muted/20 -mx-3.5 -mb-3.5 p-3.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <span className="font-semibold text-foreground">Doctor Assigned: </span>
                          {r.doctors?.name || clinic?.doctor_name || "Primary Doctor"}
                        </div>
                        {r.patient_email && (
                          <div>
                            <span className="font-semibold text-foreground">Email: </span>
                            <a href={`mailto:${r.patient_email}`} className="hover:underline">{r.patient_email}</a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Appointment Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-bold">Add Appointment</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-name">Patient Full Name</Label>
              <Input
                id="add-name"
                required
                value={apptName}
                onChange={(e) => setApptName(e.target.value)}
                placeholder="e.g. Vikram Singh"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="add-phone">Phone Number</Label>
                <Input
                  id="add-phone"
                  required
                  value={apptPhone}
                  onChange={(e) => setApptPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-email">Email Address (Optional)</Label>
                <Input
                  id="add-email"
                  type="email"
                  value={apptEmail}
                  onChange={(e) => setApptEmail(e.target.value)}
                  placeholder="e.g. patient@gmail.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="add-age">Age (Optional)</Label>
                <Input
                  id="add-age"
                  type="number"
                  value={apptAge}
                  onChange={(e) => setApptAge(e.target.value)}
                  placeholder="e.g. 28"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-gender">Gender (Optional)</Label>
                <select
                  id="add-gender"
                  value={apptGender}
                  onChange={(e) => setApptGender(e.target.value as any)}
                  className="w-full h-10 border rounded-md px-3 bg-background text-sm focus:outline-none"
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="add-datetime">Date & Time</Label>
                <Input
                  id="add-datetime"
                  type="datetime-local"
                  required
                  value={apptScheduledAt}
                  onChange={(e) => setApptScheduledAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-type">Type</Label>
                <select
                  id="add-type"
                  value={apptType}
                  onChange={(e) => setApptType(e.target.value as any)}
                  className="w-full h-10 border rounded-md px-3 bg-background text-sm focus:outline-none"
                >
                  <option value="offline">In-clinic (Offline)</option>
                  <option value="online">Video Consult (Online)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="add-doctor">Assign Doctor</Label>
                <select
                  id="add-doctor"
                  value={apptDoctorId}
                  onChange={(e) => setApptDoctorId(e.target.value)}
                  className="w-full h-10 border rounded-md px-3 bg-background text-sm focus:outline-none"
                >
                  {doctors.length === 0 ? (
                    <option value="">No active doctors</option>
                  ) : (
                    doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-fee">Fee (₹)</Label>
                <Input
                  id="add-fee"
                  type="number"
                  required
                  value={apptFee}
                  onChange={(e) => setApptFee(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-problem">Symptoms / Problem Description</Label>
              <textarea
                id="add-problem"
                value={apptProblem}
                onChange={(e) => setApptProblem(e.target.value)}
                rows={2}
                placeholder="e.g. Skin rash, dry cough, etc."
                className="w-full border rounded-md p-2 bg-background text-sm focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Book Slot</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
