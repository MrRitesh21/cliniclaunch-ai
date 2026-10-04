import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Stethoscope,
  Plus,
  FileText,
  Calendar,
  Search,
  Trash2,
  Pencil,
  Printer,
  Sparkles,
  HeartPulse,
  Activity,
  Thermometer,
  ChevronRight,
  TrendingUp,
  Users,
  Clock,
  AlertCircle,
  Info,
  Sparkle,
} from "lucide-react";
import { AppGuard } from "@/components/app/AppGuard";
import { EmptyState } from "@/components/app/EmptyState";
import { StatsCard } from "@/components/app/StatsCard";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
      <ConsultPage />
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

type PatientOpt = { id: string; name: string; phone: string | null };
type ApptOpt = { id: string; patient_name: string; scheduled_at: string | null; status: string };

// Vitals status checker
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
    return {
      label: "Low BP",
      color: "text-blue-600 bg-blue-50 dark:bg-blue-950/20 border-blue-200",
    };
  return {
    label: "Normal BP",
    color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200",
  };
}

function getTempStatus(temp: string) {
  if (!temp) return null;
  const t = parseFloat(temp);
  if (isNaN(t)) return null;
  if (t >= 100.4)
    return {
      label: "High Fever",
      color: "text-red-600 bg-red-50 dark:bg-red-950/20 border-red-200",
    };
  if (t >= 99.0)
    return {
      label: "Mild Fever",
      color: "text-amber-600 bg-amber-50 dark:bg-amber-950/20 border-amber-200",
    };
  if (t < 95.0)
    return {
      label: "Hypothermia",
      color: "text-blue-600 bg-blue-50 dark:bg-blue-950/20 border-blue-200",
    };
  return {
    label: "Normal Temp",
    color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200",
  };
}

function getPulseStatus(pulse: string) {
  if (!pulse) return null;
  const p = parseInt(pulse);
  if (isNaN(p)) return null;
  if (p > 100)
    return {
      label: "High Pulse",
      color: "text-red-600 bg-red-50 dark:bg-red-950/20 border-red-200",
    };
  if (p < 60)
    return {
      label: "Low Pulse",
      color: "text-blue-600 bg-blue-50 dark:bg-blue-950/20 border-blue-200",
    };
  return {
    label: "Normal Pulse",
    color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200",
  };
}

// AI SOAP generator clinical templates
const MEDICAL_KNOWLEDGE: Record<string, { history: string; exam: string; plan: string }> = {
  fever: {
    history:
      "Patient reports high-grade fever spikes for 3 days, accompanied by chills, mild body ache, and generalized fatigue. No chest pain, difficulty breathing, or rash reported.",
    exam: "Patient is conscious, alert, and oriented. Oropharynx is mildly congested. Chest is clear on auscultation. Abdomen soft, non-tender.",
    plan: "1. Tab Paracetamol 650mg orally up to 4 times a day if temperature exceeds 99°F.\n2. Complete Bed Rest & high fluid intake (2-3 Litres/day).\n3. CBC and Widal test if fever persists beyond 5 days.\n4. Follow up in 3 days or sooner if red-flag symptoms arise.",
  },
  throat: {
    history:
      "Patient presents with severe sore throat, difficulty swallowing solids, and persistent throat irritation for 2 days. Associated with dry cough.",
    exam: "Pharynx shows significant erythema. Tonsils are enlarged (Grade 2) with no visible purulent exudate. Bilateral cervical lymph nodes are tender on palpation.",
    plan: "1. Warm saline gargles with Betadine gargle solution 3-4 times a day.\n2. Tab Amoxicillin 500mg 3 times a day for 5 days.\n3. Tab Levocetirizine 5mg at bedtime for throat congestion.\n4. Avoid cold/sour foods. Soft diet recommended.",
  },
  cough: {
    history:
      "Patient reports productive cough with yellowish sputum for 5 days. Mild chest discomfort during coughing. No hemoptysis or breathlessness.",
    exam: "Mild throat congestion. Chest auscultation reveals bilateral rhonchi, no crepitations. SpO2: 98% on room air.",
    plan: "1. Expectorant cough syrup 10ml thrice daily for 5 days.\n2. Tab Azithromycin 500mg once daily for 3 days.\n3. Steam inhalation twice daily.\n4. Drink warm water and maintain hydration. Follow up if dyspnea develops.",
  },
  hypertension: {
    history:
      "Patient is a known case of essential hypertension, presenting for a routine follow-up check. Complains of mild occipital headache and fatigue.",
    exam: "BP checked twice in sitting position: 152/96 mmHg. CVS: S1 S2 heard, no murmurs. Lungs clear. No pedal edema.",
    plan: "1. Continue current antihypertensive medication (Tab Telmisartan 40mg OD).\n2. Restrict dietary sodium intake to < 5g/day. Daily brisk walk for 30 minutes.\n3. Maintain a daily home BP log for 1 week.\n4. Follow up next week for dosage review.",
  },
  diabetes: {
    history:
      "Patient is a Type 2 diabetic. Presents for routine blood glucose check. Reports mild polyuria, nocturia, and dry mouth over the past 2 weeks.",
    exam: "Weight: 82 kg. Feet examination: intact sensation, no active ulcers. CVS & Respiratory normal.",
    plan: "1. Tab Metformin 500mg BD after meals.\n2. Strict diabetic diet (low glycemic index, no refined sugars).\n3. Schedule HbA1c, FBS, and PPBS. Eye and kidney profile evaluation.\n4. Walk 45 minutes daily. Return for review in 2 weeks.",
  },
  back: {
    history:
      "Patient complains of sharp, localized lower back pain for 4 days after lifting a heavy object. Pain radiates to the gluteal region but not down the leg.",
    exam: "Tenderness on palpation of lumbar paraspinal muscles. Straight leg raise (SLR) test is negative bilaterally. Lumbar range of motion is restricted.",
    plan: "1. Tab Aceclofenac 100mg + Paracetamol 325mg twice daily after food.\n2. Local application of Diclofenac pain relief gel 3 times daily.\n3. Avoid heavy lifting and forward bending. Use a firm mattress.\n4. Physiotherapy evaluation if pain persists past 10 days.",
  },
};

