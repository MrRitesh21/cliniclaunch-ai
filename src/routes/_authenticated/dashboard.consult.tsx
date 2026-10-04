import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Stethoscope,
  Plus,
  FileText,
  Calendar,
  Search,
  Trash2,
  Printer,
  Sparkles,
  HeartPulse,
  Activity,
  ChevronRight,
  TrendingUp,
  Users,
  Clock,
  Send,
  MessageSquare,
  CheckCircle2,
  PhoneCall,
  UserCheck,
  UserPlus,
  RefreshCw,
  Phone,
  Mic,
  MicOff,
  Sparkle,
  ArrowRight,
} from "lucide-react";
import { AppGuard } from "@/components/app/AppGuard";
import { EmptyState } from "@/components/app/EmptyState";
import { StatsCard } from "@/components/app/StatsCard";
import { useOrganization } from "@/hooks/useOrganization";
import { useClinic } from "./dashboard";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/dashboard/consult")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { appointmentId?: string; patientId?: string; new?: boolean } => ({
    appointmentId: typeof search.appointmentId === "string" ? search.appointmentId : undefined,
    patientId: typeof search.patientId === "string" ? search.patientId : undefined,
    new: search.new === true || search.new === "true",
  }),
  component: () => (
    <AppGuard appKey="consultation">
      <ConsultCockpitPage />
    </AppGuard>
  ),
});

type Consultation = {
  id: string;
  organization_id: string;
  patient_id: string | null;
  patient_name: string;
  appointment_id: string | null;
  chief_complaint: string | null;
  history: string | null;
  examination: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  bp: string | null;
  pulse: string | null;
  temperature: string | null;
  weight: string | null;
  height: string | null;
  follow_up_date: string | null;
  created_at: string;
};

type QueuePatient = {
  id: string;
  source: "appointment" | "token" | "manual";
  token_number: number;
  appointment_id?: string;
  patient_id?: string | null;
  patient_name: string;
  patient_phone: string | null;
  patient_age?: number | null;
  patient_gender?: string | null;
  status: "waiting" | "serving" | "confirmed" | "done";
  problem?: string | null;
  scheduled_at?: string;
};

type PatientOpt = { id: string; name: string; phone: string | null };

