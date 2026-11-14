import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardDoctors } from "@/lib/clinic.functions";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useOrganization } from "@/hooks/useOrganization";
import { useClinic } from "./dashboard";
import { supabase } from "@/integrations/supabase/client";
import { safeUpsertPatient } from "@/lib/patient-upsert";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { AppGuard } from "@/components/app/AppGuard";
import {
  Monitor,
  Plus,
  Stethoscope,
  Clock,
  Calendar,
  CheckCircle2,
  Sparkles,
  PhoneCall,
  Search,
  ListOrdered,
  Phone,
  UserCheck,
  Check,
  MessageSquare,
  AlertTriangle,
  UserX,
  Volume2,
  VolumeX,
  Share2,
  Printer,
  Flame,
  ArrowRight,
  User,
  RotateCcw,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/queue")({
  component: () => (
    <AppGuard appKey="consultation">
      <QueuePage />
    </AppGuard>
  ),
});

export type QueueItemStatus = "waiting" | "serving" | "completed" | "no_show" | "emergency" | "confirmed" | "cancelled";

export type QueueItem = {
  id: string;
  source: "token" | "appointment";
  token_number: number;
  appointment_id?: string | null;
  patient_id?: string | null;
  patient_name: string;
  patient_phone: string | null;
  patient_age?: number | null;
  patient_gender?: string | null;
  status: QueueItemStatus;
  priority: boolean;
  problem?: string | null;
  doctor_id?: string | null;
  doctor_name?: string | null;
  scheduled_at?: string;
  created_at: string;
  called_at?: string | null;
  completed_at?: string | null;
};

type PatientOpt = { id: string; name: string; phone: string | null };
type DoctorOpt = { id: string; name: string };

const STATUS_CONFIG: Record<
  QueueItemStatus,
  { label: string; color: string; badgeVariant: "default" | "secondary" | "outline" | "destructive" }
> = {
  emergency: {
    label: "Emergency Call-in",
    color: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/40 font-bold animate-pulse",
    badgeVariant: "destructive",
  },
  waiting: {
    label: "Waiting in OPD",
    color: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    badgeVariant: "outline",
  },
  serving: {
    label: "In Consultation",
    color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 font-semibold",
    badgeVariant: "default",
  },
  completed: {
    label: "Completed",
    color: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/20",
    badgeVariant: "secondary",
  },
  no_show: {
    label: "No Show",
    color: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
    badgeVariant: "outline",
  },
  confirmed: {
    label: "Upcoming (Booked)",
    color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
    badgeVariant: "outline",
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-muted text-muted-foreground border-border",
    badgeVariant: "outline",
  },
};

const COMMON_SYMPTOMS = [
  "Fever / Flu",
  "Cough & Cold",
  "Headache / Migraine",
  "Stomach Pain / Acidity",
  "BP & Sugar Review",
  "Joint & Back Pain",
  "Skin Rash / Allergy",
  "Routine Check-up",
];

function today(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  } catch {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}

// Pleasant chime for calling patients
function playCallChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now); // E5
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(523.25, now + 0.22); // C5
    gain2.gain.setValueAtTime(0.3, now + 0.22);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.22);
    osc2.stop(now + 0.8);
  } catch (e) {
    console.debug("AudioContext error", e);
  }
}

// Speech announcement
function announcePatient(tokenNum: number, name: string) {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`Token number ${tokenNum}, ${name}, please proceed to consultation.`);
      utterance.rate = 0.95;
      utterance.lang = "en-IN";
      window.speechSynthesis.speak(utterance);
    } catch {
      // ignore
    }
  }
}