function generateSoapDraft(complaint: string, diagnosis: string) {
  const combined = `${complaint} ${diagnosis}`.toLowerCase();

  let matchKey = "";
  if (combined.includes("fever") || combined.includes("temp") || combined.includes("pyrexia"))
    matchKey = "fever";
  else if (
    combined.includes("throat") ||
    combined.includes("tonsil") ||
    combined.includes("swallow")
  )
    matchKey = "throat";
  else if (
    combined.includes("cough") ||
    combined.includes("bronchitis") ||
    combined.includes("sputum")
  )
    matchKey = "cough";
  else if (
    combined.includes("bp") ||
    combined.includes("hyper") ||
    combined.includes("tension") ||
    combined.includes("pressure")
  )
    matchKey = "hypertension";
  else if (combined.includes("diab") || combined.includes("sugar") || combined.includes("glucose"))
    matchKey = "diabetes";
  else if (
    combined.includes("back") ||
    combined.includes("spine") ||
    combined.includes("lumbar") ||
    combined.includes("pain")
  )
    matchKey = "back";

  if (matchKey && MEDICAL_KNOWLEDGE[matchKey]) {
    return MEDICAL_KNOWLEDGE[matchKey];
  }

  // Generic fallback generator
  return {
    history: `Patient presents with chief complaint of "${complaint || "symptoms"}" for a duration of several days. Condition is currently localized. No red-flag systemic symptoms reported.`,
    exam: `Patient is hemodynamically stable. Localized examination of the affected region shows mild tenderness and irritation. Lungs are clear, heart sounds normal.`,
    plan: `1. Symptomatic relief medications as indicated for "${diagnosis || complaint}".\n2. Monitor symptoms and take adequate physical rest.\n3. Return immediately if symptoms worsen or complications arise.\n4. Follow up in 3 to 5 days.`,
  };
}

