import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardDoctors } from "@/lib/clinic.functions";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useOrganization } from "@/hooks/useOrganization";
import { useClinic } from "./dashboard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AppGuard } from "@/components/app/AppGuard";
import {
  Users,
  Plus,
  Stethoscope,
  Clock,
  CheckCircle2,
  PhoneCall,
  Search,
  ListOrdered,
  Phone,
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
  RotateCcw,
  Zap,
  QrCode,
  Calendar,
  Sparkles,
} from "lucide-react";
import type { QueueItemStatus, QueueItem } from "./dashboard.queue";

export const Route = createFileRoute("/_authenticated/dashboard/walkins")({
  component: () => (
    <AppGuard appKey="qr_appointment">
      <WalkinDeskPage />
    </AppGuard>
  ),
});

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
  "Stomach Ache / Acidity",
  "BP & Sugar Review",
  "Joint & Body Pain",
  "Skin Rash",
  "General Checkup",
];

function today(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  } catch {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}

function playCallChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(523.25, now + 0.22);
    gain2.gain.setValueAtTime(0.3, now + 0.22);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.22);
    osc2.stop(now + 0.8);
  } catch (e) {
    console.debug("AudioContext chime error", e);
  }
}

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

export function WalkinDeskPage() {
  const { org } = useOrganization();
  const clinic = useClinic();
  const navigate = useNavigate();
  const orgId = org?.id || clinic?.organization_id;
  const clinicId = clinic?.id;

  const [queueList, setQueueList] = useState<QueueItem[]>([]);
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "waiting" | "serving" | "emergency" | "completed" | "no_show">("all");
  const [search, setSearch] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Rapid Registration Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [doctorId, setDoctorId] = useState<string>("");
  const [problem, setProblem] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [registering, setRegistering] = useState(false);
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

      const [tokenRes, docRes, apptRes] = await Promise.all([
        supabase
          .from("queue_tokens")
          .select("*")
          .eq("queue_date", date)
          .order("token_number", { ascending: true })
          .then((res) => (res.error ? { data: [] } : res), () => ({ data: [] })),
        clinicId
          ? fetchDoctorsFn({ data: { clinic_id: clinicId, organization_id: orgId || null } })
              .then((d) => ({
                data: (d || [])
                  .filter((x: any) => x.is_active !== false)
                  .map((x: any) => ({ id: x.id, name: x.name })),
              }))
              .catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
        clinicId
          ? supabase
              .from("appointments")
              .select("*")
              .eq("clinic_id", clinicId)
              .eq("source", "walkin")
              .gte("scheduled_at", todayStart.toISOString())
              .lte("scheduled_at", todayEnd.toISOString())
              .then((res) => (res.error ? { data: [] } : res), () => ({ data: [] }))
          : Promise.resolve({ data: [] }),
      ]);

      const docList = (docRes.data as any[]) ?? [];
      setDoctors(docList);
      if (docList[0] && !doctorId) setDoctorId(docList[0].id);
      const docMap = new Map<string, string>(docList.map((d) => [d.id, d.name]));

      const tokenItems: QueueItem[] = ((tokenRes.data as any[]) ?? []).map((t) => {
        let normalizedStatus: QueueItemStatus = "waiting";
        if (t.status === "completed" || t.status === "done") normalizedStatus = "completed";
        else if (t.status === "no_show" || t.status === "skipped") normalizedStatus = "no_show";
        else if (t.status === "serving" || t.status === "in_consultation") normalizedStatus = "serving";
        else if (t.status === "emergency" || t.priority) normalizedStatus = "emergency";
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
          doctor_name: t.doctor_id ? docMap.get(t.doctor_id) ?? null : null,
          created_at: t.created_at || new Date().toISOString(),
          called_at: t.called_at,
          completed_at: t.completed_at,
        };
      });

      // Also merge walk-in appointments that don't have a token
      const existingApptIds = new Set(tokenItems.map((t) => t.appointment_id).filter(Boolean));
      const apptItems: QueueItem[] = ((apptRes.data as any[]) ?? [])
        .filter((a) => !existingApptIds.has(a.id))
        .map((a, idx) => ({
          id: `appt-${a.id}`,
          source: "appointment",
          appointment_id: a.id,
          token_number: tokenItems.length + idx + 1,
          patient_name: a.patient_name,
          patient_phone: a.patient_phone,
          patient_age: a.patient_age,
          patient_gender: a.patient_gender,
          status: a.status === "completed" ? "completed" : a.status === "serving" ? "serving" : "waiting",
          priority: false,
          problem: a.problem,
          doctor_id: a.doctor_id,
          doctor_name: a.doctor_id ? docMap.get(a.doctor_id) ?? null : null,
          scheduled_at: a.scheduled_at,
          created_at: a.created_at || a.scheduled_at,
        }));

      const unified = [...tokenItems, ...apptItems].sort((a, b) => {
        if (a.status === "emergency" && b.status !== "emergency") return -1;
        if (b.status === "emergency" && a.status !== "emergency") return 1;
        return (a.token_number || 0) - (b.token_number || 0);
      });

      setQueueList(unified);
    } catch (err) {
      console.error("Walkins load error:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId, clinicId, date, doctorId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Real-time listener
  useEffect(() => {
    if (!orgId && !clinicId) return;
    const channel = supabase
      .channel(`walkins-live-${clinicId || orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_tokens" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => void load())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, clinicId, load]);

  // Grouped lists
  const emergencyList = useMemo(() => queueList.filter((t) => t.status === "emergency"), [queueList]);
  const waitingList = useMemo(() => queueList.filter((t) => t.status === "waiting" || t.status === "emergency"), [queueList]);
  const servingItem = useMemo(() => queueList.find((t) => t.status === "serving") ?? null, [queueList]);
  const completedList = useMemo(() => queueList.filter((t) => t.status === "completed"), [queueList]);
  const noShowList = useMemo(() => queueList.filter((t) => t.status === "no_show"), [queueList]);

  // Next candidate
  const nextInLine = useMemo(() => {
    if (emergencyList.length > 0) return emergencyList[0];
    const normalWaiting = queueList.filter((t) => t.status === "waiting");
    return normalWaiting[0] ?? null;
  }, [emergencyList, queueList]);

  // Estimated wait time
  const calculateWaitTime = useCallback(
    (item: QueueItem): string => {
      if (item.status === "serving") return "In Consultation Room";
      if (item.status === "emergency") return "Next (Emergency Triage)";
      if (item.status === "completed") return "Completed";
      if (item.status === "no_show") return "Missed";

      const waitingAhead = waitingList.filter(
        (w) => w.status !== "serving" && (w.priority || w.token_number < item.token_number)
      ).length;

      if (waitingAhead === 0) return "< 5 mins (Next in line)";
      const mins = waitingAhead * 12;
      return `~${mins} mins`;
    },
    [waitingList]
  );

  // Filtered view by tab & search query
  const filteredList = useMemo(() => {
    let list = queueList;
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
  }, [queueList, activeTab, search]);

  // Rapid Walk-in Submit (< 10 seconds)
  const handleRapidRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return toast.error("Please enter patient name");
    if (!orgId) return toast.error("Clinic organization not found");

    setRegistering(true);
    try {
      // 1. Fetch next token number
      const { data: maxToken } = await supabase
        .from("queue_tokens")
        .select("token_number")
        .eq("organization_id", orgId)
        .eq("queue_date", date)
        .order("token_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextTokenNum = (maxToken?.token_number ?? 0) + 1;

      // 2. Insert into appointments
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
            problem: problem.trim() || "Walk-in Consultation",
            scheduled_at: new Date().toISOString(),
            appointment_type: "offline",
            status: "waiting",
            source: "walkin",
            doctor_id: doctorId || null,
            consultation_fee: clinic?.consultation_fee ?? 500,
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

      // 4. Upsert patient into directory
      if (phone.trim() && clinicId) {
        await supabase
          .from("patients" as any)
          .upsert(
            {
              clinic_id: clinicId,
              organization_id: orgId,
              name: cleanName,
              phone: phone.trim(),
              age: age ? Number(age) : null,
              gender: gender || null,
              last_visit_at: new Date().toISOString(),
            },
            { onConflict: "clinic_id,phone" }
          )
          .then(() => {}, () => {});
      }

      toast.success(`🎫 Token #${nextTokenNum} issued for ${cleanName}!`);
      setIssuedSlip({
        tokenNumber: nextTokenNum,
        patientName: cleanName,
        waitEst: isEmergency ? "Immediate (Emergency)" : `~${Math.max(5, (nextTokenNum - 1) * 12)} mins`,
        phone: phone.trim() || null,
      });

      // Reset form
      setName("");
      setPhone("");
      setAge("");
      setGender("");
      setProblem("");
      setIsEmergency(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to issue token");
    } finally {
      setRegistering(false);
    }
  };

  // Start / Call consultation
  const handleStartConsult = async (item: QueueItem) => {
    try {
      let targetApptId = item.appointment_id;

      if (!targetApptId && clinicId) {
        const { data: newAppt } = await supabase
          .from("appointments")
          .insert({
            clinic_id: clinicId,
            organization_id: orgId || null,
            patient_name: item.patient_name,
            patient_phone: item.patient_phone,
            patient_age: item.patient_age ?? null,
            patient_gender: item.patient_gender ?? null,
            problem: item.problem || "Walk-in Consultation",
            scheduled_at: new Date().toISOString(),
            appointment_type: "offline",
            status: "serving",
            source: "walkin",
            doctor_id: item.doctor_id || (doctors[0]?.id ?? null),
            consultation_fee: clinic?.consultation_fee ?? 500,
          } as any)
          .select("id")
          .maybeSingle();

        targetApptId = newAppt?.id;
        if (item.source === "token") {
          await supabase
            .from("queue_tokens")
            .update({ appointment_id: targetApptId, status: "serving", called_at: new Date().toISOString() })
            .eq("id", item.id);
        }
      } else {
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
    if (!nextInLine) return toast.info("No walk-in patients waiting.");
    await handleStartConsult(nextInLine);
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
      toast.info(`${item.patient_name} marked as No Show`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to mark no-show");
    }
  };

  // Emergency Call-in
  const handleEmergencyCallIn = async (item: QueueItem) => {
    try {
      if (item.source === "token") {
        await supabase
          .from("queue_tokens")
          .update({ status: "emergency", priority: true })
          .eq("id", item.id);
      }
      toast.error(`🚨 ${item.patient_name} bumped to top as Emergency Call-in`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to flag emergency");
    }
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-foreground">
              Walk-in Reception Desk
            </h1>
            <Badge variant="outline" className="text-[11px] bg-primary/10 text-primary border-primary/20 font-bold px-2 py-0.5">
              Rapid OPD
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Instant 10-second walk-in check-in directly into doctor's live queue.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link to="/dashboard/queue">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-xl border-border/80">
              <Clock className="size-3.5 text-primary" /> Full OPD Queue
            </Button>
          </Link>
          <Link to="/dashboard/qr">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-xl border-border/80">
              <QrCode className="size-3.5" /> QR Poster
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSoundEnabled((v) => !v)}
            className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground"
          >
            {soundEnabled ? <Volume2 className="size-4 text-primary" /> : <VolumeX className="size-4" />}
          </Button>
        </div>
      </div>

      {/* 1-Click Call Next Walk-in Strip */}
      <Card className="overflow-hidden border-primary/30 bg-gradient-to-r from-primary/[0.08] via-background to-card shadow-xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-11 rounded-2xl bg-primary/15 border border-primary/30 text-primary grid place-items-center font-mono font-bold text-base shrink-0">
            {servingItem ? `#${servingItem.token_number}` : nextInLine ? `#${nextInLine.token_number}` : "—"}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase font-bold tracking-wider text-primary flex items-center gap-1">
              <Sparkles className="size-3 text-amber-500" />
              {servingItem ? "Currently Serving" : "Next in Line"}
            </div>
            <div className="text-sm sm:text-base font-bold text-foreground truncate">
              {servingItem ? servingItem.patient_name : nextInLine ? nextInLine.patient_name : "Waiting Room Empty"}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {servingItem
                ? `Dr. ${servingItem.doctor_name || clinic?.doctor_name || "Doctor"} is consulting`
                : nextInLine
                  ? calculateWaitTime(nextInLine)
                  : "Issue a token below to add first patient"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {servingItem && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStartConsult(servingItem)}
              className="h-9 px-3 rounded-xl text-xs font-semibold gap-1 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
            >
              <Stethoscope className="size-3.5" /> Resume
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleCallNext}
            disabled={!nextInLine}
            className="h-9 px-4 rounded-xl font-bold text-xs gap-1.5 shadow-xs bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <PhoneCall className="size-3.5" />
            <span>Call Next Walk-in</span>
            {nextInLine && (
              <span className="bg-primary-foreground/20 px-1.5 py-0.2 rounded text-[11px] font-mono">
                #{nextInLine.token_number}
              </span>
            )}
          </Button>
        </div>
      </Card>

      {/* Ultra-Fast 10-Second Rapid Walk-in Registration Card */}
      <Card className="p-4 sm:p-5 border-border/80 shadow-xs bg-card rounded-2xl">
        <div className="flex items-center justify-between mb-3 border-b pb-2.5 border-border/60">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <Zap className="size-4 fill-current" />
            </div>
            <h2 className="font-bold text-sm sm:text-base text-foreground">Rapid Walk-in Check-in</h2>
          </div>
          <span className="text-[11px] text-muted-foreground font-medium">Takes 5–10 seconds</span>
        </div>

        <form onSubmit={handleRapidRegister} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            {/* Patient Name */}
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs font-semibold">Patient Name *</Label>
              <Input
                required
                placeholder="Full name (e.g. Anand Sharma)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Phone Number</Label>
              <Input
                placeholder="10-digit mobile"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            {/* Age & Gender */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Age &amp; Gender</Label>
              <div className="flex gap-1.5">
                <Input
                  type="number"
                  placeholder="Age"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="h-9 text-xs w-16 rounded-xl"
                />
                <div className="flex flex-1 gap-1">
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
            {/* Chief Complaint / Symptoms */}
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs font-semibold">Chief Complaint / Symptoms</Label>
              <Input
                placeholder="e.g. Viral fever, throat pain"
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            {/* Doctor Select */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Doctor Assigned</Label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger className="h-9 text-xs rounded-xl bg-card">
                  <SelectValue placeholder="Select Doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.length === 0 ? (
                    <SelectItem value="default">{clinic?.doctor_name || "Primary Doctor"}</SelectItem>
                  ) : (
                    doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Submit Button */}
            <div>
              <Button
                type="submit"
                disabled={registering}
                className="w-full h-9 rounded-xl font-bold text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs gap-1.5"
              >
                <Zap className="size-3.5 fill-current" />
                {registering ? "Generating…" : "Queue & Issue Token"}
              </Button>
            </div>
          </div>

          {/* Quick symptom pills & emergency toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-border/50">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase mr-1">Quick Add:</span>
              {COMMON_SYMPTOMS.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => {
                    if (!problem) setProblem(sym);
                    else if (!problem.includes(sym)) setProblem(`${problem}, ${sym}`);
                  }}
                  className="text-[10px] px-2 py-0.5 rounded-md border border-border/70 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  + {sym}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-red-600 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={isEmergency}
                onChange={(e) => setIsEmergency(e.target.checked)}
                className="size-3.5 accent-red-600 rounded"
              />
              <span className="flex items-center gap-1">
                <Flame className="size-3" /> Emergency Call-in (Bump to Top)
              </span>
            </label>
          </div>
        </form>
      </Card>

      {/* Filter Tabs & Search Bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
          {[
            { key: "all", label: "All Walk-ins", count: queueList.length },
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
            placeholder="Search walk-in by patient name, phone, or token…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs rounded-xl bg-card border-border/80"
          />
        </div>
      </div>

      {/* Today's Walk-in Queue List */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : filteredList.length === 0 ? (
        <EmptyState
          icon={<ListOrdered className="size-6 text-muted-foreground" />}
          title="No walk-ins in this status"
          description="Patients registered at the desk today will show up here with live status updates."
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
                    ? "border-red-500/50 bg-red-500/[0.03] shadow-xs"
                    : item.status === "serving"
                      ? "border-emerald-500/40 bg-emerald-500/[0.03] shadow-xs"
                      : "border-border/80 shadow-xs"
                }`}
              >
                {/* Left: Token + Info */}
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`size-11 rounded-2xl border grid place-items-center font-mono font-bold text-sm shrink-0 shadow-2xs ${
                      item.status === "emergency"
                        ? "bg-red-500 text-white border-red-600 animate-pulse"
                        : item.status === "serving"
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                          : "bg-muted/60 border-border/70 text-foreground"
                    }`}
                  >
                    #{item.token_number || idx + 1}
                  </div>

                  <div className="space-y-0.5 min-w-0">
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
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1 font-medium text-primary">
                        <Clock className="size-3" />
                        <span className="text-[11px]">{waitEstimate}</span>
                      </span>

                      {item.patient_phone && (
                        <a href={`tel:${item.patient_phone}`} className="hover:text-primary font-medium flex items-center gap-1 text-[11px]">
                          <Phone className="size-3 text-emerald-600" />
                          {item.patient_phone}
                        </a>
                      )}

                      {item.doctor_name && (
                        <span className="text-[11px] text-muted-foreground">
                          Dr. {item.doctor_name}
                        </span>
                      )}

                      {item.problem && (
                        <span className="text-muted-foreground italic truncate max-w-xs text-[11px]">
                          Complaint: {item.problem}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60 justify-end flex-wrap">
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

                  {item.status === "completed" && (
                    <Badge variant="secondary" className="text-xs font-semibold text-emerald-600 bg-emerald-500/10 border-emerald-500/20 px-2 py-1">
                      ✓ Treated
                    </Badge>
                  )}

                  {item.status === "no_show" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        supabase
                          .from("queue_tokens")
                          .update({ status: "waiting" })
                          .eq("id", item.id)
                          .then(() => {
                            toast.success("Returned to waiting list");
                            load();
                          });
                      }}
                      className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground rounded-xl gap-1"
                    >
                      <RotateCcw className="size-3" /> Re-queue
                    </Button>
                  )}

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

      {/* Issued Token Confirmation Dialog */}
      {issuedSlip && (
        <Dialog open onOpenChange={() => setIssuedSlip(null)}>
          <DialogContent className="max-w-sm rounded-2xl p-6 text-center">
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-bold flex items-center justify-center gap-2">
                <CheckCircle2 className="size-6 text-emerald-600" /> Walk-in Registered
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
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