export function QueuePage() {
  const { org } = useOrganization();
  const clinic = useClinic();
  const navigate = useNavigate();
  const orgId = org?.id || clinic?.organization_id;
  const clinicId = clinic?.id;

  const [queueList, setQueueList] = useState<QueueItem[]>([]);
  const [patients, setPatients] = useState<PatientOpt[]>([]);
  const [doctors, setDoctors] = useState<DoctorOpt[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [rapidOpen, setRapidOpen] = useState(false);
  const [board, setBoard] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "waiting" | "serving" | "emergency" | "completed" | "no_show">("all");
  const [search, setSearch] = useState("");
  const [issuedSlip, setIssuedSlip] = useState<{ tokenNumber: number; patientName: string; waitEst: string; phone: string | null } | null>(null);
  const fetchDoctorsFn = useServerFn(getDashboardDoctors);

  const date = today();

  const load = useCallback(async () => {
    if (!orgId && !clinicId) return;
    setLoading(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const [tokenRes, apptRes, patientRes, docRes] = await Promise.all([
        supabase
          .from("queue_tokens")
          .select("*")
          .eq("queue_date", date)
          .order("token_number", { ascending: true })
          .then((res) => (res.error ? { data: [] } : res), () => ({ data: [] })),
        clinicId
          ? supabase
              .from("appointments")
              .select("*")
              .eq("clinic_id", clinicId)
              .gte("scheduled_at", todayStart.toISOString())
              .lte("scheduled_at", todayEnd.toISOString())
              .order("scheduled_at", { ascending: true })
              .then((res) => (res.error ? { data: [] } : res), () => ({ data: [] }))
          : Promise.resolve({ data: [] }),
        orgId
          ? supabase
              .from("patients")
              .select("id, name, phone")
              .eq("organization_id", orgId)
              .order("name")
              .then((res) => (res.error ? { data: [] } : res), () => ({ data: [] }))
          : Promise.resolve({ data: [] }),
        clinicId
          ? fetchDoctorsFn({ data: { clinic_id: clinicId, organization_id: orgId || null } })
              .then((d) => ({
                data: (d || [])
                  .filter((x: any) => x.is_active !== false)
                  .map((x: any) => ({ id: x.id, name: x.name })),
              }))
              .catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
      ]);

      const doctorMap = new Map<string, string>(((docRes.data as any[]) ?? []).map((d) => [d.id, d.name]));
      if (typeof setDoctors === "function") {
        setDoctors((docRes.data as any[]) ?? []);
      }

      const tokenItems: QueueItem[] = ((tokenRes.data as any[]) ?? []).map((t) => {
        let normalizedStatus: QueueItemStatus = "waiting";
        if (t.status === "completed" || t.status === "done") normalizedStatus = "completed";
        else if (t.status === "no_show" || t.status === "skipped") normalizedStatus = "no_show";
        else if (t.status === "serving" || t.status === "in_consultation") normalizedStatus = "serving";
        else if (t.status === "emergency" || t.priority) normalizedStatus = "emergency";
        else if (t.status === "cancelled") normalizedStatus = "cancelled";
        else normalizedStatus = "waiting";

        return {
          id: t.id,
          source: "token",
          token_number: t.token_number || 1,
          appointment_id: t.appointment_id,
          patient_id: t.patient_id,
          patient_name: t.patient_name,
          patient_phone: t.patient_phone,
          status: normalizedStatus,
          priority: Boolean(t.priority) || normalizedStatus === "emergency",
          problem: t.note,
          doctor_id: t.doctor_id,
          doctor_name: t.doctor_id ? doctorMap.get(t.doctor_id) ?? null : null,
          created_at: t.created_at || new Date().toISOString(),
          called_at: t.called_at,
          completed_at: t.completed_at,
        };
      });

      const apptItems: QueueItem[] = ((apptRes.data as any[]) ?? []).map((a, idx) => {
        let mappedStatus: QueueItemStatus = "confirmed";
        if (a.status === "completed") mappedStatus = "completed";
        else if (a.status === "cancelled") mappedStatus = "cancelled";
        else if (a.status === "no_show") mappedStatus = "no_show";
        else if (a.status === "waiting") mappedStatus = "waiting";
        else if (a.status === "serving" || a.status === "in_consultation") mappedStatus = "serving";
        else mappedStatus = "confirmed";

        return {
          id: `appt-${a.id}`,
          source: "appointment",
          appointment_id: a.id,
          token_number: idx + 1,
          patient_name: a.patient_name,
          patient_phone: a.patient_phone,
          patient_age: a.patient_age,
          patient_gender: a.patient_gender,
          status: mappedStatus,
          priority: false,
          problem: a.problem,
          doctor_id: a.doctor_id,
          doctor_name: a.doctor_id ? doctorMap.get(a.doctor_id) ?? null : null,
          scheduled_at: a.scheduled_at,
          created_at: a.created_at || a.scheduled_at,
        };
      });

      // Merge and deduplicate by appointment_id or phone match
      const unified: QueueItem[] = [...tokenItems];
      const tokenApptIds = new Set(tokenItems.map((t) => t.appointment_id).filter(Boolean));

      for (const appt of apptItems) {
        if (appt.appointment_id && tokenApptIds.has(appt.appointment_id)) {
          // Already represented by queue_token
          continue;
        }
        const phoneMatch = unified.find(
          (u) =>
            u.patient_phone &&
            appt.patient_phone &&
            u.patient_phone.replace(/\D/g, "") === appt.patient_phone.replace(/\D/g, "")
        );
        if (!phoneMatch) {
          unified.push(appt);
        }
      }

      // Sort: Emergency first, then Serving, then Waiting by priority/token, then Confirmed, then Completed/No-Show
      unified.sort((a, b) => {
        const getWeight = (item: QueueItem) => {
          if (item.status === "emergency") return 1;
          if (item.status === "serving") return 2;
          if (item.status === "waiting") return 3;
          if (item.status === "confirmed") return 4;
          if (item.status === "no_show") return 5;
          return 6;
        };
        const weightA = getWeight(a);
        const weightB = getWeight(b);
        if (weightA !== weightB) return weightA - weightB;
        return (a.token_number || 0) - (b.token_number || 0);
      });

      setQueueList(unified);
      setPatients((patientRes.data as any[]) ?? []);
    } catch (err) {
      console.error("Queue load error:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId, clinicId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  // Real-time Supabase subscription
  useEffect(() => {
    if (!orgId && !clinicId) return;
    const channel = supabase
      .channel(`opd-queue-${clinicId || orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_tokens" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => void load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, clinicId, load]);

  // Filtered by doctor if selected
  const doctorFilteredQueue = useMemo(() => {
    if (selectedDoctorId === "all") return queueList;
    return queueList.filter((item) => !item.doctor_id || item.doctor_id === selectedDoctorId);
  }, [queueList, selectedDoctorId]);

  // Derived categorized lists
  const emergencyList = useMemo(
    () => doctorFilteredQueue.filter((t) => t.status === "emergency"),
    [doctorFilteredQueue]
  );
  const waitingList = useMemo(
    () => doctorFilteredQueue.filter((t) => t.status === "waiting" || t.status === "emergency"),
    [doctorFilteredQueue]
  );
  const servingItem = useMemo(
    () => doctorFilteredQueue.find((t) => t.status === "serving") ?? null,
    [doctorFilteredQueue]
  );
  const confirmedList = useMemo(
    () => doctorFilteredQueue.filter((t) => t.status === "confirmed"),
    [doctorFilteredQueue]
  );
  const completedList = useMemo(
    () => doctorFilteredQueue.filter((t) => t.status === "completed"),
    [doctorFilteredQueue]
  );
  const noShowList = useMemo(
    () => doctorFilteredQueue.filter((t) => t.status === "no_show"),
    [doctorFilteredQueue]
  );

  // Next candidate in line (Emergency first, then waiting)
  const nextInLine = useMemo(() => {
    if (emergencyList.length > 0) return emergencyList[0];
    const normalWaiting = doctorFilteredQueue.filter((t) => t.status === "waiting");
    if (normalWaiting.length > 0) return normalWaiting[0];
    if (confirmedList.length > 0) return confirmedList[0];
    return null;
  }, [emergencyList, doctorFilteredQueue, confirmedList]);

  // Wait time estimate formula (~12 mins avg per consult)
  const calculateWaitTime = useCallback(
    (item: QueueItem): string => {
      if (item.status === "serving") return "In Doctor Room";
      if (item.status === "emergency") return "Next Immediately (Emergency)";
      if (item.status === "completed") return "Completed";
      if (item.status === "no_show") return "Missed";

      const waitingAhead = waitingList.filter(
        (w) => w.status !== "serving" && (w.priority || w.token_number < item.token_number)
      ).length;

      if (waitingAhead === 0) return "< 5 mins (Next)";
      const mins = waitingAhead * 12;
      if (mins < 60) return `~${mins} mins`;
      const hrs = Math.floor(mins / 60);
      const rem = mins % 60;
      return `~${hrs}h ${rem > 0 ? `${rem}m` : ""}`;
    },
    [waitingList]
  );

  // Filtered view by tab & search query
  const filteredList = useMemo(() => {
    let list = doctorFilteredQueue;
    if (activeTab === "emergency") list = list.filter((i) => i.status === "emergency" || i.priority);
    else if (activeTab === "waiting") list = list.filter((i) => i.status === "waiting" || i.status === "emergency");
    else if (activeTab === "serving") list = list.filter((i) => i.status === "serving");
    else if (activeTab === "completed") list = list.filter((i) => i.status === "completed");
    else if (activeTab === "no_show") list = list.filter((i) => i.status === "no_show");

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.patient_name.toLowerCase().includes(q) ||
          (item.patient_phone ?? "").includes(q) ||
          (item.problem ?? "").toLowerCase().includes(q) ||
          String(item.token_number).includes(q)
      );
    }
    return list;
  }, [doctorFilteredQueue, activeTab, search]);

  // Transition to consultation
  const handleStartConsult = async (item: QueueItem) => {
    try {
      let targetApptId = item.appointment_id;

      // If it's a walk-in token without an appointment_id, create the appointment row now
      if (!targetApptId && clinicId) {
        const { data: newAppt, error: apptErr } = await supabase
          .from("appointments")
          .insert({
            clinic_id: clinicId,
            organization_id: orgId || null,
            patient_name: item.patient_name,
            patient_phone: item.patient_phone,
            patient_age: item.patient_age ?? null,
            patient_gender: item.patient_gender ?? null,
            problem: item.problem || "Walk-in OPD Consultation",
            scheduled_at: new Date().toISOString(),
            appointment_type: "offline",
            status: "serving",
            source: "walkin",
            doctor_id: item.doctor_id || (doctors[0]?.id ?? null),
            consultation_fee: clinic?.consultation_fee ?? 500,
          } as any)
          .select("id")
          .maybeSingle();

        if (apptErr) throw apptErr;
        targetApptId = newAppt?.id;

        // Link back to queue_tokens
        if (item.source === "token") {
          await supabase
            .from("queue_tokens")
            .update({ appointment_id: targetApptId, status: "serving", called_at: new Date().toISOString() })
            .eq("id", item.id);
        }
      } else {
        // Mark both appointment & token as serving
        if (targetApptId) {
          await supabase
            .from("appointments")
            .update({ status: "serving" } as any)
            .eq("id", targetApptId);
        }
        if (item.source === "token") {
          await supabase
            .from("queue_tokens")
            .update({ status: "serving", called_at: new Date().toISOString() })
            .eq("id", item.id);
        }
      }

      if (soundEnabled) {
        playCallChime();
        announcePatient(item.token_number, item.patient_name);
      }

      toast.success(`🩺 Calling Token #${item.token_number} (${item.patient_name})`);

      // Seamless navigation to Doctor Consultation Cockpit
      if (targetApptId) {
        navigate({
          to: "/dashboard/consult",
          search: { appointmentId: targetApptId },
        });
      } else {
        navigate({
          to: "/dashboard/consult",
          search: { new: true },
        });
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to start consultation");
    }
  };

  // 1-Click Call Next Patient
  const handleCallNext = async () => {
    if (!nextInLine) {
      return toast.info("No patients waiting in queue.");
    }
    await handleStartConsult(nextInLine);
  };

  // Check in confirmed appointment
  const handleCheckIn = async (item: QueueItem) => {
    try {
      if (item.source === "appointment" && item.appointment_id) {
        await supabase
          .from("appointments")
          .update({ status: "waiting" } as any)
          .eq("id", item.appointment_id);

        if (orgId) {
          const { data: maxToken } = await supabase
            .from("queue_tokens")
            .select("token_number")
            .eq("organization_id", orgId)
            .eq("queue_date", date)
            .order("token_number", { ascending: false })
            .limit(1)
            .maybeSingle();

          const nextTokenNum = (maxToken?.token_number ?? 0) + 1;

          await supabase.from("queue_tokens").insert({
            organization_id: orgId,
            queue_date: date,
            token_number: nextTokenNum,
            appointment_id: item.appointment_id,
            patient_name: item.patient_name,
            patient_phone: item.patient_phone,
            status: "waiting",
            priority: false,
            note: item.problem || null,
            doctor_id: item.doctor_id || null,
          });
        }
      }
      toast.success(`✅ ${item.patient_name} checked in! Added to live OPD queue.`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to check in");
    }
  };

  // Mark Completed
  const handleMarkDone = async (item: QueueItem) => {
    try {
      if (item.appointment_id) {
        await supabase
          .from("appointments")
          .update({ status: "completed" } as any)
          .eq("id", item.appointment_id);
      }
      if (item.source === "token") {
        await supabase
          .from("queue_tokens")
          .update({ status: "done", completed_at: new Date().toISOString() })
          .eq("id", item.id);
      }
      toast.success(`Consultation completed for ${item.patient_name}`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to complete");
    }
  };

  // Mark No-Show
  const handleMarkNoShow = async (item: QueueItem) => {
    try {
      if (item.appointment_id) {
        await supabase
          .from("appointments")
          .update({ status: "no_show" } as any)
          .eq("id", item.appointment_id);
      }
      if (item.source === "token") {
        await supabase
          .from("queue_tokens")
          .update({ status: "skipped", completed_at: new Date().toISOString() })
          .eq("id", item.id);
      }
      toast.info(`${item.patient_name} marked as No-Show`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to update status");
    }
  };

  // Emergency Call-in (Bump to top with priority)
  const handleEmergencyCallIn = async (item: QueueItem) => {
    try {
      if (item.source === "token") {
        await supabase
          .from("queue_tokens")
          .update({ status: "emergency", priority: true })
          .eq("id", item.id);
      }
      if (item.appointment_id) {
        await supabase
          .from("appointments")
          .update({ status: "waiting" } as any)
          .eq("id", item.appointment_id);
      }
      toast.error(`🚨 ${item.patient_name} tagged as Emergency Call-in (Moved to front of queue)`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to flag emergency");
    }
  };

  // Re-queue patient (e.g. from No-Show back to Waiting)
  const handleRequeue = async (item: QueueItem) => {
    try {
      if (item.source === "token") {
        await supabase
          .from("queue_tokens")
          .update({ status: "waiting", priority: false })
          .eq("id", item.id);
      }
      if (item.appointment_id) {
        await supabase
          .from("appointments")
          .update({ status: "waiting" } as any)
          .eq("id", item.appointment_id);
      }
      toast.success(`${item.patient_name} returned to waiting queue`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to re-queue");
    }
  };

  // TV / Monitor Reception Board View
  if (board) {
    return (
      <BoardView
        serving={
          servingItem
            ? {
                token_number: servingItem.token_number,
                patient_name: servingItem.patient_name,
                doctor_name: servingItem.doctor_name || clinic?.doctor_name || "Doctor",
              }
            : null
        }
        waiting={waitingList.map((w) => ({
          token_number: w.token_number,
          patient_name: w.patient_name,
          priority: w.priority || w.status === "emergency",
        }))}
        clinicName={clinic?.clinic_name || "ClinicX OPD"}
        onExit={() => setBoard(false)}
      />
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-foreground">
              Live OPD Queue
            </h1>
            <Badge variant="outline" className="text-[11px] bg-primary/10 text-primary border-primary/20 font-bold px-2 py-0.5">
              {new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric", weekday: "short" })}
            </Badge>
            {emergencyList.length > 0 && (
              <Badge variant="destructive" className="text-[10px] font-bold animate-pulse px-2 py-0.5">
                <Flame className="size-3 mr-1" /> {emergencyList.length} Emergency Triage
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate hidden sm:block mt-0.5">
            Real-time OPD patient flow: Waiting ➔ Call Next ➔ In Consult ➔ Completed.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Doctor filter dropdown if multiple doctors exist */}
          {doctors.length > 1 && (
            <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
              <SelectTrigger className="h-8 text-xs w-[140px] rounded-xl bg-card">
                <SelectValue placeholder="All Doctors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Doctors</SelectItem>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Sound toggle button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? "Chime enabled" : "Muted"}
            className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground"
          >
            {soundEnabled ? <Volume2 className="size-4 text-primary" /> : <VolumeX className="size-4" />}
          </Button>

          {/* TV Reception Board */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBoard(true)}
            className="h-8 text-xs px-2.5 gap-1.5 rounded-xl border-border/80"
          >
            <Monitor className="size-3.5 text-primary" /> <span className="hidden xs:inline">TV Board</span>
          </Button>

          {/* Rapid Walk-in Register */}
          <Button
            size="sm"
            onClick={() => setRapidOpen(true)}
            className="h-8 text-xs px-3 gap-1.5 font-bold rounded-xl shadow-xs bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Zap className="size-3.5 fill-current" /> Rapid Walk-in
          </Button>
        </div>
      </div>

      {/* Top 1-Click Call Next Patient Action Card */}
      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/[0.08] via-background to-card shadow-sm p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left Column: Currently Serving */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="size-12 sm:size-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 grid place-items-center font-mono font-black text-lg sm:text-xl shrink-0 shadow-xs">
              {servingItem ? `#${servingItem.token_number}` : "—"}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <span className="size-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                Currently Serving
              </div>
              <h2 className="text-base sm:text-lg font-bold text-foreground truncate">
                {servingItem ? servingItem.patient_name : "Consultation Room Idle"}
              </h2>
              <div className="text-xs text-muted-foreground truncate">
                {servingItem ? (
                  <span>
                    {servingItem.problem || "Routine Consultation"}
                    {servingItem.doctor_name && ` · Dr. ${servingItem.doctor_name}`}
                  </span>
                ) : (
                  "Ready for next patient call"
                )}
              </div>
            </div>
          </div>

          {/* Middle: Next in line preview */}
          {nextInLine && (
            <div className="bg-card/70 border border-border/80 rounded-2xl p-3 px-4 min-w-[200px] flex items-center gap-3">
              <div className="size-9 rounded-xl bg-primary/10 border border-primary/20 text-primary font-mono font-bold grid place-items-center text-sm shrink-0">
                #{nextInLine.token_number}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                  <Sparkles className="size-3 text-amber-500" /> Up Next
                </div>
                <div className="text-xs sm:text-sm font-bold text-foreground truncate">
                  {nextInLine.patient_name}
                </div>
                <div className="text-[11px] text-primary font-medium">
                  {calculateWaitTime(nextInLine)}
                </div>
              </div>
            </div>
          )}

          {/* Right Action: 1-Click Call Next Patient button */}
          <div className="flex items-center gap-2 shrink-0">
            {servingItem && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStartConsult(servingItem)}
                className="h-10 px-3.5 rounded-xl text-xs font-semibold gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
              >
                <Stethoscope className="size-4" /> Resume Consult
              </Button>
            )}

            <Button
              size="lg"
              onClick={handleCallNext}
              disabled={!nextInLine}
              className="h-11 px-5 rounded-xl font-bold text-xs sm:text-sm gap-2 shadow-md bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <PhoneCall className="size-4" />
              <span>Call Next Patient</span>
              {nextInLine && (
                <span className="bg-primary-foreground/20 px-2 py-0.5 rounded-lg text-xs font-mono">
                  #{nextInLine.token_number}
                </span>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Streamlined Stats Counters Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div
          onClick={() => setActiveTab("waiting")}
          className={`p-2.5 rounded-2xl bg-card border cursor-pointer transition-all ${
            activeTab === "waiting" ? "border-amber-500 bg-amber-500/5 shadow-xs" : "border-border/70 hover:border-border"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Waiting</span>
            <Clock className="size-3.5 text-amber-500" />
          </div>
          <div className="text-lg font-bold text-foreground mt-0.5">
            {waitingList.length} <span className="text-xs text-muted-foreground font-normal">in OPD</span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab("serving")}
          className={`p-2.5 rounded-2xl bg-card border cursor-pointer transition-all ${
            activeTab === "serving" ? "border-emerald-500 bg-emerald-500/5 shadow-xs" : "border-border/70 hover:border-border"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Serving</span>
            <Stethoscope className="size-3.5 text-emerald-500" />
          </div>
          <div className="text-lg font-bold text-foreground mt-0.5">
            {servingItem ? 1 : 0} <span className="text-xs text-muted-foreground font-normal">active</span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab("emergency")}
          className={`p-2.5 rounded-2xl bg-card border cursor-pointer transition-all ${
            activeTab === "emergency" ? "border-red-500 bg-red-500/5 shadow-xs" : "border-border/70 hover:border-border"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-red-600 uppercase font-bold tracking-wider">Emergency</span>
            <Flame className="size-3.5 text-red-500" />
          </div>
          <div className="text-lg font-bold text-red-600 mt-0.5">
            {emergencyList.length} <span className="text-xs text-muted-foreground font-normal">triage</span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab("completed")}
          className={`p-2.5 rounded-2xl bg-card border cursor-pointer transition-all ${
            activeTab === "completed" ? "border-primary bg-primary/5 shadow-xs" : "border-border/70 hover:border-border"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Completed</span>
            <CheckCircle2 className="size-3.5 text-primary" />
          </div>
          <div className="text-lg font-bold text-foreground mt-0.5">
            {completedList.length} <span className="text-xs text-muted-foreground font-normal">done</span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab("no_show")}
          className={`p-2.5 rounded-2xl bg-card border cursor-pointer transition-all ${
            activeTab === "no_show" ? "border-rose-500 bg-rose-500/5 shadow-xs" : "border-border/70 hover:border-border"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">No Show</span>
            <UserX className="size-3.5 text-rose-500" />
          </div>
          <div className="text-lg font-bold text-foreground mt-0.5">
            {noShowList.length} <span className="text-xs text-muted-foreground font-normal">missed</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
          {[
            { key: "all", label: "All Patients", count: doctorFilteredQueue.length },
            { key: "waiting", label: "Waiting", count: waitingList.length },
            { key: "serving", label: "In Consult", count: servingItem ? 1 : 0 },
            { key: "emergency", label: "Emergency", count: emergencyList.length },
            { key: "completed", label: "Completed", count: completedList.length },
            { key: "no_show", label: "No Show", count: noShowList.length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 border ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-card hover:bg-muted/60 text-muted-foreground border-border/70"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === tab.key
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search patient by name, phone, token #, or chief complaint…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs rounded-xl bg-card border-border/80"
          />
        </div>
      </div>

      {/* Patient Queue Cards List */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : filteredList.length === 0 ? (
        <EmptyState
          icon={<ListOrdered className="size-6 text-muted-foreground" />}
          title="No patients found in this status"
          description="Patients booked or registered walk-ins for today's OPD will appear here in real-time."
          action={
            <Button size="sm" onClick={() => setRapidOpen(true)} className="h-8 text-xs gap-1.5 rounded-xl">
              <Plus className="size-3.5" /> Rapid Walk-in
            </Button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {filteredList.map((item, idx) => {
            const conf = STATUS_CONFIG[item.status] || STATUS_CONFIG.waiting;
            const cleanPhone = item.patient_phone ? item.patient_phone.replace(/\D/g, "") : "";
            const waUrl = cleanPhone
              ? `https://wa.me/${cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone}`
              : null;
            const waitEstimate = calculateWaitTime(item);

            return (
              <Card
                key={item.id}
                className={`p-3.5 sm:p-4 border transition-all bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl ${
                  item.status === "emergency"
                    ? "border-red-500/50 bg-red-500/[0.03] shadow-xs ring-1 ring-red-500/20"
                    : item.status === "serving"
                      ? "border-emerald-500/40 bg-emerald-500/[0.03] shadow-xs"
                      : item.status === "completed"
                        ? "opacity-75 border-border/60"
                        : "border-border/80 hover:border-primary/40 shadow-xs"
                }`}
              >
                {/* Left: Token Number + Patient Details */}
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`size-11 sm:size-12 rounded-2xl border grid place-items-center font-mono font-bold text-sm shrink-0 shadow-2xs ${
                      item.status === "emergency"
                        ? "bg-red-500 text-white border-red-600 animate-pulse"
                        : item.status === "serving"
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                          : "bg-muted/60 border-border/70 text-foreground"
                    }`}
                  >
                    #{item.token_number || idx + 1}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm sm:text-base text-foreground truncate">
                        {item.patient_name}
                      </h3>
                      {(item.patient_age || item.patient_gender) && (
                        <span className="text-xs text-muted-foreground font-mono">
                          • {[item.patient_age && `${item.patient_age}y`, item.patient_gender].filter(Boolean).join(", ")}
                        </span>
                      )}
                      <Badge variant={conf.badgeVariant} className={`text-[10px] px-2 py-0.5 ${conf.color}`}>
                        {conf.label}
                      </Badge>
                      {item.source === "token" && (
                        <Badge variant="outline" className="text-[9px] text-muted-foreground px-1.5 py-0">
                          Walk-in
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {/* Wait Time estimate */}
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Clock className="size-3 text-primary" />
                        <span className="text-[11px] text-primary">{waitEstimate}</span>
                      </span>

                      {item.scheduled_at && (
                        <span className="text-muted-foreground text-[11px]">
                          Booked: {new Date(item.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}

                      {item.patient_phone && (
                        <a href={`tel:${item.patient_phone}`} className="hover:text-primary font-medium flex items-center gap-1 text-[11px]">
                          <Phone className="size-3 text-emerald-600" />
                          {item.patient_phone}
                        </a>
                      )}

                      {item.problem && (
                        <span className="text-muted-foreground italic truncate max-w-xs text-[11px]">
                          Chief Complaint: {item.problem}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: 1-Click Fast Workflow Actions */}
                <div className="flex items-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60 justify-end flex-wrap">
                  {/* Confirmed appointment: Check-in button */}
                  {item.status === "confirmed" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCheckIn(item)}
                        className="h-8 text-xs font-semibold gap-1 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 rounded-xl"
                      >
                        <UserCheck className="size-3.5" /> Check-in
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleStartConsult(item)}
                        className="h-8 text-xs font-semibold bg-primary text-primary-foreground gap-1.5 shadow-xs rounded-xl"
                      >
                        <Stethoscope className="size-3.5" /> Start Consult
                      </Button>
                    </>
                  )}

                  {/* Waiting patient: Call & Consult, Emergency Triage, No-Show */}
                  {(item.status === "waiting" || item.status === "emergency") && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleStartConsult(item)}
                        className="h-8 text-xs font-semibold bg-primary text-primary-foreground gap-1.5 shadow-xs rounded-xl"
                      >
                        <Stethoscope className="size-3.5" /> Call &amp; Consult
                      </Button>

                      {item.status !== "emergency" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEmergencyCallIn(item)}
                          title="Triage as Emergency (Bump to Front)"
                          className="h-8 text-xs font-medium text-red-600 border-red-500/30 hover:bg-red-500/10 rounded-xl px-2.5"
                        >
                          <Flame className="size-3.5 text-red-500" /> Emergency
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMarkNoShow(item)}
                        title="Mark No Show"
                        className="h-8 text-xs text-rose-600 hover:bg-rose-500/10 rounded-xl px-2"
                      >
                        <UserX className="size-3.5" />
                      </Button>
                    </>
                  )}

                  {/* Serving patient: Resume Consult, Mark Done */}
                  {item.status === "serving" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleStartConsult(item)}
                        className="h-8 text-xs font-semibold bg-primary text-primary-foreground gap-1.5 shadow-xs rounded-xl"
                      >
                        <Stethoscope className="size-3.5" /> Resume Consult
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkDone(item)}
                        className="h-8 text-xs font-semibold text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 gap-1 rounded-xl"
                      >
                        <Check className="size-3.5" /> Done
                      </Button>
                    </>
                  )}

                  {/* Completed: Completed badge */}
                  {item.status === "completed" && (
                    <Badge variant="secondary" className="text-xs font-semibold text-emerald-600 bg-emerald-500/10 border-emerald-500/20 px-2 py-1">
                      ✓ Treated
                    </Badge>
                  )}

                  {/* No-show: Re-queue button */}
                  {item.status === "no_show" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRequeue(item)}
                      className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground rounded-xl gap-1"
                    >
                      <RotateCcw className="size-3" /> Re-queue
                    </Button>
                  )}

                  {/* WhatsApp contact link */}
                  {waUrl && (
                    <a href={waUrl} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="ghost" className="h-8 text-xs text-emerald-600 hover:bg-emerald-500/10 px-2 rounded-xl">
                        <MessageSquare className="size-3.5" />
                      </Button>
                    </a>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Rapid Walk-in Registration Modal */}
      {rapidOpen && orgId && (
        <RapidWalkinDialog
          orgId={orgId}
          clinicId={clinicId}
          clinicName={clinic?.clinic_name || "Clinic"}
          date={date}
          doctors={doctors}
          patients={patients}
          onClose={() => setRapidOpen(false)}
          onIssued={(slip) => {
            setRapidOpen(false);
            setIssuedSlip(slip);
            load();
          }}
        />
      )}

      {/* Issued Token Slip Feedback Modal */}
      {issuedSlip && (
        <Dialog open onOpenChange={() => setIssuedSlip(null)}>
          <DialogContent className="max-w-sm rounded-2xl p-6 text-center">
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-bold flex items-center justify-center gap-2">
                <CheckCircle2 className="size-6 text-emerald-600" /> Token Generated
              </DialogTitle>
              <DialogDescription className="text-xs">
                Patient added directly to today's live OPD queue.
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 my-2 rounded-2xl bg-muted/40 border border-border/80 text-center space-y-2">
              <span className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">OPD Token</span>
              <div className="font-mono text-5xl font-black text-primary">
                #{issuedSlip.tokenNumber}
              </div>
              <div className="font-bold text-base text-foreground">
                {issuedSlip.patientName}
              </div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Clock className="size-3 text-primary" /> Est. wait: {issuedSlip.waitEst}
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-col gap-2 mt-2">
              {issuedSlip.phone && (
                <a
                  href={`https://wa.me/${issuedSlip.phone.replace(/\D/g, "").length === 10 ? `91${issuedSlip.phone.replace(/\D/g, "")}` : issuedSlip.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                    `*${clinic?.clinic_name || "Clinic"}* OPD Token Slip\n\nToken Number: #${issuedSlip.tokenNumber}\nPatient: ${issuedSlip.patientName}\nEstimated Wait: ${issuedSlip.waitEst}\n\nPlease wait in the clinic lounge until your token is called.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full"
                >
                  <Button className="w-full h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5">
                    <Share2 className="size-3.5" /> Send Token via WhatsApp
                  </Button>
                </a>
              )}
              <Button variant="outline" onClick={() => setIssuedSlip(null)} className="w-full h-9 rounded-xl text-xs">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Rapid 10-Second Walk-in Registration Dialog
function RapidWalkinDialog({
  orgId,
  clinicId,
  clinicName,
  date,
  doctors,
  patients,
  onClose,
  onIssued,
}: {
  orgId: string;
  clinicId?: string;
  clinicName: string;
  date: string;
  doctors: DoctorOpt[];
  patients: PatientOpt[];
  onClose: () => void;
  onIssued: (slip: { tokenNumber: number; patientName: string; waitEst: string; phone: string | null }) => void;
}) {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [doctorId, setDoctorId] = useState<string>(doctors[0]?.id || "");
  const [problem, setProblem] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSelectPatient = (id: string) => {
    if (id === "__manual") {
      setPatientId(null);
      return;
    }
    setPatientId(id);
    const p = patients.find((x) => x.id === id);
    if (p) {
      setName(p.name);
      setPhone(p.phone ?? "");
    }
  };

  const handleQuickSymptom = (sym: string) => {
    if (!problem) setProblem(sym);
    else if (!problem.includes(sym)) setProblem(`${problem}, ${sym}`);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return toast.error("Please enter patient name");

    setSaving(true);
    try {
      // 1. Get next token number
      const { data: maxToken } = await supabase
        .from("queue_tokens")
        .select("token_number")
        .eq("organization_id", orgId)
        .eq("queue_date", date)
        .order("token_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextTokenNum = (maxToken?.token_number ?? 0) + 1;

      // 2. Create appointment entry so doctor has direct consult record
      let apptId: string | null = null;
      if (clinicId) {
        const { data: newAppt } = await supabase
          .from("appointments")
          .insert({
            clinic_id: clinicId,
            organization_id: orgId,
            patient_name: cleanName,
            patient_phone: phone.trim() || null,
            patient_age: age ? Number(age) : null,
            patient_gender: gender || null,
            problem: problem.trim() || "Walk-in OPD Consultation",
            scheduled_at: new Date().toISOString(),
            appointment_type: "offline",
            status: "waiting",
            source: "walkin",
            doctor_id: doctorId || null,
          } as any)
          .select("id")
          .maybeSingle();

        apptId = newAppt?.id || null;
      }

      // 3. Insert into queue_tokens (NO clinic_id in queue_tokens)
      const { error: tokenErr } = await supabase.from("queue_tokens").insert({
        organization_id: orgId,
        queue_date: date,
        token_number: nextTokenNum,
        appointment_id: apptId,
        patient_id: patientId && patientId !== "__manual" ? patientId : null,
        patient_name: cleanName,
        patient_phone: phone.trim() || null,
        priority: Boolean(isEmergency),
        note: problem.trim() || null,
        doctor_id: doctorId || null,
        status: isEmergency ? "emergency" : "waiting",
      });

      if (tokenErr && !tokenErr.message?.includes("schema cache")) {
        throw tokenErr;
      }

      // 4. Upsert patient directory record safely (protects against 42P10 and tenant immutability)
      if (phone.trim() && clinicId) {
        await safeUpsertPatient(supabase, {
          clinic_id: clinicId,
          organization_id: orgId,
          name: cleanName,
          phone: phone.trim(),
          age: age ? Number(age) : null,
          gender: gender || null,
          last_visit_at: new Date().toISOString(),
        });
      }

      toast.success(`🎫 Token #${nextTokenNum} issued for ${cleanName}!`);
      onIssued({
        tokenNumber: nextTokenNum,
        patientName: cleanName,
        waitEst: isEmergency ? "Immediate (Emergency)" : `~${Math.max(5, (nextTokenNum - 1) * 12)} mins`,
        phone: phone.trim() || null,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to issue token");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-5 sm:p-6 rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-primary/10 text-primary grid place-items-center">
              <Zap className="size-4 fill-current" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg font-bold">Rapid Walk-in Check-in</DialogTitle>
              <DialogDescription className="text-xs">
                Quick 10-second entry directly into today's OPD queue.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleRegister} className="space-y-3.5 mt-2">
          {/* Quick existing patient select */}
          {patients.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Existing Patient (Optional)</Label>
              <Select value={patientId ?? "__manual"} onValueChange={handleSelectPatient}>
                <SelectTrigger className="h-8 text-xs rounded-xl">
                  <SelectValue placeholder="— Search existing patient —" />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  <SelectItem value="__manual">— Type new walk-in —</SelectItem>
                  {patients.slice(0, 50).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.phone ? `(${p.phone})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Patient Name *</Label>
              <Input
                required
                autoFocus
                placeholder="e.g. Ramesh Patel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Phone Number</Label>
              <Input
                placeholder="10-digit mobile"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Age & Gender Chips */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Age</Label>
              <Input
                type="number"
                placeholder="e.g. 34"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Gender</Label>
              <div className="flex gap-1">
                {(["male", "female", "other"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(gender === g ? "" : g)}
                    className={`flex-1 py-1 text-xs rounded-lg border font-medium capitalize transition-all ${
                      gender === g
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 border-border/70 hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {g === "male" ? "M" : g === "female" ? "F" : "O"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Doctor Selection (if multiple) */}
          {doctors.length > 1 && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Assign Doctor</Label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger className="h-8 text-xs rounded-xl">
                  <SelectValue placeholder="Select Doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Chief Complaint & Quick Symptoms */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Chief Complaint / Reason</Label>
            <Input
              placeholder="e.g. High fever, throat ache"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              className="h-9 text-xs rounded-xl"
            />
            {/* Quick 1-tap symptom pills */}
            <div className="flex flex-wrap gap-1 pt-1">
              {COMMON_SYMPTOMS.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => handleQuickSymptom(sym)}
                  className="text-[10px] px-2 py-0.5 rounded-md border border-border/70 bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  + {sym}
                </button>
              ))}
            </div>
          </div>

          {/* Emergency / Priority Call-in Toggle */}
          <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.04] cursor-pointer">
            <input
              type="checkbox"
              checked={isEmergency}
              onChange={(e) => setIsEmergency(e.target.checked)}
              className="size-4 accent-red-600 rounded"
            />
            <div className="text-xs">
              <span className="font-bold text-red-600 flex items-center gap-1">
                <Flame className="size-3" /> Emergency Call-in (Triage to Top)
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Bumps patient to #1 in line ahead of regular OPD queue.
              </span>
            </div>
          </label>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="h-9 text-xs rounded-xl">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="h-9 text-xs px-4 font-bold rounded-xl bg-primary text-primary-foreground shadow-xs gap-1.5"
            >
              {saving ? "Generating…" : "Issue Token & Queue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Digital Reception TV Board Display View
function BoardView({
  serving,
  waiting,
  clinicName,
  onExit,
}: {
  serving: { token_number: number; patient_name: string; doctor_name: string } | null;
  waiting: { token_number: number; patient_name: string; priority?: boolean }[];
  clinicName: string;
  onExit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-background text-foreground flex flex-col justify-between p-6 sm:p-12 overflow-hidden select-none">
      {/* Top Banner */}
      <div className="flex items-center justify-between border-b pb-4 border-border">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-primary/10 text-primary grid place-items-center font-bold">
            <Stethoscope className="size-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-black tracking-tight">{clinicName}</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Live OPD Waiting Room</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onExit} className="h-8 text-xs rounded-xl">
          Exit TV Board
        </Button>
      </div>

      {/* Centerpiece: Now Serving Big Display */}
      <div className="my-auto py-8 text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 text-xs sm:text-sm font-bold uppercase tracking-widest animate-pulse">
          <span className="size-2 rounded-full bg-emerald-500 inline-block" /> Now Serving
        </div>
        <div className="font-display text-[20vw] leading-none tabular-nums font-black text-primary drop-shadow-sm">
          {serving ? `#${serving.token_number}` : "—"}
        </div>
        {serving ? (
          <div className="space-y-1">
            <p className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground">{serving.patient_name}</p>
            <p className="text-sm sm:text-base text-muted-foreground">Consultation Room • {serving.doctor_name}</p>
          </div>
        ) : (
          <p className="text-lg text-muted-foreground">Waiting room is clear</p>
        )}
      </div>

      {/* Bottom Row: Next in Line Tokens */}
      <div className="border-t pt-4 border-border">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground font-bold mb-3">Up Next in Line</p>
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          {waiting.slice(0, 8).map((t) => (
            <div
              key={t.token_number}
              className={`px-4 py-3 rounded-2xl border flex flex-col items-center justify-center min-w-[100px] shadow-xs ${
                t.priority
                  ? "bg-red-500/10 border-red-500/40 text-red-600"
                  : "bg-card border-border/80 text-foreground"
              }`}
            >
              <span className="font-mono text-2xl font-bold">#{t.token_number}</span>
              <span className="text-[11px] truncate max-w-[80px] text-muted-foreground font-medium">
                {t.patient_name}
              </span>
            </div>
          ))}
          {waiting.length === 0 && (
            <p className="text-xs text-muted-foreground">No patients currently waiting</p>
          )}
        </div>
      </div>
    </div>
  );
}