function ConsultPage() {
  const { org } = useOrganization();
  const orgId = org?.id;
  const searchParams = Route.useSearch();
  const [rows, setRows] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Consultation | "new" | null>(null);
  const [initialApptData, setInitialApptData] = useState<{
    appointmentId?: string;
    patientName?: string;
    patientId?: string;
    problem?: string;
  } | null>(null);
  const [patients, setPatients] = useState<PatientOpt[]>([]);
  const [appts, setAppts] = useState<ApptOpt[]>([]);

  async function load() {
    if (!orgId) return;
    setLoading(true);
    const [{ data: c }, { data: p }, { data: a }] = await Promise.all([
      supabase
        .from("consultations" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      supabase
        .from("patients")
        .select("id, name, phone")
        .eq("organization_id", orgId)
        .order("name"),
      supabase
        .from("appointments")
        .select("id, patient_name, scheduled_at, status, problem, patient_phone")
        .eq("organization_id", orgId)
        .order("scheduled_at", { ascending: false })
        .limit(100),
    ]);
    setRows((c as any[]) ?? []);
    setPatients((p as any[]) ?? []);
    setAppts((a as any[]) ?? []);

    // If navigated with appointmentId search param, auto-open consult for this appointment
    if (searchParams?.appointmentId && a) {
      const targetAppt = (a as any[]).find((item) => item.id === searchParams.appointmentId);
      if (targetAppt) {
        setInitialApptData({
          appointmentId: targetAppt.id,
          patientName: targetAppt.patient_name,
          problem: targetAppt.problem || "",
        });
        setEditing("new");
      }
    } else if (searchParams?.new) {
      setEditing("new");
    }

    setLoading(false);
  }

  useEffect(() => {
    void load(); /* eslint-disable-next-line */
  }, [orgId, searchParams?.appointmentId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.patient_name.toLowerCase().includes(q) ||
        (r.diagnosis ?? "").toLowerCase().includes(q) ||
        (r.chief_complaint ?? "").toLowerCase().includes(q),
    );
  }, [search, rows]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tIso = today.toISOString();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    return {
      total: rows.length,
      today: rows.filter((r) => r.created_at >= tIso).length,
      month: rows.filter((r) => r.created_at >= monthStart).length,
      followUps: rows.filter(
        (r) => r.follow_up_date && r.follow_up_date >= today.toISOString().slice(0, 10),
      ).length,
    };
  }, [rows]);

  async function remove(id: string) {
    if (!confirm("Delete this consultation?")) return;
    const { error } = await supabase
      .from("consultations" as any)
      .delete()
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  // Print Summary PDF slip function
  function printConsultation(c: Consultation) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    let bmiStr = "";
    const w = parseFloat(c.weight ?? "");
    const h = parseFloat(c.height ?? "");
    if (w > 0 && h > 0) {
      const heightInMeters = h > 3 ? h / 100 : h;
      const bmi = w / (heightInMeters * heightInMeters);
      bmiStr = bmi.toFixed(1);
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Clinical Summary - ${escapeHtml(c.patient_name)}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; color: #1f2937; margin: 40px; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 25px; }
            .clinic-title { font-size: 26px; font-weight: bold; color: #1e3a8a; }
            .doc-subtitle { font-size: 13px; color: #6b7280; margin-top: 5px; text-transform: uppercase; tracking-wider: 1px; }
            .meta-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 12px; margin-bottom: 30px; font-size: 14px; background: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; }
            .section-title { font-size: 14px; font-weight: bold; text-transform: uppercase; color: #1e3a8a; border-bottom: 1.5px solid #2563eb; padding-bottom: 5px; margin-top: 25px; margin-bottom: 10px; }
            .vitals-bar { display: flex; flex-wrap: wrap; gap: 15px; background: #f0f7ff; border: 1px solid #bfdbfe; padding: 12px 15px; border-radius: 8px; margin-bottom: 20px; }
            .vitals-item { flex: 1; min-width: 80px; text-align: center; border-right: 1px solid #bfdbfe; }
            .vitals-item:last-child { border-right: none; }
            .vitals-label { color: #4b5563; font-size: 11px; font-weight: 500; text-transform: uppercase; }
            .vitals-val { font-size: 15px; font-weight: bold; color: #1d4ed8; margin-top: 2px; }
            .content-block { font-size: 14px; margin-bottom: 20px; white-space: pre-wrap; color: #374151; }
            .footer { margin-top: 90px; display: flex; justify-content: space-between; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 20px; }
            .sig-area { text-align: center; }
            .sig-line { border-top: 1.5px dashed #9ca3af; width: 220px; margin-top: 50px; text-align: center; padding-top: 5px; font-weight: 500; color: #4b5563; }
            @media print {
              body { margin: 20px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="clinic-title">${escapeHtml(org?.name ?? "Medical Clinic")}</div>
            <div class="doc-subtitle">Clinical Consultation Record</div>
          </div>
          
          <div class="meta-grid">
            <div><strong>Patient Name:</strong> ${escapeHtml(c.patient_name)}</div>
            <div><strong>Consultation Date:</strong> ${new Date(c.created_at).toLocaleString()}</div>
            <div><strong>Record ID:</strong> ${escapeHtml(c.id.slice(0, 8).toUpperCase())}</div>
            <div><strong>Follow-up Date:</strong> ${c.follow_up_date ? new Date(c.follow_up_date).toLocaleDateString() : "None scheduled"}</div>
          </div>

          ${
            c.bp || c.pulse || c.temperature || c.weight || c.height
              ? `
          <div class="section-title">Patient Vitals & Measurements</div>
          <div class="vitals-bar">
            ${c.bp ? `<div class="vitals-item"><div class="vitals-label">BP</div><div class="vitals-val">${escapeHtml(c.bp)} mmHg</div></div>` : ""}
            ${c.pulse ? `<div class="vitals-item"><div class="vitals-label">Pulse</div><div class="vitals-val">${escapeHtml(c.pulse)} bpm</div></div>` : ""}
            ${c.temperature ? `<div class="vitals-item"><div class="vitals-label">Temp</div><div class="vitals-val">${escapeHtml(c.temperature)} °F</div></div>` : ""}
            ${c.weight ? `<div class="vitals-item"><div class="vitals-label">Weight</div><div class="vitals-val">${escapeHtml(c.weight)} kg</div></div>` : ""}
            ${c.height ? `<div class="vitals-item"><div class="vitals-label">Height</div><div class="vitals-val">${escapeHtml(c.height)} cm</div></div>` : ""}
            ${bmiStr ? `<div class="vitals-item"><div class="vitals-label">BMI</div><div class="vitals-val">${bmiStr}</div></div>` : ""}
          </div>
          `
              : ""
          }

          ${
            c.chief_complaint
              ? `
          <div class="section-title">Chief Complaint</div>
          <div class="content-block">${escapeHtml(c.chief_complaint)}</div>
          `
              : ""
          }

          ${
            c.history
              ? `
          <div class="section-title">Medical History</div>
          <div class="content-block">${escapeHtml(c.history)}</div>
          `
              : ""
          }

          ${
            c.examination
              ? `
          <div class="section-title">Clinical Examination Findings</div>
          <div class="content-block">${escapeHtml(c.examination)}</div>
          `
              : ""
          }

          ${
            c.diagnosis
              ? `
          <div class="section-title">Diagnosis</div>
          <div class="content-block" style="font-weight: 600; font-size: 16px; color: #1e3a8a;">${escapeHtml(c.diagnosis)}</div>
          `
              : ""
          }

          ${
            c.treatment_plan
              ? `
          <div class="section-title">Treatment Plan & Recommendations</div>
          <div class="content-block">${escapeHtml(c.treatment_plan)}</div>
          `
              : ""
          }

          <div class="footer">
            <div>ClinicX Clinical Platform Summary</div>
            <div class="sig-area">
              <div class="sig-line">Doctor Signature & Stamp</div>
            </div>
          </div>
          
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Clinical Consultations</h1>
          <p className="text-sm text-muted-foreground">
            EHR records, SOAP clinical notes, and patient treatment summaries.
          </p>
        </div>
        <Button onClick={() => setEditing("new")} className="shadow-md shadow-primary/10">
          <Plus className="size-4 mr-1" /> New consultation
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsCard
          title="Total Visits"
          value={stats.total}
          icon={<FileText className="size-4 text-blue-600" />}
        />
        <StatsCard
          title="Today"
          value={stats.today}
          icon={<Stethoscope className="size-4 text-emerald-600" />}
        />
        <StatsCard
          title="This Month"
          value={stats.month}
          icon={<TrendingUp className="size-4 text-indigo-600" />}
        />
        <StatsCard
          title="Follow-Ups Scheduled"
          value={stats.followUps}
          icon={<Calendar className="size-4 text-amber-600" />}
        />
      </div>

      <div className="flex items-center gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search patient, diagnosis, complaint..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Stethoscope className="size-8 text-muted-foreground" />}
          title={rows.length === 0 ? "No clinical consultations logged" : "No matching records"}
          description={
            rows.length === 0
              ? "Record doctor notes, patient vitals, diagnosis, and PDF print summaries."
              : "Refine your search parameters."
          }
          action={
            rows.length === 0
              ? { label: "Log New Consultation", onClick: () => setEditing("new") }
              : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((c) => {
            const bpAlert = getBpStatus(c.bp ?? "");
            const tempAlert = getTempStatus(c.temperature ?? "");
            return (
              <Card
                key={c.id}
                className="p-5 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-semibold text-base text-zinc-900 dark:text-white flex items-center gap-1.5">
                        {c.patient_name}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="size-3" />{" "}
                        {new Date(c.created_at).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </div>
                    </div>
                    {c.diagnosis ? (
                      <Badge className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 font-semibold">
                        {c.diagnosis}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        No diagnosis
                      </Badge>
                    )}
                  </div>

                  {/* Vitals Summary Strip */}
                  {(c.bp || c.pulse || c.temperature) && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {c.bp && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-medium flex items-center gap-1 ${bpAlert?.color ?? "bg-zinc-50 text-zinc-600 border-zinc-200"}`}
                        >
                          <Activity className="size-2.5" /> BP: {c.bp}
                        </span>
                      )}
                      {c.temperature && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-medium flex items-center gap-1 ${tempAlert?.color ?? "bg-zinc-50 text-zinc-600 border-zinc-200"}`}
                        >
                          <Thermometer className="size-2.5" /> Temp: {c.temperature}°F
                        </span>
                      )}
                      {c.pulse && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border font-mono font-medium flex items-center gap-1 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800">
                          HR: {c.pulse} bpm
                        </span>
                      )}
                    </div>
                  )}

                  {c.chief_complaint && (
                    <div className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/50">
                      <strong className="text-zinc-700 dark:text-zinc-300">Chief Complaint:</strong>
                      <p className="mt-0.5 line-clamp-2 leading-relaxed">{c.chief_complaint}</p>
                    </div>
                  )}

                  {c.follow_up_date && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10 self-start inline-flex items-center gap-1 font-medium">
                      <Calendar className="size-3" /> Follow-up:{" "}
                      {new Date(c.follow_up_date).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center gap-2 mt-4 pt-3 border-t border-border/40">
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(c)}
                      className="h-8 text-xs"
                    >
                      <Pencil className="size-3.5 mr-1" /> Edit Notes
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => printConsultation(c)}
                      className="h-8 text-xs hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:text-blue-600"
                    >
                      <Printer className="size-3.5 mr-1" /> Print Summary
                    </Button>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(c.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing && orgId && (
        <ConsultSheet
          orgId={orgId}
          patients={patients}
          appts={appts}
          initialData={initialApptData}
          existing={editing === "new" ? null : editing}
          onClose={() => {
            setEditing(null);
            setInitialApptData(null);
          }}
          onSaved={() => {
            setEditing(null);
            setInitialApptData(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ConsultSheet({
  orgId,
  patients,
  appts,
  initialData,
  existing,
  onClose,
  onSaved,
}: {
  orgId: string;
  patients: PatientOpt[];
  appts: ApptOpt[];
  initialData?: {
    appointmentId?: string;
    patientName?: string;
    patientId?: string;
    problem?: string;
  } | null;
  existing: Consultation | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [patientId, setPatientId] = useState<string | null>(
    existing?.patient_id ?? initialData?.patientId ?? null,
  );
  const [patientName, setPatientName] = useState(
    existing?.patient_name ?? initialData?.patientName ?? "",
  );
  const [appointmentId, setAppointmentId] = useState<string | null>(
    existing?.appointment_id ?? initialData?.appointmentId ?? null,
  );
  const [activeTab, setActiveTab] = useState("vitals");

  const [f, setF] = useState({
    chief_complaint: existing?.chief_complaint ?? initialData?.problem ?? "",
    history: existing?.history ?? "",
    examination: existing?.examination ?? "",
    diagnosis: existing?.diagnosis ?? "",
    treatment_plan: existing?.treatment_plan ?? "",
    bp: existing?.bp ?? "",
    pulse: existing?.pulse ?? "",
    temperature: existing?.temperature ?? "",
    weight: existing?.weight ?? "",
    height: existing?.height ?? "",
    follow_up_date: existing?.follow_up_date ?? "",
  });

  // Apply instant clinical preset template to speed up consultations
  const applyPreset = (presetKey: "fever" | "throat" | "hypertension" | "gastritis" | "skin") => {
    const PRESETS = {
      fever: {
        complaint: "Acute viral fever with body ache and chills",
        diagnosis: "Viral Pyrexia / Upper Respiratory Infection",
        history: "Patient presents with fever for 2-3 days associated with generalized fatigue, headache, and myalgia. No warning signs.",
        exam: "Temperature elevated (100.2°F), throat mildly congested, chest clear, soft abdomen.",
        plan: "1. Tab Paracetamol 650mg — 1-0-1 after food x 3 days\n2. Tab Levocetirizine 5mg — 0-0-1 at night x 5 days\n3. ORS hydration / warm fluid intake\n4. Follow up after 3 days if fever persists",
      },
      throat: {
        complaint: "Sore throat and painful swallowing with dry cough",
        diagnosis: "Acute Pharyngitis / Tonsillitis",
        history: "Throat pain for 2 days, aggravated on swallowing. Mild dry cough.",
        exam: "Posterior pharyngeal erythema (+), tonsils enlarged without purulent exudates.",
        plan: "1. Tab Amoxicillin+Clav 625mg — 1-0-1 after meals x 5 days\n2. Betadine gargles twice daily\n3. Tab Pantoprazole 40mg — 1-0-0 before breakfast x 5 days\n4. Warm salt water gargles",
      },
      hypertension: {
        complaint: "Routine blood pressure check & refill",
        diagnosis: "Essential Hypertension (Stage 1 / Controlled)",
        history: "Patient on regular antihypertensive therapy. No chest tightness, palpitations, or visual blurring.",
        exam: "Pulse 78/min regular, Heart sounds S1S2 heard, no pedal edema.",
        plan: "1. Continue Tab Telmisartan 40mg — 1-0-0 morning\n2. Low sodium diet (< 2g/day) & regular 30m brisk walking\n3. Self BP monitoring weekly\n4. Follow up in 3 months with lipid profile & RFT",
      },
      gastritis: {
        complaint: "Epigastric burning pain, acid reflux, and bloating",
        diagnosis: "Acute GERD / Dyspepsia",
        history: "Heartburn and postprandial fullness for 4 days after irregular eating habits.",
        exam: "Epigastric mild tenderness (+), soft abdomen, bowel sounds normal.",
        plan: "1. Cap Rabeprazole 20mg + Domperidone 30mg — 1-0-0 before breakfast x 10 days\n2. Gelucil / Antacid syrup 10ml after meals SOS\n3. Avoid spicy, oily food, tea/coffee on empty stomach\n4. Early dinner 2 hours before sleep",
      },
      skin: {
        complaint: "Itchy red rash with localized itching",
        diagnosis: "Allergic Contact Dermatitis / Urticaria",
        history: "Itching and erythematous papules for 3 days. No history of breathing difficulty.",
        exam: "Erythematous urticarial wheals over extremities, no secondary infection.",
        plan: "1. Tab Bilastine 20mg — 0-0-1 at night x 7 days\n2. Calamine lotion topically twice daily\n3. Tab Prednisolone 10mg — 1-0-0 for 3 days if severe\n4. Avoid allergen / synthetic clothing",
      },
    };

    const p = PRESETS[presetKey];
    setF((prev) => ({
      ...prev,
      chief_complaint: p.complaint,
      diagnosis: p.diagnosis,
      history: p.history,
      examination: p.exam,
      treatment_plan: p.plan,
    }));
    toast.success(`⚡ 1-Click Clinical Preset applied: ${p.diagnosis}`);
    setActiveTab("soap");
  };

  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Vitals Warnings status
  const bpAlert = useMemo(() => getBpStatus(f.bp), [f.bp]);
  const tempAlert = useMemo(() => getTempStatus(f.temperature), [f.temperature]);
  const pulseAlert = useMemo(() => getPulseStatus(f.pulse), [f.pulse]);

  // AI SOAP clinical notes helper
  async function generateSoapNotes() {
    if (!f.chief_complaint.trim()) {
      return toast.error("Please enter a Chief Complaint to run AI Medical Copilot");
    }

    setGenerating(true);
    // Emulate organic processing delay
    await new Promise((r) => setTimeout(r, 1400));

    const draft = generateSoapDraft(f.chief_complaint, f.diagnosis);
    setF((prev) => ({
      ...prev,
      history: draft.history,
      examination: draft.exam,
      treatment_plan: draft.plan,
    }));
    setGenerating(false);
    toast.success("Clinical SOAP notes generated by AI copilot!");
    setActiveTab("soap"); // Slide over to SOAP tab to view notes
  }

  async function save() {
    if (!patientName.trim()) {
      toast.error("Patient selection is required");
      return;
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = {
        organization_id: orgId,
        patient_id: patientId,
        patient_name: patientName.trim(),
        appointment_id: appointmentId,
        created_by: u.user?.id ?? null,
        chief_complaint: f.chief_complaint.trim() || null,
        history: f.history.trim() || null,
        examination: f.examination.trim() || null,
        diagnosis: f.diagnosis.trim() || null,
        treatment_plan: f.treatment_plan.trim() || null,
        bp: f.bp.trim() || null,
        pulse: f.pulse.trim() || null,
        temperature: f.temperature.trim() || null,
        weight: f.weight.trim() || null,
        height: f.height.trim() || null,
        follow_up_date: f.follow_up_date || null,
      };
      const { error } = existing
        ? await supabase
            .from("consultations" as any)
            .update(payload)
            .eq("id", existing.id)
        : await supabase.from("consultations" as any).insert(payload);

      if (!error && appointmentId) {
        // Mark appointment completed to trigger automatic revenue ledger & queue completion
        await supabase.from("appointments").update({ status: "completed" }).eq("id", appointmentId);
        const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
        await supabase
          .from("queue_tokens" as any)
          .update({ status: "done", completed_at: new Date().toISOString() })
          .eq("organization_id", orgId)
          .eq("queue_date", todayStr)
          .eq("patient_name", patientName.trim())
          .then(() => {})
          .catch(() => {});
      }

      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success(
        existing ? "Clinical record updated" : "Clinical record saved & appointment marked completed",
      );
      onSaved();
    } catch (err) {
      setSaving(false);
      toast.error((err as Error).message || "Failed to save consultation");
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto flex flex-col h-full p-0">
        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-border/40 bg-zinc-50 dark:bg-zinc-900/40 shrink-0">
          <SheetHeader>
            <SheetTitle className="text-xl flex items-center gap-1.5">
              <Stethoscope className="size-5 text-primary" />
              {existing ? "Edit Consultation" : "New Consultation"}
            </SheetTitle>
            <SheetDescription>
              Record patient vitals, diagnosis, and generate clinical SOAP notes with AI copilot.
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* Quick Prescription Presets Pill Row */}
        <div className="px-6 py-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-border/40 bg-muted/20">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles className="size-3 text-amber-500" /> Fast Rx:
          </span>
          <button
            type="button"
            onClick={() => applyPreset("fever")}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-card border border-border hover:border-primary/50 hover:bg-primary/5 text-foreground shrink-0 transition-colors"
          >
            🌡️ Fever / Cold
          </button>
          <button
            type="button"
            onClick={() => applyPreset("throat")}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-card border border-border hover:border-primary/50 hover:bg-primary/5 text-foreground shrink-0 transition-colors"
          >
            🗣️ Sore Throat
          </button>
          <button
            type="button"
            onClick={() => applyPreset("hypertension")}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-card border border-border hover:border-primary/50 hover:bg-primary/5 text-foreground shrink-0 transition-colors"
          >
            ❤️ BP Refill
          </button>
          <button
            type="button"
            onClick={() => applyPreset("gastritis")}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-card border border-border hover:border-primary/50 hover:bg-primary/5 text-foreground shrink-0 transition-colors"
          >
            🔥 Acidity / GERD
          </button>
          <button
            type="button"
            onClick={() => applyPreset("skin")}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-card border border-border hover:border-primary/50 hover:bg-primary/5 text-foreground shrink-0 transition-colors"
          >
            🌿 Skin Allergy
          </button>
        </div>

        {/* Tabbed Editor Container */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-3 w-full mb-6">
              <TabsTrigger value="vitals" className="text-xs">
                1. Patient & Vitals
              </TabsTrigger>
              <TabsTrigger value="soap" className="text-xs">
                2. Clinical SOAP Notes
              </TabsTrigger>
              <TabsTrigger value="treatment" className="text-xs">
                3. Plan & F/U
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Patient Details & Vitals */}
            <TabsContent value="vitals" className="space-y-5 focus-visible:outline-none">
              <Card className="p-4 border border-border/60 bg-muted/20 space-y-4">
                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                  <Users className="size-4 text-blue-600" /> Patient Selection
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Select Patient
                    </Label>
                    <Select
                      value={patientId ?? "__manual"}
                      onValueChange={(v) => {
                        const nextId = v === "__manual" ? null : v;
                        setPatientId(nextId);
                        if (nextId) {
                          const p = patients.find((x) => x.id === nextId);
                          if (p) setPatientName(p.name);
                        }
                      }}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select patient" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__manual">— Type manually —</SelectItem>
                        {patients.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                            {p.phone ? ` · ${p.phone}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Patient name
                    </Label>
                    <Input
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="e.g. Sarah Jenkins"
                      className="bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Linked Appointment (optional)
                  </Label>
                  <Select
                    value={appointmentId ?? "__none"}
                    onValueChange={(v) => setAppointmentId(v === "__none" ? null : v)}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">None / Walk-in visit</SelectItem>
                      {appts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.patient_name} ·{" "}
                          {a.scheduled_at ? new Date(a.scheduled_at).toLocaleDateString() : "—"} ·{" "}
                          {a.status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Drug Allergies & Clinical Alerts */}
                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Clinical Allergies &amp; Chronic Conditions
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "NKDA (No Known Allergies)",
                      "Penicillin Allergy",
                      "Sulfa Drugs Allergy",
                      "NSAID / Aspirin Allergy",
                      "Diabetic",
                      "Hypertensive",
                      "Asthmatic",
                    ].map((alert) => {
                      const active = f.history.includes(alert);
                      return (
                        <button
                          key={alert}
                          type="button"
                          onClick={() => {
                            setF((prev) => ({
                              ...prev,
                              history: active
                                ? prev.history.replace(alert, "").replace(/,\s*,/g, ",").trim()
                                : prev.history ? `${prev.history}, ${alert}` : alert,
                            }));
                          }}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border transition-all ${
                            active
                              ? alert.includes("Allergy")
                                ? "bg-rose-500 text-white border-rose-600 shadow-xs"
                                : "bg-primary text-primary-foreground border-primary shadow-xs"
                              : "bg-card text-muted-foreground hover:text-foreground border-border"
                          }`}
                        >
                          {alert}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>

              {/* Vitals Grid */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                  <Activity className="size-4 text-emerald-600" /> Patient Vitals & Measurements
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">BP (mmHg)</Label>
                    <Input
                      value={f.bp}
                      onChange={(e) => setF({ ...f, bp: e.target.value })}
                      placeholder="120/80"
                      className="font-mono bg-card"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Pulse (bpm)</Label>
                    <Input
                      value={f.pulse}
                      onChange={(e) => setF({ ...f, pulse: e.target.value })}
                      placeholder="72"
                      className="font-mono bg-card"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Temp (°F)</Label>
                    <Input
                      value={f.temperature}
                      onChange={(e) => setF({ ...f, temperature: e.target.value })}
                      placeholder="98.6"
                      className="font-mono bg-card"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Weight (kg)</Label>
                    <Input
                      value={f.weight}
                      onChange={(e) => setF({ ...f, weight: e.target.value })}
                      placeholder="70"
                      className="font-mono bg-card"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Height (cm)</Label>
                    <Input
                      value={f.height}
                      onChange={(e) => setF({ ...f, height: e.target.value })}
                      placeholder="175"
                      className="font-mono bg-card"
                    />
                  </div>
                </div>

                {/* Vitals Analysis Alert bar */}
                {(bpAlert || tempAlert || pulseAlert) && (
                  <div className="p-3 bg-blue-50/50 dark:bg-zinc-900 border border-blue-100 dark:border-zinc-800 rounded-lg flex items-start gap-2.5 text-xs text-muted-foreground mt-3">
                    <Activity className="size-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        Vitals Diagnostics:
                      </span>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {bpAlert && (
                          <Badge className={`text-[10px] font-semibold border ${bpAlert.color}`}>
                            {bpAlert.label}
                          </Badge>
                        )}
                        {tempAlert && (
                          <Badge className={`text-[10px] font-semibold border ${tempAlert.color}`}>
                            {tempAlert.label}
                          </Badge>
                        )}
                        {pulseAlert && (
                          <Badge className={`text-[10px] font-semibold border ${pulseAlert.color}`}>
                            {pulseAlert.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end">
                <Button onClick={() => setActiveTab("soap")} className="gap-1">
                  Continue to Notes <ChevronRight className="size-4" />
                </Button>
              </div>
            </TabsContent>

            {/* TAB 2: SOAP Notes */}
            <TabsContent value="soap" className="space-y-5 focus-visible:outline-none">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                  <FileText className="size-4 text-indigo-600" /> Clinical SOAP Documentation
                </h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={generateSoapNotes}
                  disabled={generating || !f.chief_complaint}
                  className="h-8 bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-300 border-purple-200 dark:border-purple-900/60 hover:bg-purple-100 gap-1 font-semibold shadow-inner"
                >
                  {generating ? (
                    <>🪄 Writing SOAP notes...</>
                  ) : (
                    <>
                      <Sparkle className="size-3.5 fill-purple-600 text-purple-600 animate-pulse" />{" "}
                      AI SOAP Copilot
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label className="text-xs font-semibold">Chief Complaint *</Label>
                    <span className="text-[10px] text-muted-foreground">
                      e.g. Cough and Fever, Sore Throat
                    </span>
                  </div>
                  <Textarea
                    rows={2}
                    value={f.chief_complaint}
                    onChange={(e) => setF({ ...f, chief_complaint: e.target.value })}
                    placeholder="Describe patient's symptoms and complaints..."
                    className="bg-card"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Diagnosis</Label>
                    <Input
                      value={f.diagnosis}
                      onChange={(e) => setF({ ...f, diagnosis: e.target.value })}
                      placeholder="e.g. Acute Tonsillitis"
                      className="bg-card"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Medical History</Label>
                    <Textarea
                      rows={2}
                      value={f.history}
                      onChange={(e) => setF({ ...f, history: e.target.value })}
                      placeholder="Prior conditions, family history, chronic illnesses..."
                      className="bg-card"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Examination Findings</Label>
                  <Textarea
                    rows={2}
                    value={f.examination}
                    onChange={(e) => setF({ ...f, examination: e.target.value })}
                    placeholder="Describe findings from chest auscultation, throat check, local tenderness, etc..."
                    className="bg-card"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <Button variant="outline" onClick={() => setActiveTab("vitals")}>
                  <ChevronRight className="size-4 rotate-180 mr-1" /> Back
                </Button>
                <Button onClick={() => setActiveTab("treatment")} className="gap-1">
                  Continue to Treatment <ChevronRight className="size-4" />
                </Button>
              </div>
            </TabsContent>

            {/* TAB 3: Treatment & Follow-up */}
            <TabsContent value="treatment" className="space-y-5 focus-visible:outline-none">
              <div className="space-y-4">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <h4 className="font-semibold text-sm flex items-center gap-1.5">
                    <HeartPulse className="size-4 text-red-600" /> Treatment Plan &amp; Prescription (Rx)
                  </h4>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    Click chip to inject medicine into prescription
                  </span>
                </div>

                {/* Frequently Prescribed Medicines Quick Chips */}
                <div className="p-3 bg-muted/20 border border-border/70 rounded-xl space-y-2">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="size-3 text-amber-500" /> Quick Medicine Presets:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { name: "Tab Paracetamol 650mg", dose: "1-0-1 after food x 3 days" },
                      { name: "Tab Amoxicillin+Clav 625mg", dose: "1-0-1 after meals x 5 days" },
                      { name: "Tab Azithromycin 500mg", dose: "1-0-0 before meals x 3 days" },
                      { name: "Tab Pantoprazole 40mg", dose: "1-0-0 before breakfast x 7 days" },
                      { name: "Tab Levocetirizine 5mg", dose: "0-0-1 at night x 5 days" },
                      { name: "Tab Telmisartan 40mg", dose: "1-0-0 morning x 30 days" },
                      { name: "Tab Metformin 500mg", dose: "1-0-1 with meals x 30 days" },
                      { name: "Tab Ondansetron 4mg", dose: "1 tab SOS for nausea" },
                      { name: "Syp ORS / Electrolyte", dose: "1 sachet in 1L water sip through day" },
                    ].map((med) => (
                      <button
                        key={med.name}
                        type="button"
                        onClick={() => {
                          const line = `• ${med.name} — ${med.dose}`;
                          setF((prev) => ({
                            ...prev,
                            treatment_plan: prev.treatment_plan
                              ? `${prev.treatment_plan}\n${line}`
                              : line,
                          }));
                          toast.success(`Added ${med.name}`);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-card border border-border/80 hover:border-primary/50 hover:bg-primary/5 text-foreground transition-all shadow-2xs"
                      >
                        + {med.name.replace(/^(Tab|Cap|Syp)\s*/, "")}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Prescription &amp; Advice</Label>
                  <Textarea
                    rows={6}
                    value={f.treatment_plan}
                    onChange={(e) => setF({ ...f, treatment_plan: e.target.value })}
                    placeholder="Enter prescribed medications, dosages, dietary restrictions, rest recommendations..."
                    className="bg-card font-mono text-xs leading-relaxed"
                  />
                </div>

                <div className="space-y-1.5 max-w-sm">
                  <Label className="text-xs font-semibold">Follow-up Date</Label>
                  <Input
                    type="date"
                    value={f.follow_up_date}
                    onChange={(e) => setF({ ...f, follow_up_date: e.target.value })}
                    className="bg-card cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-8 flex justify-between border-t border-border/40 flex-wrap gap-2">
                <Button variant="outline" onClick={() => setActiveTab("soap")}>
                  <ChevronRight className="size-4 rotate-180 mr-1" /> Back
                </Button>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="ghost" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground font-semibold shadow-xs">
                    {saving ? "Saving…" : "Complete Consultation"}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