function escapeHtml(str?: string | null): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getBpStatus(bp: string) {
  if (!bp || !bp.includes("/")) return null;
  const [sysStr, diaStr] = bp.split("/");
  const sys = parseInt(sysStr);
  const dia = parseInt(diaStr);
  if (isNaN(sys) || isNaN(dia)) return null;
  if (sys >= 140 || dia >= 90)
    return { label: "High BP", color: "text-red-600 bg-red-50 dark:bg-red-950/20 border-red-200" };
  if (sys < 90 || dia < 60)
    return { label: "Low BP", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/20 border-blue-200" };
  return { label: "Normal BP", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200" };
}

function getTempStatus(temp: string) {
  if (!temp) return null;
  const t = parseFloat(temp);
  if (isNaN(t)) return null;
  if (t >= 100.4) return { label: "High Fever", color: "text-red-600 bg-red-50 dark:bg-red-950/20 border-red-200" };
  if (t >= 99.0) return { label: "Mild Fever", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/20 border-amber-200" };
  return { label: "Normal Temp", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200" };
}

const PRESETS: Record<string, { label: string; complaint: string; diagnosis: string; history: string; plan: string }> = {
  fever: {
    label: "🌡️ Fever / Cold",
    complaint: "Acute viral fever with body ache and chills",
    diagnosis: "Viral Pyrexia / Upper Respiratory Infection",
    history: "Fever for 2-3 days associated with fatigue and headache. No warning signs.",
    plan: "• Tab Paracetamol 650mg — 1-0-1 after food x 3 days\n• Tab Levocetirizine 5mg — 0-0-1 at night x 5 days\n• Syp ORS / Electral — 1 sachet in 1L water sip through day\n• Warm fluid intake & physical rest. Follow-up if fever persists after 3 days.",
  },
  throat: {
    label: "🗣️ Sore Throat",
    complaint: "Sore throat and painful swallowing with dry cough",
    diagnosis: "Acute Pharyngitis / Tonsillitis",
    history: "Throat pain for 2 days, aggravated on swallowing. Mild dry cough.",
    plan: "• Tab Amoxicillin+Clav 625mg — 1-0-1 after meals x 5 days\n• Tab Pantoprazole 40mg — 1-0-0 before breakfast x 5 days\n• Betadine gargles twice daily with warm water\n• Avoid chilled water and oily food.",
  },
  hypertension: {
    label: "❤️ BP Refill",
    complaint: "Routine blood pressure check & refill",
    diagnosis: "Essential Hypertension (Controlled)",
    history: "Patient on regular antihypertensive therapy. No chest tightness or palpitations.",
    plan: "• Tab Telmisartan 40mg — 1-0-0 morning x 30 days\n• Low sodium diet (< 2g/day) & regular 30m brisk walking\n• Self BP monitoring weekly. Follow up in 3 months.",
  },
  gastritis: {
    label: "🔥 Acidity / GERD",
    complaint: "Epigastric burning pain, acid reflux, and bloating",
    diagnosis: "Acute GERD / Dyspepsia",
    history: "Heartburn and postprandial fullness for 4 days after irregular eating habits.",
    plan: "• Cap Rabeprazole 20mg + Domperidone 30mg — 1-0-0 before breakfast x 10 days\n• Antacid Gelucil Syrup — 10ml after meals SOS\n• Avoid spicy, fried food and tea on empty stomach.\n• Early dinner 2 hours before bedtime.",
  },
  skin: {
    label: "🌿 Skin Allergy",
    complaint: "Itchy red rash with localized itching",
    diagnosis: "Allergic Contact Dermatitis / Urticaria",
    history: "Itching and erythematous papules for 3 days. No breathing difficulty.",
    plan: "• Tab Bilastine 20mg — 0-0-1 at night x 7 days\n• Calamine lotion topically twice daily\n• Tab Pantoprazole 40mg — 1-0-0 before breakfast x 7 days\n• Avoid synthetic fabrics and harsh soaps.",
  },
  gastro: {
    label: "🤢 Diarrhea / Gastro",
    complaint: "Loose stools (3-4 episodes), mild abdominal cramps, and nausea",
    diagnosis: "Acute Gastroenteritis / Food Intolerance",
    history: "Sudden onset loose stools after outside food. Mild dehydration.",
    plan: "• Tab Ofloxacin + Ornidazole — 1-0-1 after meals x 3 days\n• Tab Ondansetron 4mg — 1 tab SOS for nausea\n• Syp ORS Electral — 1 sachet in 1L water sip continuously\n• Light khichdi / curd-rice diet.",
  },
};

const FAST_MEDS = [
  { name: "Tab Paracetamol 650mg", dose: "1-0-1 after food x 3 days" },
  { name: "Tab Amoxicillin+Clav 625mg", dose: "1-0-1 after meals x 5 days" },
  { name: "Tab Azithromycin 500mg", dose: "1-0-0 before meals x 3 days" },
  { name: "Tab Pantoprazole 40mg", dose: "1-0-0 before breakfast x 7 days" },
  { name: "Tab Levocetirizine 5mg", dose: "0-0-1 at night x 5 days" },
  { name: "Tab Montelukast+Levocet 10/5", dose: "0-0-1 at night x 5 days" },
  { name: "Tab Telmisartan 40mg", dose: "1-0-0 morning x 30 days" },
  { name: "Tab Metformin 500mg", dose: "1-0-1 with meals x 30 days" },
  { name: "Tab Ondansetron 4mg", dose: "1 tab SOS for nausea" },
  { name: "Syp ORS / Electral Sachet", dose: "1 sachet in 1L water sip through day" },
];

function todayDateStr(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  } catch {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}

function ConsultCockpitPage() {
  const { org } = useOrganization();
  const clinic = useClinic();
  const searchParams = Route.useSearch();
  const orgId = org?.id;
  const clinicId = clinic?.id;

  const [activeTab, setActiveTab] = useState<"cockpit" | "history">("cockpit");
  const [queue, setQueue] = useState<QueuePatient[]>([]);
  const [historyRows, setHistoryRows] = useState<Consultation[]>([]);
  const [patients, setPatients] = useState<PatientOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueSearch, setQueueSearch] = useState("");

  // Active Patient in Cockpit
  const [selectedPatient, setSelectedPatient] = useState<QueuePatient | null>(null);

  // Form Fields
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientGender, setPatientGender] = useState("");
  const [appointmentId, setAppointmentId] = useState<string | null>(null);

  const [chiefComplaint, setChiefComplaint] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [historyNotes, setHistoryNotes] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [bp, setBp] = useState("");
  const [pulse, setPulse] = useState("");
  const [temp, setTemp] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!orgId && !clinicId) return;
    setLoading(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const dateStr = todayDateStr();

      const [consultRes, apptRes, tokenRes, patientRes] = await Promise.all([
        supabase
          .from("consultations" as any)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100)
          .then((r) => (r.error ? { data: [] } : r)),
        clinicId
          ? supabase
              .from("appointments")
              .select("*")
              .eq("clinic_id", clinicId)
              .gte("scheduled_at", todayStart.toISOString())
              .lte("scheduled_at", todayEnd.toISOString())
              .order("scheduled_at", { ascending: true })
          : Promise.resolve({ data: [] }),
        supabase
          .from("queue_tokens" as any)
          .select("*")
          .eq("queue_date", dateStr)
          .order("token_number")
          .then((r) => (r.error ? { data: [] } : r))
          .catch(() => ({ data: [] })),
        supabase
          .from("patients")
          .select("id, name, phone")
          .order("name")
          .limit(100)
          .then((r) => (r.error ? { data: [] } : r)),
      ]);

      const consults = (consultRes.data as any[]) ?? [];
      setHistoryRows(consults);
      setPatients((patientRes.data as any[]) ?? []);

      // Build unified today's queue
      const tokenMap = new Map<string, any>();
      for (const t of (tokenRes.data as any[]) ?? []) {
        tokenMap.set(t.patient_name?.trim().toLowerCase(), t);
      }

      const qList: QueuePatient[] = [];
      let tokenCounter = 1;

      // Map today's appointments
      for (const a of (apptRes.data as any[]) ?? []) {
        let st: QueuePatient["status"] = "confirmed";
        if (a.status === "completed") st = "done";
        else if (a.status === "serving" || a.status === "in_consultation") st = "serving";
        else if (a.status === "waiting") st = "waiting";

        qList.push({
          id: `appt-${a.id}`,
          source: "appointment",
          token_number: tokenCounter++,
          appointment_id: a.id,
          patient_name: a.patient_name,
          patient_phone: a.patient_phone,
          patient_age: a.patient_age,
          patient_gender: a.patient_gender,
          status: st,
          problem: a.problem,
          scheduled_at: a.scheduled_at,
        });
      }

      // Map walk-in tokens not linked to appointments
      for (const t of (tokenRes.data as any[]) ?? []) {
        const exists = qList.some(
          (q) => q.patient_name.trim().toLowerCase() === t.patient_name?.trim().toLowerCase()
        );
        if (!exists) {
          qList.push({
            id: `tok-${t.id}`,
            source: "token",
            token_number: t.token_number || tokenCounter++,
            patient_name: t.patient_name,
            patient_phone: t.patient_phone,
            status: t.status === "done" ? "done" : t.status === "serving" ? "serving" : "waiting",
            problem: t.note,
          });
        }
      }

      setQueue(qList);

      // Auto-select patient
      if (searchParams?.appointmentId) {
        const target = qList.find((x) => x.appointment_id === searchParams.appointmentId);
        if (target) {
          selectPatient(target);
          return;
        }
      }

      // Default: select first waiting or serving patient if none selected
      if (!selectedPatient && qList.length > 0) {
        const nextActive = qList.find((x) => x.status === "serving") || qList.find((x) => x.status === "waiting") || qList[0];
        if (nextActive) {
          selectPatient(nextActive);
        }
      }
    } catch (e) {
      console.error("Consult load data error:", e);
    } finally {
      setLoading(false);
    }
  }, [orgId, clinicId, searchParams?.appointmentId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectPatient = (p: QueuePatient) => {
    setSelectedPatient(p);
    setPatientName(p.patient_name || "");
    setPatientPhone(p.patient_phone || "");
    setPatientAge(p.patient_age ? String(p.patient_age) : "");
    setPatientGender(p.patient_gender || "");
    setAppointmentId(p.appointment_id || null);
    setChiefComplaint(p.problem || "");
    setDiagnosis("");
    setTreatmentPlan("");
    setHistoryNotes("NKDA (No Known Allergies)");
    setBp("");
    setPulse("");
    setTemp("");
    setWeight("");
    setHeight("");
    setFollowUpDate("");
  };

  const applyPreset = (key: string) => {
    const p = PRESETS[key];
    if (!p) return;
    setChiefComplaint(p.complaint);
    setDiagnosis(p.diagnosis);
    setHistoryNotes((prev) => (prev ? `${prev}, ${p.history}` : p.history));
    setTreatmentPlan(p.plan);
    toast.success(`⚡ 1-Click Preset Applied: ${p.label}`);
  };

  const addMedicine = (med: { name: string; dose: string }) => {
    const line = `• ${med.name} — ${med.dose}`;
    setTreatmentPlan((prev) => (prev ? `${prev}\n${line}` : line));
    toast.success(`Added ${med.name}`);
  };

  const toggleAllergy = (tag: string) => {
    setHistoryNotes((prev) => {
      if (prev.includes(tag)) {
        return prev.replace(tag, "").replace(/,\s*,/g, ",").trim();
      }
      return prev ? `${prev}, ${tag}` : tag;
    });
  };

  // Complete consultation & immediately load NEXT patient
  const handleCompleteAndNext = async () => {
    if (!patientName.trim()) {
      toast.error("Please enter or select a patient name");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        organization_id: orgId || clinic?.organization_id || null,
        clinic_id: clinicId || null,
        patient_name: patientName.trim(),
        appointment_id: appointmentId || null,
        chief_complaint: chiefComplaint.trim() || null,
        diagnosis: diagnosis.trim() || null,
        history: historyNotes.trim() || null,
        treatment_plan: treatmentPlan.trim() || null,
        bp: bp.trim() || null,
        pulse: pulse.trim() || null,
        temperature: temp.trim() || null,
        weight: weight.trim() || null,
        height: height.trim() || null,
        follow_up_date: followUpDate || null,
        created_at: new Date().toISOString(),
      };

      // 1. Save Consultation
      const { error: cErr } = await supabase.from("consultations" as any).insert(payload);
      if (cErr) throw cErr;

      // 2. Mark appointment completed
      if (appointmentId) {
        await supabase
          .from("appointments")
          .update({ status: "completed" } as any)
          .eq("id", appointmentId);
      }

      // 3. Mark token completed
      const todayStr = todayDateStr();
      await supabase
        .from("queue_tokens" as any)
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("queue_date", todayStr)
        .eq("patient_name", patientName.trim())
        .then(() => {})
        .catch(() => {});

      toast.success(`✅ Consultation completed for ${patientName}!`);

      // 4. Instantly advance to the NEXT waiting patient without page reload or redirection
      const remainingWaiting = queue.filter(
        (q) => q.status === "waiting" && q.patient_name !== patientName
      );
      const remainingUpcoming = queue.filter(
        (q) => q.status === "confirmed" && q.patient_name !== patientName
      );

      const nextPatient = remainingWaiting[0] || remainingUpcoming[0];
      if (nextPatient) {
        selectPatient(nextPatient);
        toast.info(`➡️ Now treating: ${nextPatient.patient_name}`);
      } else {
        // Clear form for next walk-in
        setPatientName("");
        setPatientPhone("");
        setPatientAge("");
        setPatientGender("");
        setAppointmentId(null);
        setChiefComplaint("");
        setDiagnosis("");
        setTreatmentPlan("");
        setHistoryNotes("NKDA (No Known Allergies)");
        setSelectedPatient(null);
        toast.success("🎉 All waiting patients treated! OPD Queue is clear.");
      }

      // Refresh background queue
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete consultation");
    } finally {
      setSaving(false);
    }
  };

  // Print Consultation Slip
  const handlePrintSlip = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rx - ${escapeHtml(patientName)}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            body { font-family: system-ui, sans-serif; color: #1e293b; margin: 0; padding: 0; background: #f8fafc; }
            .no-print { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #e2e8f0; padding: 12px 20px; display: flex; justify-content: space-between; }
            .btn { padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor: pointer; border: 1px solid #cbd5e1; background: #f1f5f9; }
            .btn-p { background: #2563eb; color: #fff; border: none; }
            .paper { max-width: 750px; margin: 20px auto; background: #fff; padding: 35px; border-radius: 12px; border: 1px solid #e2e8f0; }
            .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
            .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f8fafc; padding: 12px; border-radius: 8px; font-size: 13px; margin-bottom: 20px; }
            .sec-title { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #1e3a8a; border-bottom: 1px solid #93c5fd; padding-bottom: 3px; margin-top: 15px; margin-bottom: 8px; }
            .rx { background: #f8fafc; border: 1px dashed #cbd5e1; padding: 12px; border-radius: 8px; font-family: monospace; white-space: pre-wrap; font-size: 13px; line-height: 1.6; }
            @media print { .no-print { display: none !important; } .paper { border: none; margin: 0; padding: 0; } }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button class="btn" onclick="window.close(); history.back();">← Back to Dashboard</button>
            <button class="btn btn-p" onclick="window.print()">🖨️ Print / Save PDF</button>
          </div>
          <div class="paper">
            <div class="header">
              <h2 style="margin:0;color:#1e3a8a;">${escapeHtml(clinic?.clinic_name || org?.name || "Medical Clinic")}</h2>
              <div style="font-size:12px;color:#64748b;margin-top:4px;">Clinical Consultation &amp; Prescription Slip</div>
            </div>
            <div class="meta">
              <div><strong>Patient:</strong> ${escapeHtml(patientName)} ${patientAge ? `(${patientAge}y)` : ""}</div>
              <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
              <div><strong>Phone:</strong> ${escapeHtml(patientPhone || "—")}</div>
              <div><strong>Follow-up:</strong> ${followUpDate ? new Date(followUpDate).toLocaleDateString() : "SOS / As needed"}</div>
            </div>
            ${bp || pulse || temp || weight ? `
            <div class="sec-title">Vitals</div>
            <div style="font-size:12px;margin-bottom:15px;">
              ${bp ? `BP: <b>${escapeHtml(bp)}</b> ` : ""}
              ${pulse ? `Pulse: <b>${escapeHtml(pulse)} bpm</b> ` : ""}
              ${temp ? `Temp: <b>${escapeHtml(temp)}°F</b> ` : ""}
              ${weight ? `Weight: <b>${escapeHtml(weight)} kg</b>` : ""}
            </div>` : ""}
            ${diagnosis ? `<div class="sec-title">Diagnosis</div><div style="font-size:14px;font-weight:bold;color:#1e3a8a;margin-bottom:15px;">${escapeHtml(diagnosis)}</div>` : ""}
            <div class="sec-title">Prescription (Rx) &amp; Advice</div>
            <div class="rx">${escapeHtml(treatmentPlan || "No medications prescribed.")}</div>
          </div>
          <script>setTimeout(function(){ window.print(); }, 250);</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const waitingCount = queue.filter((q) => q.status === "waiting").length;
  const servingCount = queue.filter((q) => q.status === "serving").length;
  const completedCount = queue.filter((q) => q.status === "done").length;

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-16">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-foreground">
              Doctor Consultation Cockpit
            </h1>
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-bold">
              ● Live OPD Session
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            1-Screen Flow: Patient Select ➔ Vitals ➔ 1-Tap Rx ➔ Complete &amp; Next Patient.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-border p-1 bg-card text-xs">
            <button
              onClick={() => setActiveTab("cockpit")}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                activeTab === "cockpit" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ⚡ Live OPD Cockpit
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                activeTab === "history" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              📚 Past Records ({historyRows.length})
            </button>
          </div>
        </div>
      </div>

      {activeTab === "cockpit" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT COLUMN: Real-time Patient Queue (4 Cols Desktop, Top Row Mobile) */}
          <div className="lg:col-span-4 space-y-3">
            <Card className="p-3 sm:p-4 border-border/80 bg-card shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    <Users className="size-4 text-primary" /> Today's Queue ({queue.length})
                  </h3>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedPatient(null);
                    setPatientName("");
                    setPatientPhone("");
                    setPatientAge("");
                    setPatientGender("");
                    setAppointmentId(null);
                    setChiefComplaint("");
                    setDiagnosis("");
                    setTreatmentPlan("");
                  }}
                  className="h-7 text-xs px-2.5 rounded-lg gap-1"
                >
                  <Plus className="size-3" /> Walk-in
                </Button>
              </div>

              {/* Micro Status Indicators */}
              <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold">
                <div className="bg-amber-500/10 text-amber-700 dark:text-amber-400 py-1 rounded-lg border border-amber-500/20">
                  {waitingCount} Waiting
                </div>
                <div className="bg-emerald-500/10 text-emerald-600 py-1 rounded-lg border border-emerald-500/20">
                  {servingCount} In-Consult
                </div>
                <div className="bg-zinc-500/10 text-zinc-600 py-1 rounded-lg border border-zinc-500/20">
                  {completedCount} Done
                </div>
              </div>

              {/* Patient Queue Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Quick search patient…"
                  value={queueSearch}
                  onChange={(e) => setQueueSearch(e.target.value)}
                  className="pl-8 h-8 text-xs rounded-xl"
                />
              </div>

              {/* Scrollable Patient Cards */}
              <div className="space-y-1.5 max-h-[480px] lg:max-h-[620px] overflow-y-auto pr-1 no-scrollbar">
                {queue.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                    No patients in today's queue. Click <b>+ Walk-in</b> to start.
                  </div>
                ) : (
                  queue
                    .filter(
                      (q) =>
                        !queueSearch.trim() ||
                        q.patient_name.toLowerCase().includes(queueSearch.toLowerCase()) ||
                        (q.patient_phone ?? "").includes(queueSearch)
                    )
                    .map((item) => {
                      const isSelected =
                        selectedPatient?.patient_name === item.patient_name ||
                        selectedPatient?.appointment_id === item.appointment_id;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectPatient(item)}
                          className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                            isSelected
                              ? "bg-primary/10 border-primary text-foreground shadow-2xs"
                              : "bg-muted/20 hover:bg-muted/60 border-border/70 text-muted-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="size-6 rounded-lg bg-card border text-[11px] font-mono font-bold grid place-items-center text-foreground shrink-0">
                              #{item.token_number}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-foreground truncate">
                                {item.patient_name}
                              </div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                {item.problem || (item.scheduled_at ? new Date(item.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "General")}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-1">
                            {item.status === "waiting" && (
                              <span className="size-2 rounded-full bg-amber-500 animate-ping" />
                            )}
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0 font-semibold ${
                                item.status === "waiting"
                                  ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
                                  : item.status === "serving"
                                    ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                                    : item.status === "done"
                                      ? "bg-zinc-500/10 text-zinc-600 border-zinc-500/20"
                                      : "bg-blue-500/10 text-blue-700 border-blue-500/20"
                              }`}
                            >
                              {item.status === "done" ? "Done" : item.status === "waiting" ? "Waiting" : item.status === "serving" ? "In-Consult" : "Booked"}
                            </Badge>
                          </div>
                        </button>
                      );
                    })
                )}
              </div>
            </Card>
          </div>

          {/* RIGHT COLUMN: Active Consultation & Prescription Cockpit (8 Cols) */}
          <div className="lg:col-span-8 space-y-4">
            <Card className="p-4 sm:p-6 border-border/80 bg-card shadow-xs space-y-5 rounded-2xl">
              {/* Active Patient Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-2xl bg-primary/10 text-primary grid place-items-center font-bold text-base shadow-xs">
                    {patientName ? patientName.slice(0, 2).toUpperCase() : "Rx"}
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                      {patientName || "Walk-in Patient Consultation"}
                      {patientAge && <span className="text-xs font-normal text-muted-foreground font-mono">({patientAge} yrs{patientGender ? `, ${patientGender}` : ""})</span>}
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {patientPhone ? (
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <Phone className="size-3 text-emerald-600" /> {patientPhone}
                        </span>
                      ) : (
                        <span>No phone attached</span>
                      )}
                      {appointmentId && <Badge variant="secondary" className="text-[10px]">Linked Appt</Badge>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Quick Allergy Tags */}
                  {["NKDA", "Penicillin Allergy", "Sulfa Allergy", "Diabetic", "Hypertensive"].map((tag) => {
                    const active = historyNotes.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleAllergy(tag)}
                        className={`text-[10px] px-2 py-0.5 rounded-lg border font-semibold transition-all ${
                          active
                            ? tag.includes("Allergy")
                              ? "bg-rose-500 text-white border-rose-600"
                              : "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/40 text-muted-foreground hover:text-foreground border-border/60"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Vitals Quick Bar */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Activity className="size-3.5 text-emerald-600" /> Patient Vitals
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <Input
                    placeholder="BP (120/80)"
                    value={bp}
                    onChange={(e) => setBp(e.target.value)}
                    className="h-8 text-xs font-mono bg-muted/20"
                  />
                  <Input
                    placeholder="Pulse (bpm)"
                    type="number"
                    value={pulse}
                    onChange={(e) => setPulse(e.target.value)}
                    className="h-8 text-xs font-mono bg-muted/20"
                  />
                  <Input
                    placeholder="Temp (°F)"
                    value={temp}
                    onChange={(e) => setTemp(e.target.value)}
                    className="h-8 text-xs font-mono bg-muted/20"
                  />
                  <Input
                    placeholder="Weight (kg)"
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="h-8 text-xs font-mono bg-muted/20"
                  />
                  <Input
                    placeholder="Height (cm)"
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="h-8 text-xs font-mono bg-muted/20"
                  />
                </div>
              </div>

              {/* 1-Click Fast Clinical Presets Strip */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="size-3.5 text-amber-500" /> 1-Click Clinical Presets (Auto-fills Diagnosis &amp; Rx)
                </Label>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                  {Object.entries(PRESETS).map(([key, p]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyPreset(key)}
                      className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-muted/30 hover:bg-primary/10 hover:border-primary/40 border border-border/80 text-foreground transition-all shrink-0 shadow-2xs"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chief Complaint & Diagnosis Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Chief Complaint / Symptoms</Label>
                  <Input
                    placeholder="e.g. High fever with dry cough for 3 days"
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    className="text-xs h-9 bg-card"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Diagnosis</Label>
                  <Input
                    placeholder="e.g. Acute Upper Respiratory Tract Infection"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    className="text-xs h-9 font-medium text-primary bg-card"
                  />
                </div>
              </div>

              {/* Frequently Prescribed Medicines Inserter */}
              <div className="p-3 bg-muted/20 border border-border/70 rounded-2xl space-y-2">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="size-3 text-amber-500" /> 1-Click Medicine Inserter:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {FAST_MEDS.map((med) => (
                    <button
                      key={med.name}
                      type="button"
                      onClick={() => addMedicine(med)}
                      className="px-2 py-0.5 rounded-lg text-xs font-medium bg-card border border-border/80 hover:border-primary/50 hover:bg-primary/5 text-foreground transition-all shadow-2xs"
                    >
                      + {med.name.replace(/^(Tab|Cap|Syp)\s*/, "")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prescription Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Prescription (Rx) &amp; Advice</Label>
                  <span className="text-[10px] text-muted-foreground">Autosaved locally</span>
                </div>
                <Textarea
                  rows={5}
                  value={treatmentPlan}
                  onChange={(e) => setTreatmentPlan(e.target.value)}
                  placeholder="1. Tab Paracetamol 650mg — 1-0-1 after food x 3 days&#10;2. Syp ORS — 1 sachet in 1L water sip continuously&#10;3. Physical rest & plenty of warm fluids."
                  className="text-xs font-mono leading-relaxed bg-card"
                />
              </div>

              {/* Follow-up & Quick Date Offsets */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Label className="text-xs font-semibold">Follow-up:</Label>
                  <Input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="h-8 text-xs w-36 bg-card"
                  />
                  {[
                    { label: "+3d", days: 3 },
                    { label: "+5d", days: 5 },
                    { label: "+1w", days: 7 },
                    { label: "+2w", days: 14 },
                    { label: "+1m", days: 30 },
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + chip.days);
                        setFollowUpDate(d.toISOString().slice(0, 10));
                      }}
                      className="px-2 py-1 text-[11px] rounded-lg bg-muted border border-border/80 hover:bg-muted/80 text-foreground font-semibold"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* STICKY SPEED ACTION BAR */}
              <div className="pt-4 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handlePrintSlip}
                    className="h-9 text-xs gap-1.5 rounded-xl border-border/80"
                  >
                    <Printer className="size-3.5" /> Print Rx
                  </Button>
                  {patientPhone && (
                    <a
                      href={`https://wa.me/${patientPhone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 text-xs gap-1.5 rounded-xl text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                      >
                        <MessageSquare className="size-3.5" /> WhatsApp
                      </Button>
                    </a>
                  )}
                </div>

                {/* Primary Complete & Next Patient CTA */}
                <Button
                  size="lg"
                  onClick={handleCompleteAndNext}
                  disabled={saving}
                  className="h-10 px-6 bg-primary text-primary-foreground font-bold text-xs sm:text-sm gap-2 rounded-xl shadow-md"
                >
                  <CheckCircle2 className="size-4" />
                  {saving ? "Completing…" : "⚡ Complete & Next Patient"}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        /* ARCHIVED / PAST CONSULTATIONS TAB */
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {historyRows.map((c) => (
              <Card key={c.id} className="p-4 border-border/80 bg-card shadow-xs space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{c.patient_name}</h3>
                    <div className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  {c.diagnosis && (
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 font-bold">
                      {c.diagnosis}
                    </Badge>
                  )}
                </div>

                {c.chief_complaint && (
                  <p className="text-xs text-muted-foreground bg-muted/20 p-2 rounded-lg border border-border/60">
                    <b>Symptoms:</b> {c.chief_complaint}
                  </p>
                )}

                {c.treatment_plan && (
                  <p className="text-xs font-mono text-foreground bg-muted/30 p-2 rounded-lg border border-border/60 whitespace-pre-wrap">
                    {c.treatment_plan}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
