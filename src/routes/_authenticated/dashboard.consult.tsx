import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  Copy,
  RotateCcw,
  Volume2,
  AlertCircle,
  HelpCircle,
  Check,
  Share2,
  X,
  History,
  ShieldCheck,
  Flame,
  Video,
  Eye,
  Pill,
} from "lucide-react";
import { AppGuard } from "@/components/app/AppGuard";
import { useOrganization } from "@/hooks/useOrganization";
import { useClinic } from "./dashboard";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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

type PatientOpt = { id: string; name: string; phone: string | null; age?: number | null; gender?: string | null };

function escapeHtml(str?: string | null): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function playAudioChime(type: "call" | "complete" = "complete") {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "complete") {
      // Pleasant double chord (C5 -> G5)
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else {
      // Bell chime for calling next patient (E5 -> A5)
      osc.frequency.setValueAtTime(659.25, ctx.currentTime);
      osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch {
    // Audio restricted until first user interaction
  }
}

function getBpStatus(bp: string) {
  if (!bp || !bp.includes("/")) return null;
  const [sysStr, diaStr] = bp.split("/");
  const sys = parseInt(sysStr);
  const dia = parseInt(diaStr);
  if (isNaN(sys) || isNaN(dia)) return null;
  if (sys >= 140 || dia >= 90)
    return { label: "⚠️ High BP (HTN)", color: "text-red-700 bg-red-500/15 border-red-500/30" };
  if (sys < 90 || dia < 60)
    return { label: "⚠️ Low BP", color: "text-blue-700 bg-blue-500/15 border-blue-500/30" };
  return { label: "✓ Normal BP", color: "text-emerald-700 bg-emerald-500/15 border-emerald-500/30" };
}

function getTempStatus(temp: string) {
  if (!temp) return null;
  const t = parseFloat(temp);
  if (isNaN(t)) return null;
  if (t >= 100.4)
    return { label: "🔥 High Fever (≥100.4°)", color: "text-red-700 bg-red-500/15 border-red-500/30" };
  if (t >= 99.0)
    return { label: "🌡️ Mild Fever", color: "text-amber-700 bg-amber-500/15 border-amber-500/30" };
  return { label: "✓ Normal Temp", color: "text-emerald-700 bg-emerald-500/15 border-emerald-500/30" };
}

function getSpo2Status(spo2: string) {
  if (!spo2) return null;
  const s = parseFloat(spo2);
  if (isNaN(s)) return null;
  if (s < 90)
    return { label: "🚨 Critical SpO2 (<90%)", color: "text-red-700 bg-red-500/15 border-red-500/30" };
  if (s < 95)
    return { label: "⚠️ Low SpO2 (<95%)", color: "text-amber-700 bg-amber-500/15 border-amber-500/30" };
  return { label: "✓ SpO2 Normal (≥95%)", color: "text-emerald-700 bg-emerald-500/15 border-emerald-500/30" };
}

function getBloodSugarStatus(sugar: string) {
  if (!sugar) return null;
  const s = parseFloat(sugar);
  if (isNaN(s)) return null;
  if (s < 70)
    return { label: "⚠️ Hypoglycemia (<70)", color: "text-red-700 bg-red-500/15 border-red-500/30" };
  if (s >= 200)
    return { label: "⚠️ High Blood Sugar (≥200)", color: "text-red-700 bg-red-500/15 border-red-500/30" };
  if (s >= 140)
    return { label: "⚠️ Elevated Sugar (≥140)", color: "text-amber-700 bg-amber-500/15 border-amber-500/30" };
  return { label: "✓ Sugar Normal", color: "text-emerald-700 bg-emerald-500/15 border-emerald-500/30" };
}

function getBmi(weightKg: string, heightCm: string) {
  const w = parseFloat(weightKg);
  const h = parseFloat(heightCm);
  if (isNaN(w) || isNaN(h) || h <= 0) return null;
  const bmiVal = (w / ((h / 100) * (h / 100))).toFixed(1);
  const num = parseFloat(bmiVal);
  let category = "Normal";
  let color = "text-emerald-700 bg-emerald-500/15 border-emerald-500/30";
  if (num < 18.5) {
    category = "Underweight";
    color = "text-blue-700 bg-blue-500/15 border-blue-500/30";
  } else if (num >= 25 && num < 30) {
    category = "Overweight";
    color = "text-amber-700 bg-amber-500/15 border-amber-500/30";
  } else if (num >= 30) {
    category = "Obese";
    color = "text-red-700 bg-red-500/15 border-red-500/30";
  }
  return { val: bmiVal, category, color };
}

const PRESETS: Record<string, { label: string; complaint: string; diagnosis: string; history: string; plan: string; followUpDays: number }> = {
  fever: {
    label: "🌡️ Viral Fever / URI",
    complaint: "Acute fever with chills, body ache, and general fatigue for 2-3 days",
    diagnosis: "Acute Viral Pyrexia / Upper Respiratory Infection",
    history: "Sudden onset fever, mild nasal congestion. No chest pain or respiratory distress.",
    plan: "• Tab Paracetamol 650mg — 1-0-1 after food x 3 days\n• Tab Levocetirizine 5mg — 0-0-1 at night x 5 days\n• Cap Pantoprazole 40mg — 1-0-0 before breakfast x 5 days\n• Syp ORS / Electral — 1 sachet in 1L water sip continuously\n• Rest, plenty of warm fluids & sponge bath if temp > 101°F.",
    followUpDays: 3,
  },
  throat: {
    label: "🗣️ Sore Throat / Tonsils",
    complaint: "Throat pain, painful swallowing (odynophagia), and dry cough for 2 days",
    diagnosis: "Acute Pharyngitis / Follicular Tonsillitis",
    history: "Sore throat aggravated by cold fluids. Mild anterior cervical tenderness.",
    plan: "• Tab Amoxicillin+Clav 625mg — 1-0-1 after meals x 5 days\n• Tab Aceclofenac + Paracetamol — 1-0-1 after food x 3 days SOS\n• Cap Pantoprazole 40mg — 1-0-0 before breakfast x 5 days\n• Betadine Gargles (2%) — twice daily in warm water\n• Avoid cold/oily food and aerated drinks.",
    followUpDays: 5,
  },
  cough: {
    label: "🫁 Productive Cough / Bronchitis",
    complaint: "Persistent cough with yellow/white phlegm, chest congestion, and nocturnal coughing",
    diagnosis: "Acute Bronchitis with Bronchospasm",
    history: "Cough started following upper respiratory infection. Non-smoker, no hemoptysis.",
    plan: "• Syp Ascoril-D / Ambroxol — 10ml thrice daily after food x 5 days\n• Tab Azithromycin 500mg — 1-0-0 before meals x 3 days\n• Tab Montelukast+Levocet 10/5 — 0-0-1 at bedtime x 7 days\n• Cap Pantoprazole 40mg — 1-0-0 before breakfast x 5 days\n• Steam inhalation twice daily. Avoid chilled liquids.",
    followUpDays: 5,
  },
  hypertension: {
    label: "❤️ BP Refill / HTN",
    complaint: "Routine monthly blood pressure check-up and medication refill",
    diagnosis: "Essential Hypertension (Stage 1 / Controlled)",
    history: "Known hypertensive on regular treatment. No headache, chest pain, or palpitations.",
    plan: "• Tab Telmisartan 40mg — 1-0-0 morning x 30 days\n• Tab Amlodipine 5mg — 0-0-1 night (if BP > 140/90)\n• Low sodium diet (< 2g/day), restrict papad/pickles\n• 30 mins brisk walking daily. Self BP monitoring weekly.",
    followUpDays: 30,
  },
  diabetes: {
    label: "🩸 Diabetes Refill",
    complaint: "Routine blood glucose monitoring & medication refill",
    diagnosis: "Type 2 Diabetes Mellitus (Controlled)",
    history: "Diabetic on oral hypoglycemics. No polyuria, polydipsia, or hypoglycemic spells.",
    plan: "• Tab Metformin 500mg SR — 1-0-1 with meals x 30 days\n• Tab Glimepiride 1mg — 1-0-0 before breakfast x 30 days\n• Cap B-Complex with Zinc — 0-1-0 after lunch x 30 days\n• Strict diabetic diet, zero refined sugar, daily foot inspection\n• Fasting & PP blood sugar test before next review.",
    followUpDays: 30,
  },
  gastritis: {
    label: "🔥 Acidity / GERD",
    complaint: "Heartburn, retrosternal burning, and acid regurgitation after meals",
    diagnosis: "Gastroesophageal Reflux Disease (GERD) / Dyspepsia",
    history: "Epigastric discomfort and bloating for 4 days after irregular eating habits.",
    plan: "• Cap Rabeprazole 20mg + Domperidone 30mg — 1-0-0 before breakfast x 10 days\n• Syp Gelusil / Digene — 10ml after food x 5 days SOS\n• Tab Ondansetron 4mg — 1 tab SOS for nausea\n• Avoid spicy, fried foods, tea/coffee on empty stomach\n• Maintain 2 hours gap between dinner and sleeping.",
    followUpDays: 7,
  },
  gastro: {
    label: "🤢 Diarrhea / Loose Stools",
    complaint: "Frequent watery stools (4-5 episodes), mild cramping, and nausea",
    diagnosis: "Acute Gastroenteritis / Food-Borne Infection",
    history: "Sudden onset loose motions following outside food intake. Mild dehydration.",
    plan: "• Tab Ofloxacin 200mg + Ornidazole 500mg — 1-0-1 after meals x 3 days\n• Tab Ondansetron 4mg — 1 tab SOS for vomiting\n• Cap Racecadotril 100mg — 1-1-1 before meals x 2 days\n• Syp ORS Electral — 1 sachet in 1L water sip continuously\n• Bland diet: curd rice, light khichdi, avoid milk and spicy food.",
    followUpDays: 3,
  },
  migraine: {
    label: "⚡ Headache / Migraine",
    complaint: "Unilateral throbbing headache with photophobia and nausea for 24 hours",
    diagnosis: "Acute Migraine Attack without Aura",
    history: "Triggered by lack of sleep and screen strain. No visual disturbances.",
    plan: "• Tab Naproxen 500mg + Domperidone 10mg — 1 tab SOS at onset of headache\n• Tab Paracetamol 650mg — 1 tab SOS if pain persists after 4 hours\n• Cap Pantoprazole 40mg — 1-0-0 before breakfast x 3 days\n• Rest in a dark, quiet room; maintain adequate hydration.\n• Review if pain worsens or recurs frequently.",
    followUpDays: 7,
  },
  uti: {
    label: "💧 UTI / Dysuria",
    complaint: "Burning micturition, increased urinary frequency, and lower abdominal heaviness",
    diagnosis: "Acute Uncomplicated Lower Urinary Tract Infection (UTI)",
    history: "No fever, flank pain, or hematuria. Adequate oral intake.",
    plan: "• Tab Nitrofurantoin 100mg SR — 1-0-1 after food x 5 days\n• Syp Citralka (Disodium Hydrogen Citrate) — 2 tsp in glass of water thrice daily x 5 days\n• Tab Paracetamol 650mg — 1-0-1 after food x 3 days SOS\n• Drink 3 to 4 liters of water daily. Clean personal hygiene.",
    followUpDays: 5,
  },
  allergy: {
    label: "🌿 Skin Allergy / Rash",
    complaint: "Intense generalized itching with erythematous raised rashes / hives",
    diagnosis: "Acute Urticaria / Allergic Contact Dermatitis",
    history: "Itching and wheals started 24h ago. No breathing difficulty or lip swelling.",
    plan: "• Tab Bilastine 20mg — 0-0-1 at bedtime x 7 days\n• Tab Montelukast+Levocet 10/5 — 0-0-1 at night x 5 days\n• Calamine Lotion — apply gently over itchy areas twice daily\n• Cap Pantoprazole 40mg — 1-0-0 before breakfast x 7 days\n• Avoid synthetic clothes, hot water bath, and suspected food triggers.",
    followUpDays: 5,
  },
  bodyache: {
    label: "🦴 Body Ache / Myalgia",
    complaint: "Generalized body ache, muscular fatigue, and back stiffness",
    diagnosis: "Acute Musculoskeletal Strain / Myalgia",
    history: "Physical exertion and poor posture leading to lumbar and neck stiffness.",
    plan: "• Tab Aceclofenac 100mg + Paracetamol 325mg — 1-0-1 after food x 5 days\n• Cap Thiocolchicoside 4mg — 1-0-1 after food x 3 days\n• Cap Pantoprazole 40mg — 1-0-0 before breakfast x 5 days\n• Hot fomentation 15 mins twice daily & posture ergonomics\n• Avoid heavy lifting for 1 week.",
    followUpDays: 7,
  },
};

const COMMON_DIAGNOSES = [
  "Acute Viral URI / Pyrexia",
  "Acute Pharyngitis / Tonsillitis",
  "Acute Bronchitis",
  "Essential HTN (Stage 1)",
  "Type 2 Diabetes Mellitus",
  "GERD / Dyspepsia",
  "Acute Gastroenteritis",
  "Acute Migraine Attack",
  "Acute Lower UTI",
  "Musculoskeletal Strain / Backache",
  "Allergic Rhinitis / Sinusitis",
  "Acute Urticaria / Skin Rash",
];

const FAST_MEDS = [
  { name: "Tab Paracetamol 650mg", dose: "1-0-1 after food x 3 days" },
  { name: "Tab Augmentin 625mg (Amox-Clav)", dose: "1-0-1 after meals x 5 days" },
  { name: "Tab Azithromycin 500mg", dose: "1-0-0 before meals x 3 days" },
  { name: "Tab Aceclofenac+Paracetamol", dose: "1-0-1 after food x 3 days SOS" },
  { name: "Cap Pantoprazole 40mg+Domp", dose: "1-0-0 before breakfast x 7 days" },
  { name: "Tab Levocetirizine 5mg", dose: "0-0-1 at night x 5 days" },
  { name: "Tab Montelukast+Levocet 10/5", dose: "0-0-1 at night x 7 days" },
  { name: "Tab Telmisartan 40mg", dose: "1-0-0 morning x 30 days" },
  { name: "Tab Metformin 500mg", dose: "1-0-1 with meals x 30 days" },
  { name: "Tab Ondansetron 4mg", dose: "1 tab SOS for nausea" },
  { name: "Tab Ofloxacin+Ornidazole", dose: "1-0-1 after meals x 3 days" },
  { name: "Syp ORS / Electral Sachet", dose: "1 sachet in 1L water sip through day" },
  { name: "Cap B-Complex with Zinc", dose: "0-1-0 after lunch x 15 days" },
  { name: "Tab Vitamin D3 60k IU", dose: "1 cap once weekly x 8 weeks" },
  { name: "Tab Nitrofurantoin 100mg SR", dose: "1-0-1 after food x 5 days" },
  { name: "Syp Ascoril-D Cough Syrup", dose: "10ml thrice daily x 5 days" },
  { name: "Tab Bilastine 20mg", dose: "0-0-1 at bedtime x 7 days" },
  { name: "Tab Amlodipine 5mg", dose: "0-0-1 at night x 30 days" },
];

const MED_CATEGORIES: { name: string; meds: { name: string; dose: string }[] }[] = [
  {
    name: "Common OPD",
    meds: [
      { name: "Tab Paracetamol 650mg", dose: "1-0-1 after food x 3 days" },
      { name: "Tab Aceclofenac+Paracetamol", dose: "1-0-1 after food x 3 days SOS" },
      { name: "Cap Pantoprazole 40mg+Domp", dose: "1-0-0 before breakfast x 7 days" },
      { name: "Tab Levocetirizine 5mg", dose: "0-0-1 at night x 5 days" },
      { name: "Syp ORS / Electral Sachet", dose: "1 sachet in 1L water sip through day" },
    ],
  },
  {
    name: "Antibiotics",
    meds: [
      { name: "Tab Augmentin 625mg (Amox-Clav)", dose: "1-0-1 after meals x 5 days" },
      { name: "Tab Azithromycin 500mg", dose: "1-0-0 before meals x 3 days" },
      { name: "Tab Ofloxacin+Ornidazole", dose: "1-0-1 after meals x 3 days" },
      { name: "Tab Nitrofurantoin 100mg SR", dose: "1-0-1 after food x 5 days" },
      { name: "Tab Cefixime 200mg", dose: "1-0-1 after food x 5 days" },
    ],
  },
  {
    name: "GI & Acidity",
    meds: [
      { name: "Cap Pantoprazole 40mg+Domp", dose: "1-0-0 before breakfast x 7 days" },
      { name: "Cap Rabeprazole 20mg+Domp", dose: "1-0-0 before breakfast x 10 days" },
      { name: "Tab Ondansetron 4mg", dose: "1 tab SOS for nausea" },
      { name: "Cap Racecadotril 100mg", dose: "1-1-1 before meals x 2 days" },
      { name: "Syp Gelusil / Digene", dose: "10ml after meals x 5 days SOS" },
    ],
  },
  {
    name: "Cough & Allergy",
    meds: [
      { name: "Tab Montelukast+Levocet 10/5", dose: "0-0-1 at night x 7 days" },
      { name: "Tab Levocetirizine 5mg", dose: "0-0-1 at night x 5 days" },
      { name: "Tab Bilastine 20mg", dose: "0-0-1 at bedtime x 7 days" },
      { name: "Syp Ascoril-D Cough Syrup", dose: "10ml thrice daily x 5 days" },
    ],
  },
  {
    name: "Chronic (BP/DM)",
    meds: [
      { name: "Tab Telmisartan 40mg", dose: "1-0-0 morning x 30 days" },
      { name: "Tab Amlodipine 5mg", dose: "0-0-1 night x 30 days" },
      { name: "Tab Metformin 500mg", dose: "1-0-1 with meals x 30 days" },
      { name: "Tab Glimepiride 1mg", dose: "1-0-0 before breakfast x 30 days" },
    ],
  },
  {
    name: "Vitamins",
    meds: [
      { name: "Cap B-Complex with Zinc", dose: "0-1-0 after lunch x 15 days" },
      { name: "Tab Vitamin D3 60k IU", dose: "1 cap once weekly x 8 weeks" },
      { name: "Tab Calcium 500mg+Vit D3", dose: "0-0-1 after dinner x 30 days" },
    ],
  },
];

function todayDateStr(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  } catch {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}

const DRAFT_STORAGE_KEY = "clinicx_consult_draft_v2";

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
  const [queueFilter, setQueueFilter] = useState<"all" | "waiting" | "serving" | "done">("all");

  // Active Patient in Cockpit
  const [selectedPatient, setSelectedPatient] = useState<QueuePatient | null>(null);

  // Form Fields
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientGender, setPatientGender] = useState("");
  const [appointmentId, setAppointmentId] = useState<string | null>(null);

  const [chiefComplaint, setChiefComplaint] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [historyNotes, setHistoryNotes] = useState("NKDA (No Known Allergies)");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [bp, setBp] = useState("");
  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [spo2, setSpo2] = useState("");
  const [bloodSugar, setBloodSugar] = useState("");
  const [temp, setTemp] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  // Voice dictation state
  const [activeRecordingField, setActiveRecordingField] = useState<"complaint" | "diagnosis" | "rx" | null>(null);
  const recognitionRef = useRef<any>(null);

  // Quick Medicine Category Filter
  const [selectedMedCategory, setSelectedMedCategory] = useState<string>("Common OPD");

  // Preview Modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // Interactive Quick Medicine Inserter State
  const [customMedName, setCustomMedName] = useState("");
  const [customMedDosage, setCustomMedDosage] = useState("1-0-1");
  const [customMedTiming, setCustomMedTiming] = useState("After meals");
  const [customMedDuration, setCustomMedDuration] = useState("5 days");

  // Patient History Drawer / Repeat Rx
  const [patientPastConsults, setPatientPastConsults] = useState<Consultation[]>([]);
  const [loadingPastConsults, setLoadingPastConsults] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState("");

  // Modals & UI States
  const [walkinModalOpen, setWalkinModalOpen] = useState(false);
  const [walkinSearch, setWalkinSearch] = useState("");
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasDraftRestored, setHasDraftRestored] = useState(false);

  // Load Data
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
          .from("queue_tokens")
          .select("*")
          .eq("queue_date", dateStr)
          .order("token_number")
          .then((r) => (r.error ? { data: [] } : r), () => ({ data: [] })),
        supabase
          .from("patients")
          .select("id, name, phone, age, gender")
          .order("name")
          .limit(200)
          .then((r) => (r.error ? { data: [] } : r)),
      ]);

      const consults = (consultRes.data as any[]) ?? [];
      setHistoryRows(consults);
      setPatients((patientRes.data as any[]) ?? []);

      // Build unified queue
      const qList: QueuePatient[] = [];
      let tokenCounter = 1;

      // Map today's appointments
      for (const a of (apptRes.data as any[]) ?? []) {
        let st: QueuePatient["status"] = "waiting";
        if (a.status === "completed") st = "done";
        else if (a.status === "serving" || a.status === "in_consultation") st = "serving";
        else if (a.status === "waiting" || a.status === "checked_in") st = "waiting";
        else if (a.status === "confirmed") st = "confirmed";

        qList.push({
          id: `appt-${a.id}`,
          source: "appointment",
          token_number: tokenCounter++,
          appointment_id: a.id,
          patient_id: a.patient_id || null,
          patient_name: a.patient_name,
          patient_phone: a.patient_phone,
          patient_age: a.patient_age,
          patient_gender: a.patient_gender,
          status: st,
          problem: a.problem,
          scheduled_at: a.scheduled_at,
        });
      }

      // Map walk-in tokens
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

      // Auto-select patient from query or next in line
      if (searchParams?.appointmentId) {
        const target = qList.find((x) => x.appointment_id === searchParams.appointmentId);
        if (target) {
          selectPatient(target);
          return;
        }
      }

      if (!selectedPatient && qList.length > 0) {
        const active =
          qList.find((x) => x.status === "serving") ||
          qList.find((x) => x.status === "waiting") ||
          qList[0];
        if (active) {
          selectPatient(active);
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

  // Real-time subscription: auto-refresh OPD queue and play chime when new walk-in / booking arrives
  useEffect(() => {
    if (!orgId) return () => {};
    const channel = supabase
      .channel(`consult-queue-live-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue_tokens",
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            playAudioChime("call");
            const newPatient = (payload.new as any)?.patient_name || "Patient";
            const newTok = (payload.new as any)?.token_number ? `#${(payload.new as any).token_number}` : "";
            toast.info(`🔔 New OPD Token ${newTok}: ${newPatient} checked in`);
          }
          void loadData();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: clinicId ? `clinic_id=eq.${clinicId}` : `organization_id=eq.${orgId}`,
        },
        () => {
          void loadData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, clinicId, loadData]);

  // Load previous consultations for currently active patient
  const loadPatientPastConsults = useCallback(async (pName: string, pPhone?: string | null) => {
    if (!pName || !pName.trim()) {
      setPatientPastConsults([]);
      return;
    }
    setLoadingPastConsults(true);
    try {
      const { data } = await supabase
        .from("consultations" as any)
        .select("*")
        .ilike("patient_name", pName.trim())
        .order("created_at", { ascending: false })
        .limit(3);
      setPatientPastConsults((data as any[]) || []);
    } catch (e) {
      console.warn("Past consult load error:", e);
    } finally {
      setLoadingPastConsults(false);
    }
  }, []);

  // Select patient into cockpit
  const selectPatient = (p: QueuePatient) => {
    setSelectedPatient(p);
    setPatientId(p.patient_id || null);
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
    setBpSystolic("");
    setBpDiastolic("");
    setPulse("");
    setSpo2("");
    setBloodSugar("");
    setTemp("");
    setWeight("");
    setHeight("");
    setFollowUpDate("");

    // Load their history
    void loadPatientPastConsults(p.patient_name, p.patient_phone);
  };

  // Sync combined BP and split systolic/diastolic
  const handleBpChange = (val: string) => {
    setBp(val);
    if (val.includes("/")) {
      const parts = val.split("/");
      setBpSystolic(parts[0]?.trim() || "");
      setBpDiastolic(parts[1]?.trim() || "");
    } else {
      setBpSystolic(val.trim());
      if (!val.trim()) setBpDiastolic("");
    }
  };

  const handleBpSystolicChange = (val: string) => {
    setBpSystolic(val);
    setBp(val && bpDiastolic ? `${val}/${bpDiastolic}` : val);
  };

  const handleBpDiastolicChange = (val: string) => {
    setBpDiastolic(val);
    setBp(bpSystolic && val ? `${bpSystolic}/${val}` : val);
  };

  // Voice Note Dictation Hook (Native Web Speech API - 0 dependencies)
  const toggleVoiceDictation = (field: "complaint" | "diagnosis" | "rx") => {
    if (activeRecordingField === field) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
      setActiveRecordingField(null);
      toast.info("Voice dictation paused");
      return;
    }

    if (activeRecordingField && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      toast.error("Voice dictation is not supported in this browser. Please type directly.");
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-IN";

      rec.onstart = () => {
        setActiveRecordingField(field);
        toast.info(
          `🎙️ Dictation active for ${field === "complaint" ? "symptoms" : field === "diagnosis" ? "diagnosis" : "prescription"}. Speak now…`
        );
      };

      rec.onresult = (e: any) => {
        let text = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            text += e.results[i][0].transcript + " ";
          }
        }
        if (text.trim()) {
          const spoken = text.trim();
          if (field === "complaint") {
            setChiefComplaint((prev) => (prev ? `${prev} ${spoken}` : spoken));
          } else if (field === "diagnosis") {
            setDiagnosis((prev) => (prev ? `${prev} ${spoken}` : spoken));
          } else if (field === "rx") {
            setTreatmentPlan((prev) => (prev ? `${prev}\n• ${spoken}` : `• ${spoken}`));
          }
        }
      };

      rec.onerror = (err: any) => {
        console.warn("Speech recognition notice:", err);
        setActiveRecordingField(null);
        if (err.error === "not-allowed") {
          toast.error("Microphone access denied. Please grant microphone permission in your browser.");
        }
      };

      rec.onend = () => {
        setActiveRecordingField(null);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.warn("Speech recognition start error:", err);
      setActiveRecordingField(null);
      toast.error("Could not start microphone. Please type directly.");
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  // 1-Click Call Patient (announces, chimes, and marks serving)
  const handleCallPatient = async (p: QueuePatient) => {
    selectPatient(p);
    playAudioChime("call");
    toast.success(`📢 Calling Token #${p.token_number}: ${p.patient_name}`);

    try {
      if (p.appointment_id) {
        await supabase
          .from("appointments")
          .update({ status: "serving" } as any)
          .eq("id", p.appointment_id);
      }
      const todayStr = todayDateStr();
      await supabase
        .from("queue_tokens")
        .update({ status: "serving", called_at: new Date().toISOString() })
        .eq("queue_date", todayStr)
        .eq("patient_name", p.patient_name.trim());

      setQueue((prev) =>
        prev.map((item) =>
          item.id === p.id ? { ...item, status: "serving" } : item
        )
      );
    } catch (e) {
      console.warn("Error updating serving status:", e);
    }
  };

  // Draft auto-save to localStorage
  useEffect(() => {
    if (!patientName && !chiefComplaint && !diagnosis && !treatmentPlan) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({
            patientName,
            patientPhone,
            patientAge,
            patientGender,
            appointmentId,
            chiefComplaint,
            diagnosis,
            treatmentPlan,
            historyNotes,
            bp,
            bpSystolic,
            bpDiastolic,
            pulse,
            spo2,
            bloodSugar,
            temp,
            weight,
            height,
            followUpDate,
            savedAt: Date.now(),
          })
        );
      } catch {}
    }, 400);
    return () => clearTimeout(timer);
  }, [
    patientName,
    patientPhone,
    patientAge,
    patientGender,
    appointmentId,
    chiefComplaint,
    diagnosis,
    treatmentPlan,
    historyNotes,
    bp,
    bpSystolic,
    bpDiastolic,
    pulse,
    spo2,
    bloodSugar,
    temp,
    weight,
    height,
    followUpDate,
  ]);

  // Check draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft && draft.patientName && Date.now() - draft.savedAt < 12 * 60 * 60 * 1000) {
          // If cockpit has no active patient loaded, offer to restore
          setHasDraftRestored(true);
        }
      }
    } catch {}
  }, []);

  const restoreDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        setPatientName(d.patientName || "");
        setPatientPhone(d.patientPhone || "");
        setPatientAge(d.patientAge || "");
        setPatientGender(d.patientGender || "");
        setAppointmentId(d.appointmentId || null);
        setChiefComplaint(d.chiefComplaint || "");
        setDiagnosis(d.diagnosis || "");
        setTreatmentPlan(d.treatmentPlan || "");
        setHistoryNotes(d.historyNotes || "NKDA");
        setBp(d.bp || "");
        setBpSystolic(d.bpSystolic || (d.bp?.includes("/") ? d.bp.split("/")[0].trim() : ""));
        setBpDiastolic(d.bpDiastolic || (d.bp?.includes("/") ? d.bp.split("/")[1].trim() : ""));
        setPulse(d.pulse || "");
        setSpo2(d.spo2 || "");
        setBloodSugar(d.bloodSugar || "");
        setTemp(d.temp || "");
        setWeight(d.weight || "");
        setHeight(d.height || "");
        setFollowUpDate(d.followUpDate || "");
        setHasDraftRestored(false);
        toast.success("Prescription draft restored successfully!");
      }
    } catch {
      toast.error("Failed to restore draft");
    }
  };

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setHasDraftRestored(false);
    toast.info("Draft discarded");
  };

  // Keyboard Shortcuts Hook (Ctrl+Enter, Ctrl+P, Ctrl+K, Ctrl+M, Ctrl+D, Ctrl+B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter or Cmd+Enter => Complete & Next
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        void handleCompleteAndNext();
      }
      // Ctrl+P or Cmd+P => Print Slip
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handlePrintSlip();
      }
      // Ctrl+K or Cmd+K => Queue Search Focus
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("consult-queue-search")?.focus();
      }
      // Ctrl+M or Cmd+M => Medicine Input Focus
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "m") {
        e.preventDefault();
        document.getElementById("custom-med-input")?.focus();
      }
      // Ctrl+D or Cmd+D => Diagnosis Focus
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        document.getElementById("consult-diagnosis-input")?.focus();
      }
      // Ctrl+B or Cmd+B => BP Focus
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        document.getElementById("consult-bp-input")?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [patientName, chiefComplaint, diagnosis, treatmentPlan, appointmentId, bp, bpSystolic, bpDiastolic, pulse, spo2, bloodSugar, temp, weight, height, followUpDate]);

  // Repeat Rx from previous visit
  const handleRepeatLastRx = () => {
    const last = patientPastConsults[0];
    if (!last) return;
    if (last.diagnosis) setDiagnosis(last.diagnosis);
    if (last.treatment_plan) setTreatmentPlan(last.treatment_plan);
    if (last.chief_complaint && !chiefComplaint) {
      setChiefComplaint(`Follow-up: ${last.chief_complaint}`);
    }
    toast.success(`Repeated prescription from ${new Date(last.created_at).toLocaleDateString("en-IN")}`);
  };

  // 1-Click Clinical Preset
  const applyPreset = (key: string) => {
    const p = PRESETS[key];
    if (!p) return;
    setChiefComplaint(p.complaint);
    setDiagnosis(p.diagnosis);
    setHistoryNotes((prev) => (prev ? `${prev}, ${p.history}` : p.history));
    setTreatmentPlan(p.plan);

    // Auto set recommended follow-up date
    const d = new Date();
    d.setDate(d.getDate() + p.followUpDays);
    setFollowUpDate(d.toISOString().slice(0, 10));

    toast.success(`⚡ 1-Click Preset Applied: ${p.label}`);
  };

  // 1-Click Quick Medicine Add
  const addMedicine = (med: { name: string; dose: string }) => {
    const line = `• ${med.name} — ${med.dose}`;
    setTreatmentPlan((prev) => (prev ? `${prev}\n${line}` : line));
    toast.success(`Added ${med.name}`);
  };

  // Custom Medicine Bar Add
  const handleAddCustomMed = () => {
    if (!customMedName.trim()) {
      toast.error("Please enter medicine name");
      return;
    }
    const line = `• ${customMedName.trim()} — ${customMedDosage} (${customMedTiming}) x ${customMedDuration}`;
    setTreatmentPlan((prev) => (prev ? `${prev}\n${line}` : line));
    setCustomMedName("");
    toast.success(`Added to Rx: ${customMedName.trim()}`);
  };

  // Allergy / Medical Tag Toggle
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
      toast.error("Please select or enter a patient name");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        organization_id: orgId || clinic?.organization_id || null,
        clinic_id: clinicId || null,
        patient_id: patientId || null,
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
      const { data: cData, error: cErr } = await supabase
        .from("consultations" as any)
        .insert(payload)
        .select("id")
        .single();
      if (cErr) throw cErr;

      // 1b. Write structured prescriptions and prescription_items for pharmacy & billing
      const effectiveOrgId = orgId || clinic?.organization_id;
      if (effectiveOrgId) {
        try {
          const { data: rxData, error: rxErr } = await supabase
            .from("prescriptions")
            .insert({
              organization_id: effectiveOrgId,
              patient_id: patientId || null,
              patient_name: patientName.trim(),
              appointment_id: appointmentId || null,
              consultation_id: (cData as any)?.id || null,
              notes: diagnosis.trim() || null,
            })
            .select("id")
            .single();

          if (!rxErr && rxData?.id && treatmentPlan.trim()) {
            const rawLines = treatmentPlan
              .split("\n")
              .map((l) => l.replace(/^[•\-\*\d\.\s]+/, "").trim())
              .filter(Boolean);

            if (rawLines.length > 0) {
              const rxItems = rawLines.map((line, idx) => {
                const parts = line.split("—").map((p) => p.trim());
                const drugName = parts[0] || line;
                const doseOrInstructions = parts[1] || "";
                return {
                  prescription_id: rxData.id,
                  organization_id: effectiveOrgId,
                  drug_name: drugName.slice(0, 100),
                  dose: doseOrInstructions ? doseOrInstructions.slice(0, 100) : null,
                  instructions: doseOrInstructions || null,
                  position: idx + 1,
                };
              });
              await supabase.from("prescription_items").insert(rxItems);

              // Sync to Patient Universal Health Timeline cache
              if (typeof window !== "undefined") {
                try {
                  const savedRecs = JSON.parse(localStorage.getItem("clinicx_patient_records") || "[]");
                  const newTimelineRec = {
                    id: "rec-" + Date.now(),
                    memberId: "fam-1",
                    type: "prescription",
                    title: "OPD Digital Prescription",
                    doctorName: clinic?.doctor_name ? `Dr. ${clinic.doctor_name}` : "Consulting Doctor",
                    doctorRegNo: clinic?.medical_registration_no ? `Reg No: ${clinic.medical_registration_no}` : "",
                    clinicName: clinic?.clinic_name || org?.name || "Medical Clinic",
                    date: new Date().toISOString().split("T")[0],
                    trustTier: "verified_doctor",
                    summary: `Consultation notes: ${diagnosis.trim() || "Regular clinical review"}`,
                    diagnosis: diagnosis.trim() || undefined,
                    vitals: {
                      bp: bpSystolic && bpDiastolic ? `${bpSystolic}/${bpDiastolic} mmHg` : bp ? `${bp} mmHg` : undefined,
                      pulse: pulse ? Number(pulse) : undefined,
                      spo2: spo2 ? Number(spo2) : undefined,
                      bloodSugar: bloodSugar ? Number(bloodSugar) : undefined,
                      weight: weight ? Number(weight) : undefined,
                    },
                    medicines: rawLines.map((line) => {
                      const parts = line.split("—").map((p) => p.trim());
                      return {
                        name: parts[0] || line,
                        dosage: "1 Tab",
                        frequency: "1-0-1",
                        duration: "5 Days",
                        instructions: parts[1] || "As advised by doctor",
                      };
                    }),
                  };
                  localStorage.setItem("clinicx_patient_records", JSON.stringify([newTimelineRec, ...savedRecs]));
                } catch (cacheErr) {
                  console.warn("Timeline cache sync note:", cacheErr);
                }
              }
            }
          }
        } catch (rxWriteErr) {
          console.warn("Structured prescription write failed silently:", rxWriteErr);
        }
      }

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
        .from("queue_tokens")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("queue_date", todayStr)
        .eq("patient_name", patientName.trim())
        .then(() => {}, () => {});

      // Play completion chime
      playAudioChime("complete");
      toast.success(`✅ Consultation finished for ${patientName}!`);

      // Clear local draft
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {}

      // 4. Instantly advance to the NEXT waiting patient
      const remainingWaiting = queue.filter(
        (q) => (q.status === "waiting" || q.status === "serving") && q.patient_name !== patientName
      );
      const remainingConfirmed = queue.filter(
        (q) => q.status === "confirmed" && q.patient_name !== patientName
      );

      const nextPatient = remainingWaiting[0] || remainingConfirmed[0];
      if (nextPatient) {
        selectPatient(nextPatient);
        toast.info(`➡️ Now treating Token #${nextPatient.token_number}: ${nextPatient.patient_name}`);
      } else {
        // Clear cockpit for next walk-in
        setPatientId(null);
        setPatientName("");
        setPatientPhone("");
        setPatientAge("");
        setPatientGender("");
        setAppointmentId(null);
        setChiefComplaint("");
        setDiagnosis("");
        setTreatmentPlan("");
        setHistoryNotes("NKDA (No Known Allergies)");
        setBp("");
        setBpSystolic("");
        setBpDiastolic("");
        setPulse("");
        setSpo2("");
        setBloodSugar("");
        setTemp("");
        setWeight("");
        setHeight("");
        setFollowUpDate("");
        setSelectedPatient(null);
        setPatientPastConsults([]);
        toast.success("🎉 All waiting patients attended! OPD Queue is clear.");
      }

      // Background refresh
      void loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete consultation");
    } finally {
      setSaving(false);
    }
  };

  // WhatsApp 1-Click Formatted Rx Sender
  const handleWhatsAppShare = () => {
    const cleanPhone = (patientPhone || "").replace(/\D/g, "");
    if (!cleanPhone) {
      toast.error("Please add a patient phone number to send WhatsApp");
      return;
    }
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const clinicTitle = clinic?.clinic_name || org?.name || "Medical Clinic";
    const docTitle = clinic?.doctor_name ? `Dr. ${clinic.doctor_name}` : "Consulting Physician";

    const vitalsParts = [
      bp ? `BP: ${bp}` : (bpSystolic && bpDiastolic ? `BP: ${bpSystolic}/${bpDiastolic} mmHg` : ""),
      pulse ? `Pulse: ${pulse} bpm` : "",
      spo2 ? `SpO2: ${spo2}%` : "",
      bloodSugar ? `Sugar: ${bloodSugar} mg/dL` : "",
      temp ? `Temp: ${temp}°F` : "",
      weight ? `Weight: ${weight} kg` : "",
    ].filter(Boolean);

    const msg = `*${clinicTitle}*
${docTitle} — Consultation Summary
────────────────────────────
*Patient:* ${patientName} ${patientAge ? `(${patientAge} yrs)` : ""}
*Date:* ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
${diagnosis ? `*Diagnosis:* ${diagnosis}\n` : ""}${vitalsParts.length > 0 ? `*Vitals:* ${vitalsParts.join(" | ")}\n` : ""}
*Prescribed Medications (Rx):*
${treatmentPlan || "• General advice & hydration."}

${followUpDate ? `*Next Follow-up:* ${new Date(followUpDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}\n` : ""}
────────────────────────────
_Wishing you a speedy recovery! For questions, call ${clinic?.phone || "the clinic"}._`;

    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // Copy Rx to Clipboard
  const handleCopyRx = () => {
    if (!treatmentPlan && !diagnosis) {
      toast.error("Prescription is empty");
      return;
    }
    const text = `Prescription for ${patientName}\nDiagnosis: ${diagnosis || "—"}\n\nRx:\n${treatmentPlan}\n\nFollow-up: ${followUpDate || "SOS"}`;
    navigator.clipboard.writeText(text);
    toast.success("Prescription copied to clipboard!");
  };

  // Clean, Medical-Grade Print Slip
  const handlePrintSlip = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }

    const clinicTitle = clinic?.clinic_name || org?.name || "Medical Clinic";
    const docName = clinic?.doctor_name ? `Dr. ${clinic.doctor_name}` : "Consulting Doctor";
    const regNo = clinic?.medical_registration_no ? `Reg No: ${clinic.medical_registration_no}` : "";
    const address = clinic?.address || clinic?.public_address || "";
    const phone = clinic?.phone || clinic?.public_phone || "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rx - ${escapeHtml(patientName)}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 0; background: #fff; line-height: 1.45; }
            .no-print { position: sticky; top: 0; background: #f8fafc; border-bottom: 1px solid #cbd5e1; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
            .btn { padding: 9px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; border: 1px solid #cbd5e1; background: #fff; font-size: 13px; }
            .btn-p { background: #0284c7; color: #fff; border: none; }
            .paper { max-width: 800px; margin: 20px auto; background: #fff; padding: 24px 32px; border: 1px solid #e2e8f0; border-radius: 12px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 14px; margin-bottom: 16px; }
            .clinic-name { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; }
            .doctor-name { font-size: 15px; font-weight: 700; color: #0369a1; margin-top: 4px; }
            .doc-sub { font-size: 11px; color: #64748b; }
            .clinic-meta { text-align: right; font-size: 11px; color: #64748b; }
            .patient-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 8px; font-size: 12px; margin-bottom: 16px; }
            .patient-bar div { display: flex; flex-direction: column; }
            .patient-bar span { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600; }
            .patient-bar strong { font-size: 13px; color: #0f172a; }
            .sec-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0369a1; border-bottom: 1px solid #e0f2fe; padding-bottom: 4px; margin: 14px 0 6px 0; }
            .vitals-strip { display: flex; gap: 16px; font-size: 12px; margin-bottom: 10px; background: #f0f9ff; padding: 8px 12px; border-radius: 6px; }
            .vitals-strip b { color: #0369a1; }
            .diag-box { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
            .rx-symbol { font-size: 22px; font-family: serif; font-weight: bold; color: #0284c7; margin-bottom: 4px; }
            .rx-content { background: #fafafa; border: 1px dashed #cbd5e1; padding: 14px; border-radius: 8px; font-family: "SFMono-Regular", Consolas, monospace; white-space: pre-wrap; font-size: 13px; line-height: 1.7; color: #1e293b; min-height: 160px; }
            .footer { margin-top: 50px; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 16px; border-top: 1px solid #e2e8f0; }
            .sign-box { text-align: center; font-size: 12px; }
            .sign-line { width: 180px; border-top: 1px solid #0f172a; margin-bottom: 6px; }
            @media print {
              .no-print { display: none !important; }
              .paper { border: none; margin: 0; padding: 0; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button class="btn" onclick="window.close()">← Close</button>
            <button class="btn btn-p" onclick="window.print()">🖨️ Print Prescription Slip</button>
          </div>
          <div class="paper">
            <div class="header">
              <div>
                <h1 class="clinic-name">${escapeHtml(clinicTitle)}</h1>
                <div class="doctor-name">${escapeHtml(docName)}</div>
                ${regNo ? `<div class="doc-sub">${escapeHtml(regNo)}</div>` : ""}
              </div>
              <div class="clinic-meta">
                ${address ? `<div>${escapeHtml(address)}</div>` : ""}
                ${phone ? `<div>Phone: ${escapeHtml(phone)}</div>` : ""}
                <div>Date: <b>${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</b></div>
              </div>
            </div>

            <div class="patient-bar">
              <div>
                <span>Patient Name</span>
                <strong>${escapeHtml(patientName)}</strong>
              </div>
              <div>
                <span>Age / Gender</span>
                <strong>${patientAge ? `${patientAge} yrs` : "—"} / ${patientGender ? patientGender : "—"}</strong>
              </div>
              <div>
                <span>Phone</span>
                <strong>${escapeHtml(patientPhone || "—")}</strong>
              </div>
              <div>
                <span>Follow-up Date</span>
                <strong>${followUpDate ? new Date(followUpDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "SOS / As needed"}</strong>
              </div>
            </div>

            ${bp || pulse || temp || weight || spo2 || bloodSugar ? `
            <div class="sec-title">Vitals</div>
            <div class="vitals-strip">
              ${bp ? `<div>BP: <b>${escapeHtml(bp)} mmHg</b></div>` : (bpSystolic && bpDiastolic ? `<div>BP: <b>${escapeHtml(bpSystolic)}/${escapeHtml(bpDiastolic)} mmHg</b></div>` : "")}
              ${pulse ? `<div>Pulse: <b>${escapeHtml(pulse)} bpm</b></div>` : ""}
              ${spo2 ? `<div>SpO2: <b>${escapeHtml(spo2)}%</b></div>` : ""}
              ${bloodSugar ? `<div>Sugar: <b>${escapeHtml(bloodSugar)} mg/dL</b></div>` : ""}
              ${temp ? `<div>Temp: <b>${escapeHtml(temp)}°F</b></div>` : ""}
              ${weight ? `<div>Weight: <b>${escapeHtml(weight)} kg</b></div>` : ""}
              ${height ? `<div>Height: <b>${escapeHtml(height)} cm</b></div>` : ""}
            </div>` : ""}

            ${chiefComplaint ? `
            <div class="sec-title">Symptoms / Chief Complaint</div>
            <div style="font-size:12px;margin-bottom:10px;">${escapeHtml(chiefComplaint)}</div>` : ""}

            ${diagnosis ? `
            <div class="sec-title">Clinical Diagnosis</div>
            <div class="diag-box">${escapeHtml(diagnosis)}</div>` : ""}

            <div class="rx-symbol">℞</div>
            <div class="rx-content">${escapeHtml(treatmentPlan || "No oral medications prescribed. Follow general advice and rest.")}</div>

            <div class="footer">
              <div style="font-size:11px;color:#64748b;">
                <div>• Emergency? Visit nearest hospital casualty immediately.</div>
                <div>• Please bring this slip for follow-up review.</div>
              </div>
              <div class="sign-box">
                <div class="sign-line"></div>
                <strong>${escapeHtml(docName)}</strong>
                <div style="font-size:10px;color:#64748b;">Authorized Signatory</div>
              </div>
            </div>
          </div>
          <script>setTimeout(function(){ window.print(); }, 250);</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filtered Queue
  const filteredQueue = useMemo(() => {
    return queue
      .filter((q) => {
        if (queueFilter === "waiting") return q.status === "waiting" || q.status === "confirmed";
        if (queueFilter === "serving") return q.status === "serving";
        if (queueFilter === "done") return q.status === "done";
        return true;
      })
      .filter((q) => {
        if (!queueSearch.trim()) return true;
        const s = queueSearch.toLowerCase();
        return (
          q.patient_name.toLowerCase().includes(s) ||
          (q.patient_phone ?? "").includes(s) ||
          String(q.token_number).includes(s)
        );
      });
  }, [queue, queueFilter, queueSearch]);

  const waitingCount = queue.filter((q) => q.status === "waiting" || q.status === "confirmed").length;
  const servingCount = queue.filter((q) => q.status === "serving").length;
  const doneCount = queue.filter((q) => q.status === "done").length;

  const bpStatus = getBpStatus(bp);
  const tempStatus = getTempStatus(temp);
  const spo2Status = getSpo2Status(spo2);
  const sugarStatus = getBloodSugarStatus(bloodSugar);
  const bmiInfo = getBmi(weight, height);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-16">
      {/* Top Header & Fast Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border/80 p-3 sm:p-4 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
            <Stethoscope className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                Doctor Consultation Cockpit
              </h1>
              <Badge variant="outline" className="text-[11px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-semibold gap-1">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live OPD
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Fast 1-screen consultation flow: Queue ➔ Vitals ➔ 1-Tap Presets ➔ Complete &amp; Next Patient.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Draft Restored Banner */}
          {hasDraftRestored && (
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs px-2.5 py-1 rounded-xl">
              <span>Unsaved draft</span>
              <Button size="sm" variant="ghost" onClick={restoreDraft} className="h-6 text-[11px] px-1.5 font-bold text-primary">
                Restore
              </Button>
              <Button size="sm" variant="ghost" onClick={discardDraft} className="h-6 text-[11px] px-1.5 text-muted-foreground">
                ✕
              </Button>
            </div>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShortcutsModalOpen(true)}
            className="h-8 text-xs gap-1 rounded-xl hidden md:flex border-border/80"
          >
            <HelpCircle className="size-3.5" /> Shortcuts
          </Button>

          <div className="inline-flex rounded-xl border border-border/80 p-0.5 bg-muted/40 text-xs">
            <button
              onClick={() => setActiveTab("cockpit")}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                activeTab === "cockpit" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ⚡ Cockpit
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                activeTab === "history" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              📚 Records ({historyRows.length})
            </button>
          </div>
        </div>
      </div>

      {activeTab === "cockpit" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* ================= LEFT COLUMN: OPD QUEUE (4 Cols) ================= */}
          <div className="lg:col-span-4 space-y-3">
            <Card className="p-3 sm:p-4 border-border/80 bg-card shadow-xs space-y-3 rounded-2xl">
              {/* Queue Header & Walk-in */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    <Users className="size-4 text-primary" /> Today's OPD Queue
                  </h3>
                  <div className="text-[11px] text-muted-foreground">
                    {queue.length} patients booked / waiting today
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setWalkinModalOpen(true)}
                  className="h-7 text-xs px-2.5 rounded-lg gap-1 bg-primary text-primary-foreground font-semibold shadow-2xs"
                >
                  <Plus className="size-3" /> Walk-in
                </Button>
              </div>

              {/* Status Tabs Filter */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-muted/30 border border-border/60 rounded-xl text-center text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setQueueFilter("all")}
                  className={`py-1 rounded-lg transition-all ${
                    queueFilter === "all" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground"
                  }`}
                >
                  All ({queue.length})
                </button>
                <button
                  type="button"
                  onClick={() => setQueueFilter("waiting")}
                  className={`py-1 rounded-lg transition-all ${
                    queueFilter === "waiting" ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 shadow-2xs" : "text-muted-foreground"
                  }`}
                >
                  Wait ({waitingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setQueueFilter("serving")}
                  className={`py-1 rounded-lg transition-all ${
                    queueFilter === "serving" ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 shadow-2xs" : "text-muted-foreground"
                  }`}
                >
                  In ({servingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setQueueFilter("done")}
                  className={`py-1 rounded-lg transition-all ${
                    queueFilter === "done" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground"
                  }`}
                >
                  Done ({doneCount})
                </button>
              </div>

              {/* Instant Search Bar */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  id="consult-queue-search"
                  placeholder="Search name, phone, token (Ctrl+K)…"
                  value={queueSearch}
                  onChange={(e) => setQueueSearch(e.target.value)}
                  className="pl-8 pr-7 h-8 text-xs rounded-xl bg-card border-border/80"
                />
                {queueSearch && (
                  <button
                    onClick={() => setQueueSearch("")}
                    className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Patient List */}
              <div className="space-y-1.5 max-h-[520px] lg:max-h-[640px] overflow-y-auto pr-1 no-scrollbar">
                {filteredQueue.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                    No patients matching filter.
                    <div className="mt-2">
                      <Button size="sm" variant="outline" onClick={() => setWalkinModalOpen(true)} className="h-7 text-xs">
                        + Add Walk-in Patient
                      </Button>
                    </div>
                  </div>
                ) : (
                  filteredQueue.map((item) => {
                    const isSelected =
                      (selectedPatient?.patient_name && selectedPatient.patient_name === item.patient_name) ||
                      (selectedPatient?.appointment_id && selectedPatient.appointment_id === item.appointment_id);

                    return (
                      <div
                        key={item.id}
                        className={`w-full p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                          isSelected
                            ? "bg-primary/10 border-primary text-foreground shadow-2xs"
                            : "bg-muted/20 hover:bg-muted/50 border-border/70 text-muted-foreground"
                        }`}
                        onClick={() => selectPatient(item)}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`size-7 rounded-lg border text-xs font-mono font-bold grid place-items-center shrink-0 ${
                            item.status === "serving"
                              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                              : item.status === "waiting"
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                : "bg-card text-foreground border-border"
                          }`}>
                            #{item.token_number}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-foreground truncate flex items-center gap-1.5">
                              {item.patient_name}
                              {item.patient_age && <span className="text-[10px] text-muted-foreground font-normal">({item.patient_age}y)</span>}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {item.problem || (item.scheduled_at ? new Date(item.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "General Consult")}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5">
                          {item.status !== "done" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleCallPatient(item);
                              }}
                              className="h-6 px-1.5 text-[10px] text-primary hover:bg-primary/10 font-bold"
                              title="Call this patient into cabin"
                            >
                              <Volume2 className="size-3 mr-0.5" /> Call
                            </Button>
                          )}

                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1.5 py-0 font-bold ${
                              item.status === "waiting" || item.status === "confirmed"
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                : item.status === "serving"
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                  : "bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            {item.status === "done" ? "Done" : item.status === "serving" ? "In-Consult" : "Waiting"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          {/* ================= RIGHT COLUMN: CONSULTATION COCKPIT (8 Cols) ================= */}
          <div className="lg:col-span-8 space-y-4">
            <Card className="p-4 sm:p-5 border-border/80 bg-card shadow-xs space-y-4 rounded-2xl">
              {/* Active Patient Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-2xl bg-primary/10 text-primary grid place-items-center font-bold text-base shrink-0 shadow-xs">
                    {patientName ? patientName.slice(0, 2).toUpperCase() : "Rx"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-bold text-foreground">
                        {patientName || "Walk-in Consultation"}
                      </h2>
                      {patientAge && (
                        <span className="text-xs text-muted-foreground font-mono">
                          ({patientAge} yrs{patientGender ? `, ${patientGender}` : ""})
                        </span>
                      )}
                      {selectedPatient && (
                        <Badge variant="outline" className="text-[10px] font-mono bg-muted text-muted-foreground">
                          Token #{selectedPatient.token_number}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      {patientPhone ? (
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <Phone className="size-3 text-emerald-600" /> {patientPhone}
                        </span>
                      ) : (
                        <span>No phone attached</span>
                      )}
                      {appointmentId && (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-[9px]">Linked Appt</Badge>
                          <Link
                            to="/consult/$appointmentId"
                            params={{ appointmentId }}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-lg border border-emerald-500/30 transition-colors"
                            title="Open video teleconsultation room in new tab"
                          >
                            <Video className="size-3" /> Teleconsult
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Medical History & Repeat Rx Strip */}
                <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPreviewModalOpen(true)}
                    className="h-7 text-xs gap-1 rounded-lg border-border font-semibold hover:bg-muted"
                    title="Live preview prescription slip"
                  >
                    <Eye className="size-3" /> Preview Rx
                  </Button>
                  {patientPastConsults.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRepeatLastRx}
                      className="h-7 text-xs gap-1 rounded-lg border-primary/30 text-primary hover:bg-primary/10 font-semibold"
                      title="Load previous diagnosis and prescription"
                    >
                      <RotateCcw className="size-3" /> Repeat Last Rx
                    </Button>
                  )}
                  {patientPastConsults.length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {patientPastConsults.length} past visit(s) on file
                    </Badge>
                  )}
                </div>
              </div>

              {/* Past Visit Snippet (If available) */}
              {patientPastConsults.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-primary">
                    <span className="flex items-center gap-1">
                      <History className="size-3" /> Previous Visit on {new Date(patientPastConsults[0].created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}:
                    </span>
                    <span className="font-bold">{patientPastConsults[0].diagnosis || "Clinical Visit"}</span>
                  </div>
                  {patientPastConsults[0].treatment_plan && (
                    <div className="text-[11px] text-muted-foreground font-mono truncate">
                      {patientPastConsults[0].treatment_plan.replace(/\n/g, " • ")}
                    </div>
                  )}
                </div>
              )}

              {/* Allergy / Condition Tags */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1">Alerts:</span>
                {["NKDA", "Penicillin Allergy", "Sulfa Allergy", "Diabetic", "Hypertensive", "Asthmatic"].map((tag) => {
                  const active = historyNotes.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleAllergy(tag)}
                      className={`text-[10px] px-2 py-0.5 rounded-lg border font-semibold transition-all ${
                        active
                          ? tag.includes("Allergy")
                            ? "bg-rose-500 text-white border-rose-600 shadow-2xs"
                            : "bg-primary text-primary-foreground border-primary shadow-2xs"
                          : "bg-muted/40 text-muted-foreground hover:text-foreground border-border/60"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              {/* Vitals Quick Bar with Intelligent Health Indicators */}
              <div className="space-y-1.5 bg-muted/20 p-3 rounded-2xl border border-border/60">
                <div className="flex items-center justify-between flex-wrap gap-1.5">
                  <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Activity className="size-3.5 text-emerald-600" /> Patient Vitals (Ctrl+B)
                  </Label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {bpStatus && (
                      <Badge variant="outline" className={`text-[10px] font-bold px-1.5 py-0 ${bpStatus.color}`}>
                        {bpStatus.label}
                      </Badge>
                    )}
                    {spo2Status && (
                      <Badge variant="outline" className={`text-[10px] font-bold px-1.5 py-0 ${spo2Status.color}`}>
                        {spo2Status.label}
                      </Badge>
                    )}
                    {sugarStatus && (
                      <Badge variant="outline" className={`text-[10px] font-bold px-1.5 py-0 ${sugarStatus.color}`}>
                        {sugarStatus.label}
                      </Badge>
                    )}
                    {tempStatus && (
                      <Badge variant="outline" className={`text-[10px] font-bold px-1.5 py-0 ${tempStatus.color}`}>
                        {tempStatus.label}
                      </Badge>
                    )}
                    {bmiInfo && (
                      <Badge variant="outline" className={`text-[10px] font-bold px-1.5 py-0 ${bmiInfo.color}`}>
                        BMI: {bmiInfo.val} ({bmiInfo.category})
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground block mb-0.5">BP (mmHg)</Label>
                    <Input
                      id="consult-bp-input"
                      placeholder="120/80"
                      value={bp}
                      onChange={(e) => handleBpChange(e.target.value)}
                      className="h-8 text-xs font-mono bg-card"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground block mb-0.5">Pulse (bpm)</Label>
                    <Input
                      placeholder="72"
                      type="number"
                      value={pulse}
                      onChange={(e) => setPulse(e.target.value)}
                      className="h-8 text-xs font-mono bg-card"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground block mb-0.5">SpO2 (%)</Label>
                    <Input
                      placeholder="98"
                      type="number"
                      value={spo2}
                      onChange={(e) => setSpo2(e.target.value)}
                      className="h-8 text-xs font-mono bg-card"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground block mb-0.5">Sugar (mg/dL)</Label>
                    <Input
                      placeholder="110"
                      type="number"
                      value={bloodSugar}
                      onChange={(e) => setBloodSugar(e.target.value)}
                      className="h-8 text-xs font-mono bg-card"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground block mb-0.5">Temp (°F)</Label>
                    <Input
                      placeholder="98.4"
                      value={temp}
                      onChange={(e) => setTemp(e.target.value)}
                      className="h-8 text-xs font-mono bg-card"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground block mb-0.5">Weight (kg)</Label>
                    <Input
                      placeholder="70"
                      type="number"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="h-8 text-xs font-mono bg-card"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground block mb-0.5">Height (cm)</Label>
                    <Input
                      placeholder="170"
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      className="h-8 text-xs font-mono bg-card"
                    />
                  </div>
                </div>
              </div>

              {/* 1-Click Clinical Presets Strip */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="size-3.5 text-amber-500" /> 1-Click Clinical Treatment Bundles
                  </Label>
                  <span className="text-[10px] text-muted-foreground">Auto-populates symptoms, diagnosis &amp; Rx</span>
                </div>
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

              {/* Chief Complaint & Diagnosis Inputs with Mic Dictation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Chief Complaint / Symptoms</Label>
                    <button
                      type="button"
                      onClick={() => toggleVoiceDictation("complaint")}
                      className={`text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded transition-all ${
                        activeRecordingField === "complaint"
                          ? "bg-rose-500 text-white animate-pulse font-bold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                      title="Dictate symptoms using voice"
                    >
                      {activeRecordingField === "complaint" ? <MicOff className="size-3" /> : <Mic className="size-3" />}
                      <span>{activeRecordingField === "complaint" ? "Listening…" : "Voice"}</span>
                    </button>
                  </div>
                  <Input
                    placeholder="e.g. High fever with chills and dry cough for 3 days"
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    className="text-xs h-9 bg-card"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Clinical Diagnosis</Label>
                    <button
                      type="button"
                      onClick={() => toggleVoiceDictation("diagnosis")}
                      className={`text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded transition-all ${
                        activeRecordingField === "diagnosis"
                          ? "bg-rose-500 text-white animate-pulse font-bold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                      title="Dictate diagnosis using voice"
                    >
                      {activeRecordingField === "diagnosis" ? <MicOff className="size-3" /> : <Mic className="size-3" />}
                      <span>{activeRecordingField === "diagnosis" ? "Listening…" : "Voice (Ctrl+D)"}</span>
                    </button>
                  </div>
                  <Input
                    id="consult-diagnosis-input"
                    placeholder="e.g. Acute Viral Bronchitis / Pyrexia"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    className="text-xs h-9 font-medium text-primary bg-card"
                  />
                </div>
              </div>

              {/* 1-Tap Quick Diagnosis Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase shrink-0">Quick Dx:</span>
                {COMMON_DIAGNOSES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDiagnosis(d);
                      toast.success(`Diagnosis set: ${d}`);
                    }}
                    className={`text-[10px] px-2 py-0.5 rounded-lg border font-medium shrink-0 transition-all ${
                      diagnosis === d
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border/70 hover:bg-muted text-foreground"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>

              {/* Interactive Medicine Inserter */}
              <div className="p-3 bg-muted/20 border border-border/70 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="size-3 text-amber-500" /> Fast Medicine Inserter (Ctrl+M)
                  </span>
                  <span className="text-[10px] text-muted-foreground">Add customized medicine with 1 tap</span>
                </div>

                {/* Quick Add Custom Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                  <Input
                    id="custom-med-input"
                    placeholder="Medicine Name (e.g. Tab Dolo 650mg)"
                    value={customMedName}
                    onChange={(e) => setCustomMedName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomMed();
                      }
                    }}
                    className="h-8 text-xs flex-1 bg-card"
                  />
                  <div className="flex items-center gap-1">
                    <select
                      value={customMedDosage}
                      onChange={(e) => setCustomMedDosage(e.target.value)}
                      className="h-8 text-xs bg-card border border-border rounded-lg px-2"
                    >
                      <option value="1-0-1">1-0-1 (Morn-Night)</option>
                      <option value="1-0-0">1-0-0 (Morning)</option>
                      <option value="0-0-1">0-0-1 (Night)</option>
                      <option value="1-1-1">1-1-1 (Thrice)</option>
                      <option value="0-1-0">0-1-0 (Afternoon)</option>
                      <option value="1 tab SOS">1 tab SOS (As needed)</option>
                    </select>

                    <select
                      value={customMedTiming}
                      onChange={(e) => setCustomMedTiming(e.target.value)}
                      className="h-8 text-xs bg-card border border-border rounded-lg px-2"
                    >
                      <option value="After food">After food</option>
                      <option value="Before breakfast">Before breakfast</option>
                      <option value="Empty stomach">Empty stomach</option>
                      <option value="At bedtime">At bedtime</option>
                    </select>

                    <select
                      value={customMedDuration}
                      onChange={(e) => setCustomMedDuration(e.target.value)}
                      className="h-8 text-xs bg-card border border-border rounded-lg px-2"
                    >
                      <option value="3 days">3 days</option>
                      <option value="5 days">5 days</option>
                      <option value="7 days">7 days</option>
                      <option value="14 days">14 days</option>
                      <option value="30 days">30 days</option>
                    </select>

                    <Button
                      size="sm"
                      type="button"
                      onClick={handleAddCustomMed}
                      className="h-8 px-2.5 text-xs bg-primary text-primary-foreground font-semibold rounded-lg shrink-0"
                    >
                      + Add
                    </Button>
                  </div>
                </div>

                {/* Medicine Category Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
                  {["All", ...MED_CATEGORIES.map((c) => c.name)].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedMedCategory(cat)}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-all shrink-0 ${
                        selectedMedCategory === cat
                          ? "bg-primary/20 text-primary border border-primary/40 font-bold"
                          : "bg-muted/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Popular Medicine Quick Chips */}
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {(selectedMedCategory === "All"
                    ? FAST_MEDS
                    : MED_CATEGORIES.find((c) => c.name === selectedMedCategory)?.meds || FAST_MEDS
                  ).map((med) => (
                    <button
                      key={med.name}
                      type="button"
                      onClick={() => addMedicine(med)}
                      className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-card border border-border/80 hover:border-primary/50 hover:bg-primary/5 text-foreground transition-all shadow-2xs"
                    >
                      + {med.name.replace(/^(Tab|Cap|Syp)\s*/, "")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prescription Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <FileText className="size-3.5 text-primary" /> Prescription (Rx) &amp; Advice
                  </Label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleVoiceDictation("rx")}
                      className={`text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded transition-all ${
                        activeRecordingField === "rx"
                          ? "bg-rose-500 text-white animate-pulse font-bold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                      title="Dictate prescription medications using voice"
                    >
                      {activeRecordingField === "rx" ? <MicOff className="size-3" /> : <Mic className="size-3" />}
                      <span>{activeRecordingField === "rx" ? "Listening Rx…" : "Voice Rx"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyRx}
                      className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <Copy className="size-3" /> Copy
                    </button>
                    <span className="text-[10px] text-muted-foreground">• Autosaved</span>
                  </div>
                </div>
                <Textarea
                  rows={6}
                  value={treatmentPlan}
                  onChange={(e) => setTreatmentPlan(e.target.value)}
                  placeholder="• Tab Paracetamol 650mg — 1-0-1 after food x 3 days&#10;• Syp ORS — 1 sachet in 1L water sip continuously&#10;• Rest & plenty of warm fluids."
                  className="text-xs font-mono leading-relaxed bg-card rounded-xl border-border/80"
                />
              </div>

              {/* Follow-up & Quick Date Chips */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Label className="text-xs font-semibold">Follow-up:</Label>
                  <Input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="h-8 text-xs w-36 bg-card rounded-lg"
                  />
                  {[
                    { label: "SOS", days: 0 },
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
                        if (chip.days === 0) {
                          setFollowUpDate("");
                        } else {
                          const d = new Date();
                          d.setDate(d.getDate() + chip.days);
                          setFollowUpDate(d.toISOString().slice(0, 10));
                        }
                      }}
                      className="px-2 py-1 text-[11px] rounded-lg bg-muted border border-border/80 hover:bg-muted/80 text-foreground font-semibold"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* STICKY SPEED ACTION BAR */}
              <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPreviewModalOpen(true)}
                    className="h-9 text-xs gap-1.5 rounded-xl border-border/80 font-semibold"
                    title="Live preview formatted prescription slip"
                  >
                    <Eye className="size-3.5" /> Preview Rx
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handlePrintSlip}
                    className="h-9 text-xs gap-1.5 rounded-xl border-border/80 font-semibold"
                    title="Print or Save PDF prescription (Ctrl+P)"
                  >
                    <Printer className="size-3.5" /> Print Rx
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleWhatsAppShare}
                    disabled={!patientPhone}
                    className="h-9 text-xs gap-1.5 rounded-xl text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 font-semibold"
                    title="Send formatted prescription on WhatsApp"
                  >
                    <MessageSquare className="size-3.5" /> WhatsApp Rx
                  </Button>
                </div>

                {/* Primary Complete & Next Patient CTA */}
                <Button
                  size="lg"
                  onClick={handleCompleteAndNext}
                  disabled={saving}
                  className="h-10 px-6 bg-primary text-primary-foreground font-bold text-xs sm:text-sm gap-2 rounded-xl shadow-md hover:opacity-95"
                  title="Save & transition to next patient (Ctrl+Enter)"
                >
                  <CheckCircle2 className="size-4" />
                  {saving ? "Saving…" : "⚡ Complete & Next Patient"}
                  <span className="hidden sm:inline text-[10px] opacity-75 font-mono ml-1">
                    (Ctrl+↵)
                  </span>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        /* ================= ARCHIVED / PAST CONSULTATIONS TAB ================= */
        <div className="space-y-4">
          <Card className="p-4 border-border/80 bg-card shadow-xs space-y-3 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                <FileText className="size-4 text-primary" /> Past Consultation Records
              </h3>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter past records…"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {historyRows
                .filter((c) => {
                  if (!historySearchQuery.trim()) return true;
                  const q = historySearchQuery.toLowerCase();
                  return (
                    c.patient_name.toLowerCase().includes(q) ||
                    (c.diagnosis ?? "").toLowerCase().includes(q) ||
                    (c.treatment_plan ?? "").toLowerCase().includes(q)
                  );
                })
                .map((c) => (
                  <Card key={c.id} className="p-4 border-border/80 bg-card shadow-xs space-y-2 rounded-xl">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{c.patient_name}</h4>
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
          </Card>
        </div>
      )}

      {/* ================= MODAL: ADD WALK-IN PATIENT ================= */}
      <Dialog open={walkinModalOpen} onOpenChange={setWalkinModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-4 text-primary" /> Add Walk-in Patient
            </DialogTitle>
            <DialogDescription className="text-xs">
              Quickly register a walk-in patient or pick an existing clinic patient to start consultation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {/* Quick Pick Existing Patient */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Search Existing Clinic Patient (Optional):</Label>
              <Input
                placeholder="Type patient name or phone…"
                value={walkinSearch}
                onChange={(e) => setWalkinSearch(e.target.value)}
                className="h-8 text-xs"
              />
              {walkinSearch.trim() && (
                <div className="max-h-36 overflow-y-auto border rounded-lg p-1 bg-muted/30 space-y-1">
                  {patients
                    .filter(
                      (p) =>
                        p.name.toLowerCase().includes(walkinSearch.toLowerCase()) ||
                        (p.phone ?? "").includes(walkinSearch)
                    )
                    .slice(0, 5)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPatientId(p.id);
                          setPatientName(p.name);
                          setPatientPhone(p.phone || "");
                          setPatientAge(p.age ? String(p.age) : "");
                          setPatientGender(p.gender || "");
                          setSelectedPatient({
                            id: `walkin-${p.id}`,
                            source: "manual",
                            token_number: queue.length + 1,
                            patient_id: p.id,
                            patient_name: p.name,
                            patient_phone: p.phone,
                            patient_age: p.age,
                            patient_gender: p.gender,
                            status: "serving",
                          });
                          setWalkinModalOpen(false);
                          setWalkinSearch("");
                          void loadPatientPastConsults(p.name, p.phone);
                          toast.success(`Selected existing patient: ${p.name}`);
                        }}
                        className="w-full text-left p-1.5 text-xs rounded hover:bg-primary/10 flex justify-between items-center"
                      >
                        <span className="font-semibold">{p.name}</span>
                        <span className="text-muted-foreground">{p.phone || "No phone"}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-border"></div>
              <span className="flex-shrink mx-2 text-[10px] text-muted-foreground uppercase font-bold">OR Enter New</span>
              <div className="flex-grow border-t border-border"></div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Patient Name *</Label>
                <Input
                  placeholder="e.g. Rahul Sharma"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone Number</Label>
                <Input
                  placeholder="e.g. 9876543210"
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Age</Label>
                <Input
                  type="number"
                  placeholder="e.g. 35"
                  value={patientAge}
                  onChange={(e) => setPatientAge(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Chief Complaint (Optional)</Label>
                <Input
                  placeholder="e.g. Fever, body pain"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setWalkinModalOpen(false)} className="h-8 text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!patientName.trim()) {
                    toast.error("Please enter patient name");
                    return;
                  }
                  setSelectedPatient({
                    id: `walkin-${Date.now()}`,
                    source: "manual",
                    token_number: queue.length + 1,
                    patient_name: patientName.trim(),
                    patient_phone: patientPhone.trim() || null,
                    patient_age: patientAge ? parseInt(patientAge) : null,
                    status: "serving",
                    problem: chiefComplaint.trim() || null,
                  });
                  setWalkinModalOpen(false);
                  toast.success(`Walk-in consultation started for ${patientName}`);
                }}
                className="h-8 text-xs bg-primary text-primary-foreground font-semibold"
              >
                Start Consultation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: KEYBOARD SHORTCUTS ================= */}
      <Dialog open={shortcutsModalOpen} onOpenChange={setShortcutsModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <HelpCircle className="size-4 text-primary" /> Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 pt-1 text-xs">
            <div className="flex justify-between items-center p-2 rounded-lg bg-muted/40">
              <span className="font-medium">Complete &amp; Next Patient</span>
              <kbd className="px-2 py-0.5 rounded bg-card border font-mono font-bold text-[11px]">
                Ctrl + Enter
              </kbd>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-muted/40">
              <span className="font-medium">Print Rx Slip</span>
              <kbd className="px-2 py-0.5 rounded bg-card border font-mono font-bold text-[11px]">
                Ctrl + P
              </kbd>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-muted/40">
              <span className="font-medium">Search Patient Queue</span>
              <kbd className="px-2 py-0.5 rounded bg-card border font-mono font-bold text-[11px]">
                Ctrl + K
              </kbd>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-muted/40">
              <span className="font-medium">Focus Fast Medicine Input</span>
              <kbd className="px-2 py-0.5 rounded bg-card border font-mono font-bold text-[11px]">
                Ctrl + M
              </kbd>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-muted/40">
              <span className="font-medium">Focus Clinical Diagnosis</span>
              <kbd className="px-2 py-0.5 rounded bg-card border font-mono font-bold text-[11px]">
                Ctrl + D
              </kbd>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-muted/40">
              <span className="font-medium">Focus Patient Vitals (BP)</span>
              <kbd className="px-2 py-0.5 rounded bg-card border font-mono font-bold text-[11px]">
                Ctrl + B
              </kbd>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: PRESCRIPTION PREVIEW ================= */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <FileText className="size-4 text-primary" /> Prescription Preview
              </span>
              <Badge variant="outline" className="text-[10px] font-mono">
                {patientName ? escapeHtml(patientName) : "OPD Patient"}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Review prescription before printing or sending via WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="border border-border/80 rounded-xl p-4 bg-card text-foreground space-y-3.5 shadow-2xs text-xs">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-border/60 pb-3">
              <div>
                <h3 className="font-bold text-base text-primary">
                  {clinic?.clinic_name || org?.name || "Medical Clinic"}
                </h3>
                <div className="font-semibold text-xs text-foreground mt-0.5">
                  {clinic?.doctor_name ? `Dr. ${clinic.doctor_name}` : "Consulting Physician"}
                </div>
                {clinic?.medical_registration_no && (
                  <div className="text-[10px] text-muted-foreground">
                    Reg No: {clinic.medical_registration_no}
                  </div>
                )}
              </div>
              <div className="text-right text-[11px] text-muted-foreground">
                <div>{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                {clinic?.phone && <div>Ph: {clinic.phone}</div>}
                {clinic?.address && <div className="max-w-[180px] truncate">{clinic.address}</div>}
              </div>
            </div>

            {/* Patient Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/30 p-2.5 rounded-lg border border-border/60 text-[11px]">
              <div>
                <span className="text-[9px] uppercase font-bold text-muted-foreground block">Patient</span>
                <span className="font-bold text-foreground">{patientName || "—"}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-muted-foreground block">Age / Gender</span>
                <span>{patientAge ? `${patientAge}y` : "—"} / {patientGender || "—"}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-muted-foreground block">Phone</span>
                <span>{patientPhone || "—"}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-muted-foreground block">Follow-up</span>
                <span className="font-medium text-primary">
                  {followUpDate ? new Date(followUpDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "SOS / As needed"}
                </span>
              </div>
            </div>

            {/* Vitals */}
            {(bp || pulse || spo2 || bloodSugar || temp || weight) && (
              <div className="flex flex-wrap gap-2 text-[11px] bg-primary/5 p-2 rounded-lg border border-primary/20">
                {bp && <span>BP: <b>{bp} mmHg</b></span>}
                {pulse && <span>Pulse: <b>{pulse} bpm</b></span>}
                {spo2 && <span>SpO2: <b>{spo2}%</b></span>}
                {bloodSugar && <span>Sugar: <b>{bloodSugar} mg/dL</b></span>}
                {temp && <span>Temp: <b>{temp}°F</b></span>}
                {weight && <span>Weight: <b>{weight} kg</b></span>}
              </div>
            )}

            {/* Diagnosis */}
            {diagnosis && (
              <div>
                <span className="text-[10px] font-bold uppercase text-primary tracking-wide block mb-0.5">Clinical Diagnosis</span>
                <div className="font-bold text-sm bg-muted/20 p-2 rounded-lg border border-border/60">
                  {diagnosis}
                </div>
              </div>
            )}

            {/* Rx Medications */}
            <div>
              <div className="flex items-center gap-1 font-serif text-lg font-bold text-primary mb-1">
                ℞ <span className="font-sans text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Prescription</span>
              </div>
              <div className="bg-muted/30 border border-border/80 rounded-lg p-3 font-mono text-xs whitespace-pre-wrap leading-relaxed min-h-[100px]">
                {treatmentPlan || "• No medications prescribed. General hydration and rest advised."}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center gap-2 pt-2">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handlePrintSlip}
                className="h-8 text-xs gap-1"
              >
                <Printer className="size-3.5" /> Print Rx
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleWhatsAppShare}
                disabled={!patientPhone}
                className="h-8 text-xs gap-1 text-emerald-600 border-emerald-500/30"
              >
                <MessageSquare className="size-3.5" /> WhatsApp Rx
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyRx}
                className="h-8 text-xs gap-1"
              >
                <Copy className="size-3" /> Copy
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPreviewModalOpen(false)}
              className="h-8 text-xs"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
