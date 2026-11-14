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
  Calendar,
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
  ExternalLink,
  RefreshCw,
  Send,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { updateAppointmentStatus, createBooking, getClinicAppointments, getDashboardDoctors } from "@/lib/clinic.functions";
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
  notes?: string | null;
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
  const fetchDoctorsFn = useServerFn(getDashboardDoctors);
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
      const data = await fetchDoctorsFn({
        data: {
          clinic_id: clinic.id,
          organization_id: clinic.organization_id || null,
        },
      });
      const list = Array.isArray(data) ? data.filter((d: any) => d.is_active !== false) : [];
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
  }, [clinic?.id, clinic?.organization_id, clinic?.doctor_name, fetchDoctorsFn]);

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
        status: "pending",
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
          .order("created_at", { ascending: false });

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

      // 3. Resolve doctor names safely via server function (avoids client-side RLS 401 error)
      let docData: Array<{ id: string; name: string }> = [];
      try {
        const sDocs = await fetchDoctorsFn({
          data: {
            clinic_id: clinic.id,
            organization_id: clinic.organization_id || null,
          },
        });
        if (Array.isArray(sDocs)) docData = sDocs;
      } catch {}

      if (docData.length === 0 && clinic.doctor_name) {
        docData = [{ id: clinic.id, name: clinic.doctor_name }];
      }
      const docMap = new Map<string, string>(docData.map((d) => [d.id, d.name]));

      const combined = [...(apptRows ?? []), ...directConsults].sort(
        (a, b) => {
          // Sort newest bookings first so live website submissions appear immediately at the top
          const timeA = new Date(a.created_at || a.scheduled_at || 0).getTime();
          const timeB = new Date(b.created_at || b.scheduled_at || 0).getTime();
          return timeB - timeA;
        }
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
  }, [clinic?.id, clinic?.organization_id, clinic?.doctor_name, fetchAppointmentsFn, fetchDoctorsFn]);

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
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newAppt = payload.new as any;
            const patientName = newAppt?.patient_name || "New Patient";
            const tokenMatch = (newAppt?.notes || "").match(/OPD-\d+/) || (newAppt?.problem || "").match(/OPD-\d+/);
            const tokenStr = tokenMatch ? ` (${tokenMatch[0]})` : "";
            toast.success(`🔔 New Appointment: ${patientName}${tokenStr}`, {
              description: newAppt?.problem ? newAppt.problem.slice(0, 60) : "Booked via Website",
              duration: 8000,
            });
            try {
              const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
              audio.play().catch(() => {});
            } catch {}
          }
          load();
        },
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
        const q = search.toLowerCase().trim();
        const matchesName = (r.patient_name || "").toLowerCase().includes(q);
        const matchesPhone = (r.patient_phone || "").replace(/[^0-9]/g, "").includes(q.replace(/[^0-9]/g, ""));
        const tokenMatch = (r.notes || "").match(/OPD-\d+/i) || (r.problem || "").match(/OPD-\d+/i);
        const matchesToken = tokenMatch ? tokenMatch[0].toLowerCase().includes(q) : false;
        const matchesDoctor = (r.doctors?.name || "").toLowerCase().includes(q);
        const matchesProblem = (r.problem || "").toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesToken && !matchesDoctor && !matchesProblem) return false;
      }
      if (typeFilter !== "all" && r.appointment_type !== typeFilter) return false;

      if (dateFilter !== "all" && r.scheduled_at) {
        const d = new Date(r.scheduled_at);
        if (isNaN(d.getTime())) return false;
        const now = new Date();
        const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
        const dStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);

        if (dateFilter === "today") {
          if (dStr !== todayStr) return false;
        } else if (dateFilter === "tomorrow") {
          const tom = new Date(now);
          tom.setDate(tom.getDate() + 1);
          const tomStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(tom);
          if (dStr !== tomStr) return false;
        } else if (dateFilter === "week") {
          const weekEnd = new Date(now);
          weekEnd.setDate(weekEnd.getDate() + 7);
          const weekEndStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(weekEnd);
          if (dStr < todayStr || dStr > weekEndStr) return false;
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

  // Helper to extract clean complaint without redundant [OPD-XXX] token
  const cleanDisplayProblem = useCallback((problem: string | null | undefined) => {
    if (!problem) return "";
    const parsed = cleanProblemAndService(problem);
    const text = (parsed.problem || parsed.displaySummary || "").trim();
    return text.replace(/^\[?\s*OPD-\d+\s*\]?\s*[-:•]?\s*/i, "").trim();
  }, []);

  // Format date and time with smart labels (Today, Tomorrow, Date)
  const formatApptDate = useCallback((iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
      return { timeStr: "--:--", dateLabel: "Invalid date", isToday: false, isTomorrow: false };
    }
    const timeStr = d.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const now = new Date();
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(tomorrow);
    const targetDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);

    const isToday = targetDateStr === todayStr;
    const isTomorrow = targetDateStr === tomorrowStr;

    const dateLabel = isToday
      ? "Today"
      : isTomorrow
      ? "Tomorrow"
      : d.toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
          weekday: "short",
          day: "numeric",
          month: "short",
        });

    return { timeStr, dateLabel, isToday, isTomorrow };
  }, []);

  // WhatsApp 1-tap chat generator
  const getWhatsAppUrl = useCallback((phone: string, name: string, token: string | null) => {
    const cleanNum = phone.replace(/[^0-9]/g, "");
    const intlNum = cleanNum.startsWith("91") && cleanNum.length === 12
      ? cleanNum
      : cleanNum.length === 10
      ? `91${cleanNum}`
      : cleanNum;
    const msg = encodeURIComponent(
      `Hello ${name}, regarding your appointment${token ? ` (Token: ${token})` : ""} at ${clinic?.clinic_name || "the clinic"}: `
    );
    return `https://wa.me/${intlNum}?text=${msg}`;
  }, [clinic?.clinic_name]);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Top Mobile-First Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-foreground">
              Appointments
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
              {counts.all} total
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Real-time management for in-clinic visits, video consults, and custom website bookings.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/dashboard/queue">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 px-3 text-xs font-semibold rounded-xl border-border/80 hover:bg-muted/60 shrink-0"
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
          <Button
            onClick={() => setAddOpen(true)}
            size="sm"
            className="gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 shadow-xs shrink-0"
          >
            <Plus className="size-4" /> <span>Add Appointment</span>
          </Button>
        </div>
      </div>

      {/* KPI Metric Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => { setFilter("all"); setDateFilter("all"); }}
          className={`p-3 rounded-2xl border text-left transition-all ${
            filter === "all" && dateFilter === "all"
              ? "bg-card border-primary/40 ring-1 ring-primary/20 shadow-xs"
              : "bg-card hover:bg-muted/40 border-border/70"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Bookings</span>
            <CalendarCheck className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-bold font-display text-foreground">
            {counts.all}
          </div>
        </button>

        <button
          type="button"
          onClick={() => { setFilter("waiting"); }}
          className={`p-3 rounded-2xl border text-left transition-all ${
            filter === "waiting"
              ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-400/50 ring-1 ring-amber-400/20 shadow-xs"
              : "bg-card hover:bg-muted/40 border-border/70"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">In OPD Queue</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold font-display text-amber-700 dark:text-amber-400">
              {counts.waiting}
            </span>
            {counts.waiting > 0 && (
              <span className="inline-flex size-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => { setFilter("pending"); }}
          className={`p-3 rounded-2xl border text-left transition-all ${
            filter === "pending"
              ? "bg-blue-50/60 dark:bg-blue-950/20 border-blue-400/50 ring-1 ring-blue-400/20 shadow-xs"
              : "bg-card hover:bg-muted/40 border-border/70"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Pending Action</span>
            <UserCheck className="size-4 text-blue-500" />
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-bold font-display text-blue-700 dark:text-blue-400">
            {counts.pending}
          </div>
        </button>

        <button
          type="button"
          onClick={() => { setFilter("completed"); }}
          className={`p-3 rounded-2xl border text-left transition-all ${
            filter === "completed"
              ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-400/50 ring-1 ring-emerald-400/20 shadow-xs"
              : "bg-card hover:bg-muted/40 border-border/70"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Completed</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-bold font-display text-emerald-700 dark:text-emerald-400">
            {counts.completed}
          </div>
        </button>
      </div>

      {/* Unified Fast Search & Date Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search patient, phone, doctor, or token (OPD-XXX)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 h-9 text-xs sm:text-sm rounded-xl border-border/80 bg-card"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-xl border border-border/60">
            {[
              { key: "all", label: "All Dates" },
              { key: "today", label: "Today" },
              { key: "tomorrow", label: "Tomorrow" },
              { key: "week", label: "7 Days" },
            ].map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDateFilter(d.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  dateFilter === d.key
                    ? "bg-card text-foreground font-semibold shadow-2xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-xl border border-border/60">
            {[
              { key: "all", label: "All Types" },
              { key: "offline", label: "Clinic" },
              { key: "online", label: "Video" },
            ].map((tp) => (
              <button
                key={tp.key}
                type="button"
                onClick={() => setTypeFilter(tp.key)}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                  typeFilter === tp.key
                    ? "bg-card text-primary font-semibold shadow-2xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tp.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Status Pill Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
        {filterTabs.map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 border ${
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                  : "bg-card hover:bg-muted/60 text-muted-foreground border-border/70"
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

      {/* Appointments List / High Density Cards */}
      {loading ? (
        <Card className="p-4 rounded-2xl border-border/80">
          <SkeletonRows rows={6} cols={5} />
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center rounded-2xl border-border/80 bg-card">
          <EmptyState
            icon={<Search className="size-7 text-muted-foreground/60" />}
            title="No appointments found"
            description={
              search
                ? `No bookings match "${search}". Try adjusting your filters.`
                : "No appointments scheduled for this filter selection."
            }
            action={
              <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 h-8.5 text-xs rounded-xl">
                <Plus className="size-3.5" /> Add Appointment
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((r) => {
            const isExpanded = expanded === r.id;
            const isBusy = updating === r.id;
            const isOnline = r.appointment_type === "online";
            const { timeStr, dateLabel, isToday, isTomorrow } = formatApptDate(r.scheduled_at);
            const tokenMatch = (r.notes || "").match(/OPD-\d+/i) || (r.problem || "").match(/OPD-\d+/i);
            const tokenNumber = tokenMatch ? tokenMatch[0].toUpperCase() : null;
            const cleanComplaint = cleanDisplayProblem(r.problem);

            return (
              <Card
                key={r.id}
                className={`overflow-hidden border border-border/80 rounded-2xl transition-all duration-150 hover:border-primary/40 hover:shadow-xs ${
                  r.status === "completed" ? "bg-muted/15 opacity-85" : "bg-card"
                }`}
              >
                <div className="p-3.5 sm:p-4">
                  {/* Top Header Row on Mobile / Left Info Block on Desktop */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Left & Middle Container */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Avatar */}
                      <AvatarInitials
                        name={
                          !r.patient_name || r.patient_name.startsWith("/")
                            ? "Patient"
                            : r.patient_name
                        }
                      />

                      {/* Main Patient Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display font-bold text-sm sm:text-base text-foreground truncate">
                            {!r.patient_name || r.patient_name.startsWith("/")
                              ? "Patient"
                              : r.patient_name}
                          </h3>

                          {/* Token Badge */}
                          {tokenNumber && (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold px-1.5 py-0 shrink-0">
                              🎫 {tokenNumber}
                            </Badge>
                          )}

                          {/* Date and Time Chip */}
                          <div className="inline-flex items-center gap-1 text-[11px] font-medium bg-muted/60 px-2 py-0.5 rounded-lg border border-border/50 text-foreground shrink-0">
                            <Clock className="size-3 text-primary" />
                            <span className="font-semibold">{timeStr}</span>
                            <span
                              className={`text-[10px] px-1 py-0 rounded-md font-semibold ${
                                isToday
                                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                  : isTomorrow
                                  ? "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {dateLabel}
                            </span>
                          </div>

                          {/* Visit Modality Badge */}
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 font-medium shrink-0 ${
                              isOnline
                                ? "border-purple-500/30 text-purple-600 bg-purple-50/50 dark:bg-purple-950/20"
                                : "border-emerald-500/30 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20"
                            }`}
                          >
                            {isOnline ? <Video className="size-2.5 mr-1" /> : <MapPin className="size-2.5 mr-1" />}
                            {isOnline ? "Video" : "Clinic"}
                          </Badge>

                          {/* Source Badge */}
                          {r.source === "website_widget" || r.source === "website" || r.source === "custom_website" ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 font-medium border-blue-500/30 text-blue-600 bg-blue-50/50 dark:bg-blue-950/20 shrink-0"
                            >
                              <Globe className="size-2.5 mr-1" />
                              Website
                            </Badge>
                          ) : r.source === "whatsapp" ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 font-medium border-emerald-500/30 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 shrink-0"
                            >
                              <MessageCircle className="size-2.5 mr-1" />
                              WhatsApp
                            </Badge>
                          ) : r.source === "walkin" ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 font-medium border-amber-500/30 text-amber-600 bg-amber-50/50 dark:bg-amber-950/20 shrink-0"
                            >
                              <QrCode className="size-2.5 mr-1" />
                              Walk-in
                            </Badge>
                          ) : null}
                        </div>

                        {/* Contact details & 1-tap quick actions */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                          {r.patient_phone && (
                            <div className="flex items-center gap-1.5">
                              <a
                                href={`tel:${r.patient_phone}`}
                                title="Call patient"
                                className="inline-flex items-center gap-1 hover:text-primary font-medium text-foreground transition-colors"
                              >
                                <Phone className="size-3 text-emerald-600" />
                                <span>{r.patient_phone}</span>
                              </a>

                              <a
                                href={getWhatsAppUrl(r.patient_phone, r.patient_name || "Patient", tokenNumber)}
                                target="_blank"
                                rel="noreferrer"
                                title="Chat on WhatsApp"
                                className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 px-1.5 py-0.5 rounded-md transition-colors"
                              >
                                <MessageCircle className="size-3" />
                                <span>WhatsApp</span>
                              </a>
                            </div>
                          )}

                          {(r.patient_age || r.patient_gender) && (
                            <span>
                              • {[r.patient_age && `${r.patient_age}y`, r.patient_gender].filter(Boolean).join(", ")}
                            </span>
                          )}

                          {r.doctors?.name && (
                            <span className="hidden sm:inline text-muted-foreground">
                              • Dr. {r.doctors.name}
                            </span>
                          )}
                        </div>

                        {/* Symptoms / Clean Complaints Snippet */}
                        {cleanComplaint && (
                          <div className="mt-1.5 text-xs text-muted-foreground line-clamp-1 bg-muted/40 px-2 py-1 rounded-md border border-border/40 inline-block">
                            <span className="font-semibold text-foreground">Symptoms: </span>
                            {cleanComplaint}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Side: Status Badge + Compact Action Buttons */}
                    <div className="flex items-center justify-between md:justify-end gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/50">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={r.status} />

                        <button
                          type="button"
                          onClick={() => setExpanded(isExpanded ? null : r.id)}
                          className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/80 transition-colors"
                          title="Details"
                        >
                          {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>
                      </div>

                      {/* Contextual Action Buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {r.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => setStatus(r.id, "waiting")}
                              disabled={isBusy}
                              className="bg-primary text-primary-foreground font-semibold h-8 px-3 text-xs gap-1.5 rounded-xl shadow-xs hover:bg-primary/95"
                            >
                              {isBusy ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <UserCheck className="size-3.5" />
                              )}
                              <span>Check-in to Queue</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setStatus(r.id, "confirmed")}
                              disabled={isBusy}
                              className="h-8 px-2.5 text-xs font-medium rounded-xl border-border/80"
                            >
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setStatus(r.id, "cancelled")}
                              disabled={isBusy}
                              className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 rounded-xl"
                            >
                              <X className="size-3.5 mr-0.5" /> Cancel
                            </Button>
                          </>
                        )}

                        {r.status === "confirmed" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => setStatus(r.id, "waiting")}
                              disabled={isBusy}
                              className="bg-primary text-primary-foreground font-semibold h-8 px-3 text-xs gap-1.5 rounded-xl shadow-xs hover:bg-primary/95"
                            >
                              {isBusy ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <UserCheck className="size-3.5" />
                              )}
                              <span>Check-in to Queue</span>
                            </Button>
                            <Link to="/dashboard/consult" search={{ appointmentId: r.id }}>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  void setStatus(r.id, "serving");
                                }}
                                className="font-medium h-8 px-2.5 text-xs gap-1.5 rounded-xl border-border/80"
                              >
                                <Stethoscope className="size-3.5" /> Start Consult
                              </Button>
                            </Link>
                            {isOnline && (
                              <a href={`/consult/${r.id}`} target="_blank" rel="noreferrer">
                                <Button size="sm" variant="secondary" className="h-8 px-2.5 text-xs gap-1 rounded-xl">
                                  <Video className="size-3.5 text-purple-600" /> Video
                                </Button>
                              </a>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setStatus(r.id, "cancelled")}
                              disabled={isBusy}
                              className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 rounded-xl"
                            >
                              <X className="size-3.5 mr-0.5" /> Cancel
                            </Button>
                          </>
                        )}

                        {r.status === "waiting" && (
                          <>
                            <a href={`/dashboard/consult?appointmentId=${r.id}`}>
                              <Button
                                size="sm"
                                onClick={() => setStatus(r.id, "serving")}
                                className="bg-primary text-primary-foreground font-semibold h-8 px-3 text-xs gap-1.5 rounded-xl shadow-xs hover:bg-primary/95"
                              >
                                <Stethoscope className="size-3.5" /> ▶ Consult Now
                              </Button>
                            </a>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setStatus(r.id, "completed")}
                              disabled={isBusy}
                              className="h-8 px-2.5 text-xs gap-1 text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl"
                            >
                              <CheckCircle2 className="size-3.5" /> Done
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setStatus(r.id, "no_show")}
                              disabled={isBusy}
                              title="Mark No Show"
                              className="h-8 px-2 text-xs text-rose-600 hover:bg-rose-500/10 rounded-xl"
                            >
                              <UserX className="size-3.5" />
                            </Button>
                          </>
                        )}

                        {r.status === "serving" && (
                          <>
                            <a href={`/dashboard/consult?appointmentId=${r.id}`}>
                              <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white font-semibold h-8 px-3 text-xs gap-1.5 rounded-xl shadow-xs">
                                <Stethoscope className="size-3.5 animate-pulse" /> Resume Consult
                              </Button>
                            </a>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setStatus(r.id, "completed")}
                              disabled={isBusy}
                              className="h-8 px-2.5 text-xs gap-1 text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl"
                            >
                              <CheckCircle2 className="size-3.5" /> Done
                            </Button>
                          </>
                        )}

                        {r.status === "completed" && (
                          <div className="flex items-center gap-1.5">
                            <a href="/dashboard/finance">
                              <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs gap-1 text-emerald-600 border-emerald-500/25 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-xl">
                                <Receipt className="size-3.5" /> Invoice
                              </Button>
                            </a>
                            <a href="/dashboard/prescriptions">
                              <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs gap-1 text-blue-600 border-blue-500/25 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-xl">
                                <FileText className="size-3.5" /> E-Prescription
                              </Button>
                            </a>
                          </div>
                        )}

                        {(r.status === "no_show" || r.status === "cancelled") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatus(r.id, "waiting")}
                            disabled={isBusy}
                            className="h-8 px-2.5 text-xs gap-1 text-muted-foreground hover:text-foreground rounded-xl"
                          >
                            <UserCheck className="size-3.5" /> Re-checkin
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Expanded Details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground bg-muted/20 -mx-3.5 -mb-3.5 p-3.5 rounded-b-2xl">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
                        <div>
                          <span className="font-semibold text-foreground">Booking ID: </span>
                          <span className="font-mono text-[11px]">{r.id.slice(0, 13)}…</span>
                        </div>
                      </div>
                      {r.notes && (
                        <div className="mt-2 text-muted-foreground">
                          <span className="font-semibold text-foreground">Internal Notes: </span>
                          {r.notes}
                        </div>
                      )}
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
