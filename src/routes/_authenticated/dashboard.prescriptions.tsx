import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Pill,
  Plus,
  Search,
  Printer,
  Trash2,
  Pencil,
  BookOpen,
  Copy,
  Sparkles,
  Share2,
  Check,
  FileText,
  RefreshCw,
  Zap,
  Clock,
  FolderHeart,
  BookmarkCheck,
} from "lucide-react";
import { AppGuard } from "@/components/app/AppGuard";
import { EmptyState } from "@/components/app/EmptyState";
import { StatsCard } from "@/components/app/StatsCard";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "./dashboard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/dashboard/prescriptions")({
  component: () => (
    <AppGuard appKey="prescriptions">
      <PrescriptionsPage />
    </AppGuard>
  ),
});

// -------------------------------------------------------------
// TYPES & DATA DEFINITIONS
// -------------------------------------------------------------

export type Med = {
  id: string;
  name: string;
  strength: string | null;
  form: string | null;
  category?: string | null;
  default_dose: string | null;
  default_frequency?: string | null;
  default_duration?: string | null;
  default_instructions: string | null;
};

export type Rx = {
  id: string;
  patient_name: string;
  patient_id: string | null;
  notes: string | null;
  created_at: string;
  items_summary?: string[];
};

export type RxItem = {
  id?: string;
  medication_id: string | null;
  drug_name: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
  position: number;
};

type PatientOpt = { id: string; name: string; phone?: string | null };

// -------------------------------------------------------------
// PRE-SEEDED MEDICINE CATALOG
// -------------------------------------------------------------

export const STANDARD_MEDICINE_CATALOG: Omit<Med, "id">[] = [
  // Analgesics / Antipyretics / NSAIDs
  {
    name: "Paracetamol",
    strength: "650mg",
    form: "Tablet",
    category: "Analgesic / Antipyretic",
    default_dose: "1 tab",
    default_frequency: "1-0-1",
    default_duration: "3 days",
    default_instructions: "After meals (SOS for fever > 100°F / body ache)",
  },
  {
    name: "Paracetamol",
    strength: "500mg",
    form: "Tablet",
    category: "Analgesic / Antipyretic",
    default_dose: "1 tab",
    default_frequency: "1-0-1",
    default_duration: "3 days",
    default_instructions: "After meals for mild pain / fever",
  },
  {
    name: "Aceclofenac + Paracetamol",
    strength: "100mg + 325mg",
    form: "Tablet",
    category: "Analgesic / NSAID",
    default_dose: "1 tab",
    default_frequency: "1-0-1",
    default_duration: "5 days",
    default_instructions: "Always take after food. Protect stomach.",
  },
  {
    name: "Aceclofenac + Paracetamol + Serratiopeptidase",
    strength: "100mg + 325mg + 15mg",
    form: "Tablet",
    category: "Anti-inflammatory",
    default_dose: "1 tab",
    default_frequency: "1-0-1",
    default_duration: "5 days",
    default_instructions: "After food for pain with inflammation/swelling",
  },
  {
    name: "Ibuprofen",
    strength: "400mg",
    form: "Tablet",
    category: "NSAID",
    default_dose: "1 tab",
    default_frequency: "1-0-1",
    default_duration: "3 days",
    default_instructions: "Take with or after food",
  },
  {
    name: "Ketorolac Tromethamine",
    strength: "10mg",
    form: "Tablet",
    category: "Dental / Acute Pain",
    default_dose: "1 tab",
    default_frequency: "SOS",
    default_duration: "2 days",
    default_instructions: "Sublingual or with water for acute dental pain",
  },
  {
    name: "Dicyclomine + Paracetamol",
    strength: "20mg + 325mg",
    form: "Tablet",
    category: "Antispasmodic",
    default_dose: "1 tab",
    default_frequency: "SOS",
    default_duration: "3 days",
    default_instructions: "For spasmodic stomach cramps / colic pain",
  },

  // Antibiotics & Anti-infectives
  {
    name: "Amoxicillin + Potassium Clavulanate",
    strength: "625mg",
    form: "Tablet",
    category: "Antibiotic",
    default_dose: "1 tab",
    default_frequency: "1-0-1",
    default_duration: "5 days",
    default_instructions: "After meals. Complete full 5-day course.",
  },
  {
    name: "Azithromycin",
    strength: "500mg",
    form: "Tablet",
    category: "Antibiotic",
    default_dose: "1 tab",
    default_frequency: "1-0-0",
    default_duration: "3 days",
    default_instructions: "1 hour before or 2 hours after meals",
  },
  {
    name: "Cefixime",
    strength: "200mg",
    form: "Tablet",
    category: "Antibiotic",
    default_dose: "1 tab",
    default_frequency: "1-0-1",
    default_duration: "5 days",
    default_instructions: "After food. Complete full course.",
  },
  {
    name: "Ofloxacin + Ornidazole",
    strength: "200mg + 500mg",
    form: "Tablet",
    category: "Gastrointestinal Anti-infective",
    default_dose: "1 tab",
    default_frequency: "1-0-1",
    default_duration: "5 days",
    default_instructions: "After food for acute gastroenteritis / loose motions",
  },
  {
    name: "Metronidazole",
    strength: "400mg",
    form: "Tablet",
    category: "Antibacterial / Antiprotozoal",
    default_dose: "1 tab",
    default_frequency: "1-1-1",
    default_duration: "5 days",
    default_instructions: "After meals. Avoid all alcohol during treatment.",
  },
  {
    name: "Ciprofloxacin Eye/Ear Drops",
    strength: "0.3% w/v",
    form: "Drops",
    category: "ENT / Ophthalmic",
    default_dose: "2 drops",
    default_frequency: "1-1-1-1",
    default_duration: "5 days",
    default_instructions: "Instill into affected eye/ear every 6 hours",
  },

  // Gastrointestinal / Antacids
  {
    name: "Pantoprazole",
    strength: "40mg",
    form: "Tablet",
    category: "Antacid / PPI",
    default_dose: "1 tab",
    default_frequency: "1-0-0",
    default_duration: "14 days",
    default_instructions: "Empty stomach 30 minutes before morning breakfast",
  },
  {
    name: "Pantoprazole + Domperidone SR",
    strength: "40mg + 30mg",
    form: "Capsule",
    category: "Antacid / Prokinetic",
    default_dose: "1 cap",
    default_frequency: "1-0-0",
    default_duration: "14 days",
    default_instructions: "30 mins before breakfast on empty stomach",
  },
  {
    name: "Omeprazole",
    strength: "20mg",
    form: "Capsule",
    category: "Antacid / PPI",
    default_dose: "1 cap",
    default_frequency: "1-0-0",
    default_duration: "14 days",
    default_instructions: "30 mins before breakfast",
  },
  {
    name: "Ondansetron",
    strength: "4mg",
    form: "Tablet",
    category: "Antiemetic",
    default_dose: "1 tab",
    default_frequency: "1-0-1",
    default_duration: "3 days",
    default_instructions: "30 minutes before food (or SOS for nausea)",
  },
  {
    name: "ORS (Oral Rehydration Salts)",
    strength: "21.8g Sachet",
    form: "Sachet",
    category: "Electrolyte Hydration",
    default_dose: "1 sachet in 1L water",
    default_frequency: "SOS",
    default_duration: "3 days",
    default_instructions: "Dissolve 1 sachet in 1 liter clean drinking water; sip frequently",
  },
  {
    name: "Antacid Gel (Magaldrate + Simethicone)",
    strength: "480mg + 20mg / 5ml",
    form: "Syrup",
    category: "Antacid",
    default_dose: "10 ml",
    default_frequency: "1-1-1",
    default_duration: "7 days",
    default_instructions: "1 hour after meals and at bedtime",
  },

  // Respiratory / Allergy
  {
    name: "Montelukast + Levocetirizine",
    strength: "10mg + 5mg",
    form: "Tablet",
    category: "Respiratory / Allergy",
    default_dose: "1 tab",
    default_frequency: "0-0-1",
    default_duration: "10 days",
    default_instructions: "At bedtime with water",
  },
  {
    name: "Cetirizine",
    strength: "10mg",
    form: "Tablet",
    category: "Antihistamine",
    default_dose: "1 tab",
    default_frequency: "0-0-1",
    default_duration: "5 days",
    default_instructions: "At night (may cause mild drowsiness)",
  },
  {
    name: "Fexofenadine",
    strength: "120mg",
    form: "Tablet",
    category: "Antihistamine (Non-drowsy)",
    default_dose: "1 tab",
    default_frequency: "1-0-0",
    default_duration: "7 days",
    default_instructions: "Morning after breakfast",
  },
  {
    name: "Dextromethorphan + Chlorpheniramine",
    strength: "10mg + 2mg / 5ml",
    form: "Syrup",
    category: "Antitussive (Dry Cough)",
    default_dose: "10 ml",
    default_frequency: "1-1-1",
    default_duration: "5 days",
    default_instructions: "After meals for dry cough relief",
  },
  {
    name: "Ambroxol + Levosalbutamol + Guaiphenesin",
    strength: "30mg + 1mg + 50mg / 5ml",
    form: "Syrup",
    category: "Expectorant (Wet Cough)",
    default_dose: "10 ml",
    default_frequency: "1-1-1",
    default_duration: "5 days",
    default_instructions: "After meals with warm water",
  },

  // Chronic: Cardiovascular & Anti-Hypertensive
  {
    name: "Telmisartan",
    strength: "40mg",
    form: "Tablet",
    category: "Antihypertensive",
    default_dose: "1 tab",
    default_frequency: "1-0-0",
    default_duration: "30 days",
    default_instructions: "Morning after breakfast. Maintain daily home BP log.",
  },
  {
    name: "Telmisartan + Amlodipine",
    strength: "40mg + 5mg",
    form: "Tablet",
    category: "Antihypertensive Combination",
    default_dose: "1 tab",
    default_frequency: "1-0-0",
    default_duration: "30 days",
    default_instructions: "Morning after breakfast",
  },
  {
    name: "Amlodipine",
    strength: "5mg",
    form: "Tablet",
    category: "Antihypertensive",
    default_dose: "1 tab",
    default_frequency: "0-0-1",
    default_duration: "30 days",
    default_instructions: "Bedtime / Evening daily",
  },
  {
    name: "Atorvastatin",
    strength: "10mg",
    form: "Tablet",
    category: "Lipid-lowering / Statin",
    default_dose: "1 tab",
    default_frequency: "0-0-1",
    default_duration: "30 days",
    default_instructions: "At night after dinner",
  },

  // Chronic: Diabetes Mellitus
  {
    name: "Metformin SR",
    strength: "500mg",
    form: "Tablet",
    category: "Antidiabetic",
    default_dose: "1 tab",
    default_frequency: "1-0-1",
    default_duration: "30 days",
    default_instructions: "With breakfast and dinner. Do not skip meals.",
  },
  {
    name: "Metformin ER",
    strength: "1000mg",
    form: "Tablet",
    category: "Antidiabetic",
    default_dose: "1 tab",
    default_frequency: "0-0-1",
    default_duration: "30 days",
    default_instructions: "With dinner daily",
  },
  {
    name: "Glimepiride",
    strength: "1mg",
    form: "Tablet",
    category: "Antidiabetic",
    default_dose: "1 tab",
    default_frequency: "1-0-0",
    default_duration: "30 days",
    default_instructions: "15 minutes before breakfast",
  },

  // Supplements & Miscellaneous
  {
    name: "Vitamin B-Complex with B12 & Zinc",
    strength: "Fortified",
    form: "Capsule",
    category: "Supplements",
    default_dose: "1 cap",
    default_frequency: "1-0-0",
    default_duration: "30 days",
    default_instructions: "After breakfast",
  },
  {
    name: "Calcium 500mg + Vitamin D3",
    strength: "500mg + 250 IU",
    form: "Tablet",
    category: "Supplements",
    default_dose: "1 tab",
    default_frequency: "0-1-0",
    default_duration: "30 days",
    default_instructions: "After lunch with a full glass of water",
  },
  {
    name: "Vitamin C + Zinc Chewable",
    strength: "500mg",
    form: "Tablet",
    category: "Supplements",
    default_dose: "1 tab",
    default_frequency: "1-0-0",
    default_duration: "15 days",
    default_instructions: "Chew after breakfast daily",
  },
];

// -------------------------------------------------------------
// 1-TAP PRE-SEEDED TREATMENT BUNDLES
// -------------------------------------------------------------

export type TreatmentBundle = {
  id: string;
  name: string;
  tag: string;
  category: string;
  description: string;
  notes: string;
  items: {
    drug_name: string;
    dose: string;
    frequency: string;
    duration: string;
    instructions: string;
  }[];
};

export const TREATMENT_BUNDLES: TreatmentBundle[] = [
  {
    id: "uri-cold",
    name: "URI / Common Cold & Cough",
    tag: "Viral Upper Respiratory",
    category: "Respiratory",
    description: "Acute viral cold, fever, throat irritation & dry cough",
    notes:
      "Diagnosis: Acute Upper Respiratory Tract Infection (URI).\nAdvice: Steam inhalation twice daily; sip lukewarm water; rest; avoid chilled beverages. Return if high fever persists > 3 days.",
    items: [
      {
        drug_name: "Paracetamol 650mg",
        dose: "1 tab",
        frequency: "1-0-1",
        duration: "3 days",
        instructions: "After meals (SOS for fever > 100°F or body ache)",
      },
      {
        drug_name: "Montelukast 10mg + Levocetirizine 5mg",
        dose: "1 tab",
        frequency: "0-0-1",
        duration: "5 days",
        instructions: "At bedtime with water",
      },
      {
        drug_name: "Dextromethorphan + Chlorpheniramine Syrup",
        dose: "10 ml",
        frequency: "1-1-1",
        duration: "5 days",
        instructions: "After meals for dry cough relief",
      },
      {
        drug_name: "Vitamin C 500mg + Zinc",
        dose: "1 tab",
        frequency: "1-0-0",
        duration: "7 days",
        instructions: "Chewable tablet after breakfast",
      },
    ],
  },
  {
    id: "gastroenteritis",
    name: "Acute Gastroenteritis / Diarrhea",
    tag: "GI / Food Poisoning",
    category: "Gastrointestinal",
    description: "Loose stools, nausea, abdominal cramps and dehydration risk",
    notes:
      "Diagnosis: Acute Gastroenteritis / Enteric upset.\nAdvice: Hydration is the cornerstone of recovery. Dissolve 1 ORS packet in 1 liter clean drinking water; sip frequently. Eat light, bland foods (khichdi, curd rice, banana). Strictly avoid dairy, oily foods, and raw salads for 48 hours.",
    items: [
      {
        drug_name: "ORS (Oral Rehydration Salts)",
        dose: "1 sachet in 1L water",
        frequency: "SOS",
        duration: "3 days",
        instructions: "Sip continuously throughout the day after each loose bowel movement",
      },
      {
        drug_name: "Ofloxacin 200mg + Ornidazole 500mg",
        dose: "1 tab",
        frequency: "1-0-1",
        duration: "5 days",
        instructions: "After food. Complete full 5 days.",
      },
      {
        drug_name: "Ondansetron 4mg",
        dose: "1 tab",
        frequency: "1-0-1",
        duration: "3 days",
        instructions: "30 minutes before food (or SOS for nausea / vomiting)",
      },
      {
        drug_name: "Pantoprazole 40mg",
        dose: "1 tab",
        frequency: "1-0-0",
        duration: "5 days",
        instructions: "Empty stomach 30 mins before morning breakfast",
      },
    ],
  },
  {
    id: "htn-followup",
    name: "Hypertension Routine Follow-up",
    tag: "Cardiovascular Chronic",
    category: "Cardiovascular",
    description: "Maintenance refill and regimen for Primary Essential Hypertension",
    notes:
      "Diagnosis: Essential Hypertension (Regular Maintenance Refill).\nAdvice: Restrict dietary sodium (< 5g / 1 tsp daily). Minimum 30 minutes brisk walking 5 days a week. Record home BP log twice weekly in morning and evening. Bring BP log on next monthly follow-up.",
    items: [
      {
        drug_name: "Telmisartan 40mg",
        dose: "1 tab",
        frequency: "1-0-0",
        duration: "30 days",
        instructions: "Morning after breakfast regularly",
      },
      {
        drug_name: "Amlodipine 5mg",
        dose: "1 tab",
        frequency: "0-0-1",
        duration: "30 days",
        instructions: "At night / bedtime",
      },
    ],
  },
  {
    id: "diabetic-routine",
    name: "Diabetic Routine (T2DM Follow-up)",
    tag: "Metabolic / Chronic",
    category: "Endocrinology",
    description: "Monthly maintenance regimen for Type 2 Diabetes Mellitus",
    notes:
      "Diagnosis: Type 2 Diabetes Mellitus (T2DM Routine Refill).\nAdvice: Maintain strict low-glycemic diabetic diet. Avoid direct sugar, jaggery, sweets, and carbonated beverages. Do not skip meals to prevent hypoglycemia. Fasting and post-prandial blood sugar tracking weekly; repeat HbA1c review in 3 months.",
    items: [
      {
        drug_name: "Metformin 500mg SR",
        dose: "1 tab",
        frequency: "1-0-1",
        duration: "30 days",
        instructions: "With meals (breakfast and dinner). Do not skip meals.",
      },
      {
        drug_name: "Glimepiride 1mg",
        dose: "1 tab",
        frequency: "1-0-0",
        duration: "30 days",
        instructions: "15 minutes before breakfast",
      },
      {
        drug_name: "Vitamin B-Complex with B12 & Zinc",
        dose: "1 cap",
        frequency: "1-0-0",
        duration: "30 days",
        instructions: "After breakfast for diabetic neuropathy protection",
      },
    ],
  },
  {
    id: "dental-pain",
    name: "Dental Pain & Infection / Abscess",
    tag: "Oral / Dental",
    category: "Dental",
    description: "Severe toothache, pulpitis, or dental abscess with inflammation",
    notes:
      "Diagnosis: Acute Dental Infection / Periapical inflammation.\nAdvice: Warm saline mouth gargles 3-4 times daily after meals. Avoid chewing hard or sticky foods on the affected side. Follow up with dentist in 5 days for definitive dental procedure / restoration.",
    items: [
      {
        drug_name: "Amoxicillin + Potassium Clavulanate 625mg",
        dose: "1 tab",
        frequency: "1-0-1",
        duration: "5 days",
        instructions: "After meals. Complete full 5 days without skipping.",
      },
      {
        drug_name: "Aceclofenac + Paracetamol + Serratiopeptidase",
        dose: "1 tab",
        frequency: "1-0-1",
        duration: "3 days",
        instructions: "After food for pain relief and swelling reduction",
      },
      {
        drug_name: "Metronidazole 400mg",
        dose: "1 tab",
        frequency: "1-1-1",
        duration: "5 days",
        instructions: "After food. Avoid all alcoholic beverages.",
      },
      {
        drug_name: "Pantoprazole 40mg",
        dose: "1 tab",
        frequency: "1-0-0",
        duration: "5 days",
        instructions: "Empty stomach 30 mins before breakfast",
      },
    ],
  },
  {
    id: "gerd-gastritis",
    name: "Acid Peptic Disease / GERD / Gastritis",
    tag: "Gastroenterology",
    category: "Gastrointestinal",
    description: "Heartburn, retrosternal burning, acid reflux, or epigastric pain",
    notes:
      "Diagnosis: Gastroesophageal Reflux Disease (GERD) / Dyspepsia.\nAdvice: Avoid spicy, fried, citrus, and caffeinated items. Take small, frequent meals rather than heavy dinners. Do not lie down within 2 hours of dinner. Elevate the head end of bed by 15-20 degrees.",
    items: [
      {
        drug_name: "Pantoprazole + Domperidone SR",
        dose: "1 cap",
        frequency: "1-0-0",
        duration: "14 days",
        instructions: "Empty stomach 30 minutes before morning breakfast",
      },
      {
        drug_name: "Antacid Gel (Magaldrate + Simethicone)",
        dose: "10 ml",
        frequency: "1-1-1",
        duration: "7 days",
        instructions: "1 hour after meals and at bedtime",
      },
    ],
  },
  {
    id: "msk-pain",
    name: "Acute Musculoskeletal / Joint / Back Pain",
    tag: "Orthopedics / Spine",
    category: "Orthopedics",
    description: "Acute muscle spasm, lumbago, cervical spasm, or sprain",
    notes:
      "Diagnosis: Acute Musculoskeletal Sprain / Myofascial Pain.\nAdvice: Apply local hot fomentation / hot pack for 15 mins 2-3 times daily. Strictly avoid bending forward and lifting heavy weights. Maintain upright ergonomic sitting posture. Gentle walking as tolerated.",
    items: [
      {
        drug_name: "Aceclofenac + Paracetamol 100mg + 325mg",
        dose: "1 tab",
        frequency: "1-0-1",
        duration: "5 days",
        instructions: "After food for analgesia",
      },
      {
        drug_name: "Pantoprazole 40mg",
        dose: "1 tab",
        frequency: "1-0-0",
        duration: "5 days",
        instructions: "Morning empty stomach to prevent gastric irritation",
      },
      {
        drug_name: "Vitamin B-Complex with B12 & Zinc",
        dose: "1 cap",
        frequency: "1-0-0",
        duration: "15 days",
        instructions: "After breakfast for nerve and muscle recovery",
      },
    ],
  },
];

// -------------------------------------------------------------
// DOSAGE TEMPLATE CHIPS
// -------------------------------------------------------------

export const DOSAGE_TEMPLATES = {
  doses: ["1 tab", "2 tabs", "1/2 tab", "1 cap", "5 ml", "10 ml", "1 sachet", "1 puff", "2 drops"],
  frequencies: [
    { label: "1-0-1", sub: "Twice daily (BID)" },
    { label: "1-0-0", sub: "Morning (OD)" },
    { label: "0-0-1", sub: "Night (HS)" },
    { label: "1-1-1", sub: "Thrice daily (TID)" },
    { label: "1-1-1-1", sub: "Four times (QID)" },
    { label: "SOS", sub: "As needed (PRN)" },
    { label: "Stat", sub: "Immediately once" },
    { label: "0-1-0", sub: "Afternoon" },
    { label: "Alt Day", sub: "Alternate days" },
  ],
  durations: ["3 days", "5 days", "7 days", "10 days", "14 days", "30 days (1 mo)", "Ongoing / Chronic"],
  instructions: [
    "After meals (Pc)",
    "Before meals (Ac)",
    "Empty stomach in morning",
    "At bedtime (Hs)",
    "With meals",
    "With warm water",
    "SOS for fever > 100°F",
  ],
};

// -------------------------------------------------------------
// MAIN PAGE COMPONENT
// -------------------------------------------------------------

function PrescriptionsPage() {
  const { org } = useOrganization();
  const clinic = useClinic();
  const navigate = useNavigate();
  const orgId = org?.id;

  const [tab, setTab] = useState("prescriptions");
  const [rxs, setRxs] = useState<Rx[]>([]);
  const [meds, setMeds] = useState<Med[]>([]);
  const [patients, setPatients] = useState<PatientOpt[]>([]);
  const [loading, setLoading] = useState(true);

  // Sheet / Modal states
  const [editing, setEditing] = useState<Rx | "new" | { cloneFrom: Rx } | null>(null);
  const [printRx, setPrintRx] = useState<Rx | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "week" | "month">("all");

  // Check URL parameters for initial actions (e.g. ?action=new or ?cloneFrom=...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    const cloneId = params.get("cloneFrom");
    const patientId = params.get("patientId");

    if (cloneId && rxs.length > 0) {
      const match = rxs.find((r) => r.id === cloneId);
      if (match) {
        setEditing({ cloneFrom: match });
        return;
      }
    }
    if (action === "new" || patientId) {
      setEditing("new");
    }
  }, [rxs]);

  async function load() {
    if (!orgId) return;
    setLoading(true);
    try {
      const [r, m, p] = await Promise.all([
        supabase
          .from("prescriptions" as any)
          .select("*")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false }),
        supabase
          .from("medications" as any)
          .select("*")
          .eq("organization_id", orgId)
          .order("name"),
        supabase
          .from("patients")
          .select("id, name, phone")
          .eq("organization_id", orgId)
          .order("name"),
      ]);

      const loadedRxs = (r.data as any[]) ?? [];

      // Fetch items preview for the top prescriptions to display medication summaries
      if (loadedRxs.length > 0) {
        const topRxIds = loadedRxs.slice(0, 30).map((rx) => rx.id);
        const { data: itemRows } = await supabase
          .from("prescription_items" as any)
          .select("prescription_id, drug_name")
          .in("prescription_id", topRxIds)
          .order("position");

        if (itemRows) {
          const map = new Map<string, string[]>();
          (itemRows as any[]).forEach((it) => {
            const list = map.get(it.prescription_id) || [];
            list.push(it.drug_name);
            map.set(it.prescription_id, list);
          });
          loadedRxs.forEach((rx) => {
            rx.items_summary = map.get(rx.id) || [];
          });
        }
      }

      setRxs(loadedRxs);
      setMeds((m.data as any[]) ?? []);
      setPatients((p.data as any[]) ?? []);
    } catch (err) {
      console.error("Failed to load prescriptions data:", err);
      toast.error("Could not load prescription records");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [orgId]);

  const filteredRx = useMemo(() => {
    let result = rxs;

    if (activeFilter === "week") {
      const oneWeekAgo = Date.now() - 7 * 86400e3;
      result = result.filter((r) => new Date(r.created_at).getTime() >= oneWeekAgo);
    } else if (activeFilter === "month") {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      result = result.filter((r) => {
        const d = new Date(r.created_at);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
    }

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (r) =>
          r.patient_name.toLowerCase().includes(q) ||
          (r.notes && r.notes.toLowerCase().includes(q)) ||
          (r.items_summary && r.items_summary.some((item) => item.toLowerCase().includes(q))),
      );
    }

    return result;
  }, [rxs, search, activeFilter]);

  async function remove(id: string) {
    if (!confirm("Are you sure you want to delete this prescription?")) return;
    try {
      await supabase.from("prescription_items" as any).delete().eq("prescription_id", id);
      await supabase.from("prescriptions" as any).delete().eq("id", id);
      toast.success("Prescription deleted");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete prescription");
    }
  }

  // Instant 1-tap re-order / clone prescription
  function handleCloneRx(rx: Rx) {
    setEditing({ cloneFrom: rx });
  }

  // WhatsApp share generator
  function shareViaWhatsApp(rx: Rx) {
    const clinicTitle = clinic?.clinic_name || org?.name || "Clinic";
    const doctorTitle = clinic?.doctor_name ? `Dr. ${clinic.doctor_name}` : "Attending Doctor";
    const dateFormatted = new Date(rx.created_at).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const drugsText =
      rx.items_summary && rx.items_summary.length > 0
        ? rx.items_summary.map((drug, i) => `${i + 1}. ${drug}`).join("\n")
        : "Standard maintenance medications";

    const msg = `*PRESCRIPTION & MEDICAL ADVICE*\n🏥 *${clinicTitle}*\n👨‍⚕️ ${doctorTitle}\n📅 Date: ${dateFormatted}\n\n*Patient:* ${rx.patient_name}\n\n*Prescribed Medications (℞):*\n${drugsText}\n\n${rx.notes ? `*Doctor's Clinical Notes:*\n${rx.notes}\n\n` : ""}📞 Clinic Contact: ${clinic?.phone || "Reception"}\n_Generated digitally via ClinicX EMR_`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-bold tracking-tight">Prescriptions (℞)</h1>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
              Digital EMR
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Fast prescription writer with 1-tap clinical bundles, dosage templates, and chronic patient re-orders.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => navigate({ to: "/dashboard/records" as any })}
          >
            <FolderHeart className="size-4 text-primary" />
            Medical Records Timeline
          </Button>
          <Button
            onClick={() => setEditing("new")}
            className="bg-primary text-primary-foreground shadow-xs gap-1.5"
          >
            <Plus className="size-4" />
            Write Prescription
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsCard
          title="Total Prescriptions"
          value={rxs.length}
          icon={<Pill className="size-4 text-primary" />}
        />
        <StatsCard
          title="Active Drug Catalog"
          value={meds.length || STANDARD_MEDICINE_CATALOG.length}
          icon={<BookOpen className="size-4 text-blue-500" />}
        />
        <StatsCard
          title="Issued This Week"
          value={
            rxs.filter((r) => new Date(r.created_at).getTime() > Date.now() - 7 * 86400e3).length
          }
          icon={<Clock className="size-4 text-amber-500" />}
        />
        <StatsCard
          title="Treatment Bundles"
          value={TREATMENT_BUNDLES.length}
          icon={<Zap className="size-4 text-emerald-500" />}
        />
      </div>

      {/* Main Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-3 border-b pb-2">
          <TabsList className="grid w-full sm:w-auto grid-cols-2">
            <TabsTrigger value="prescriptions" className="gap-2">
              <FileText className="size-4" />
              Prescriptions Feed ({rxs.length})
            </TabsTrigger>
            <TabsTrigger value="catalog" className="gap-2">
              <BookOpen className="size-4" />
              Drug Catalog &amp; Bundles ({meds.length || STANDARD_MEDICINE_CATALOG.length})
            </TabsTrigger>
          </TabsList>

          {tab === "prescriptions" && (
            <div className="flex items-center gap-2">
              <div className="flex items-center border rounded-lg p-0.5 bg-muted/30 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveFilter("all")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    activeFilter === "all" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All ({rxs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter("week")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    activeFilter === "week" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  This Week
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter("month")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    activeFilter === "month" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  This Month
                </button>
              </div>
            </div>
          )}
        </div>

        {/* PRESCRIPTIONS FEED TAB */}
        <TabsContent value="prescriptions" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search patient, medication (e.g. Paracetamol), or diagnosis…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-card"
              />
            </div>
            <div className="text-xs text-muted-foreground self-center">
              Showing {filteredRx.length} of {rxs.length} prescriptions
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : filteredRx.length === 0 ? (
            <EmptyState
              icon={<Pill className="size-8 text-primary" />}
              title="No prescriptions found"
              description="Write a digital prescription with 1-tap treatment bundles or pick medicines from your catalog."
              action={{
                label: "Write First Prescription",
                onClick: () => setEditing("new"),
              }}
            />
          ) : (
            <div className="space-y-3">
              {filteredRx.map((rx) => (
                <Card
                  key={rx.id}
                  className="p-4 sm:p-5 hover:border-primary/50 transition-all shadow-xs border-border/80 bg-card group"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Patient & Rx Details */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-serif font-bold text-lg text-primary">℞</span>
                        <h3 className="font-bold text-base text-foreground tracking-tight hover:text-primary transition-colors cursor-pointer" onClick={() => setEditing(rx)}>
                          {rx.patient_name}
                        </h3>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" />
                          {new Date(rx.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}{" "}
                          at{" "}
                          {new Date(rx.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {rx.patient_id && (
                          <button
                            type="button"
                            onClick={() => navigate({ to: "/dashboard/records" as any, search: { patientId: rx.patient_id } as any })}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline bg-primary/5 px-2 py-0.5 rounded-md"
                          >
                            <FolderHeart className="size-3" />
                            View Records
                          </button>
                        )}
                      </div>

                      {/* Prescribed Drugs Pills Summary */}
                      {rx.items_summary && rx.items_summary.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {rx.items_summary.map((drug, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="text-xs font-normal py-0.5 px-2 bg-muted/60 text-foreground"
                            >
                              <Pill className="size-2.5 mr-1 text-primary/70" />
                              {drug}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground italic">
                          Click to view detailed medicines &amp; dosage instructions
                        </div>
                      )}

                      {/* Doctor Clinical Notes / Diagnosis */}
                      {rx.notes && (
                        <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/30 p-2 rounded-lg border border-border/40">
                          <span className="font-medium text-foreground">Clinical Notes:</span>{" "}
                          {rx.notes}
                        </p>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center border-t md:border-t-0 pt-2 md:pt-0 w-full md:w-auto justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCloneRx(rx)}
                        className="h-8 text-xs gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 font-medium"
                        title="1-Click Re-order / Clone this prescription for a chronic or follow-up visit"
                      >
                        <Copy className="size-3.5" />
                        <span className="hidden sm:inline">Clone /</span> Re-order
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => shareViaWhatsApp(rx)}
                        className="h-8 text-xs gap-1 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                        title="Share prescription details on WhatsApp"
                      >
                        <Share2 className="size-3.5" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPrintRx(rx)}
                        className="h-8 text-xs gap-1.5"
                        title="Print or export PDF prescription"
                      >
                        <Printer className="size-3.5" />
                        Print
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditing(rx)}
                        className="size-8 text-muted-foreground hover:text-foreground"
                        title="Edit prescription"
                      >
                        <Pencil className="size-3.5" />
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(rx.id)}
                        className="size-8 text-muted-foreground hover:text-destructive"
                        title="Delete prescription"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* DRUG CATALOG & TREATMENT BUNDLES TAB */}
        <TabsContent value="catalog" className="space-y-6">
          <MedCatalog
            meds={meds}
            orgId={orgId!}
            onChanged={load}
            onUseBundle={(bundle) => {
              setTab("prescriptions");
              setEditing({
                patient_id: null,
                patient_name: "",
                notes: bundle.notes,
                created_at: new Date().toISOString(),
                id: "__bundle_" + bundle.id,
              } as any);
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Prescription Editor Sheet */}
      {editing && orgId && (
        <RxSheet
          orgId={orgId}
          patients={patients}
          meds={meds.length > 0 ? meds : (STANDARD_MEDICINE_CATALOG as any)}
          pastRxs={rxs}
          existing={
            editing === "new"
              ? null
              : typeof editing === "object" && "cloneFrom" in editing
                ? editing.cloneFrom
                : (editing as Rx)
          }
          isClone={typeof editing === "object" && "cloneFrom" in editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {/* Print Prescription Dialog */}
      {printRx && (
        <PrintDialog
          rx={printRx}
          org={org}
          clinic={clinic}
          onClose={() => setPrintRx(null)}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// MEDICINE CATALOG & BUNDLE BROWSER
// -------------------------------------------------------------

function MedCatalog({
  meds,
  orgId,
  onChanged,
  onUseBundle,
}: {
  meds: Med[];
  orgId: string;
  onChanged: () => void;
  onUseBundle: (bundle: TreatmentBundle) => void;
}) {
  const [open, setOpen] = useState<Med | "new" | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [f, setF] = useState({
    name: "",
    strength: "",
    form: "Tablet",
    category: "General",
    default_dose: "1 tab",
    default_frequency: "1-0-1",
    default_duration: "5 days",
    default_instructions: "After meals",
  });

  // Combine database catalog with standard catalog if db is empty
  const displayMeds = useMemo(() => {
    const list = meds.length > 0 ? meds : (STANDARD_MEDICINE_CATALOG.map((m, idx) => ({ ...m, id: `seed-${idx}` })) as Med[]);
    return list.filter((m) => {
      const q = catalogSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.strength && m.strength.toLowerCase().includes(q)) ||
        (m.form && m.form.toLowerCase().includes(q)) ||
        (m.category && m.category.toLowerCase().includes(q));

      const matchCat =
        categoryFilter === "all" ||
        (m.category && m.category.toLowerCase().includes(categoryFilter.toLowerCase()));

      return matchSearch && matchCat;
    });
  }, [meds, catalogSearch, categoryFilter]);

  // Seed standard formulary into Supabase DB
  async function seedStandardCatalog() {
    setSeeding(true);
    try {
      const payload = STANDARD_MEDICINE_CATALOG.map((m) => ({
        organization_id: orgId,
        name: m.name,
        strength: m.strength,
        form: m.form,
        default_dose: m.default_dose,
        default_instructions: [m.default_frequency, m.default_instructions].filter(Boolean).join(" · "),
      }));

      const { error } = await supabase.from("medications" as any).insert(payload);
      if (error) throw error;

      toast.success(`Successfully seeded ${payload.length} standard clinical medications into your clinic formulary!`);
      onChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to seed medication catalog");
    } finally {
      setSeeding(false);
    }
  }

  function openDialog(m: Med | "new") {
    setOpen(m);
    if (m === "new") {
      setF({
        name: "",
        strength: "",
        form: "Tablet",
        category: "General",
        default_dose: "1 tab",
        default_frequency: "1-0-1",
        default_duration: "5 days",
        default_instructions: "After meals",
      });
    } else {
      setF({
        name: m.name,
        strength: m.strength ?? "",
        form: m.form ?? "Tablet",
        category: m.category ?? "General",
        default_dose: m.default_dose ?? "1 tab",
        default_frequency: m.default_frequency ?? "1-0-1",
        default_duration: m.default_duration ?? "5 days",
        default_instructions: m.default_instructions ?? "After meals",
      });
    }
  }

  async function save() {
    if (!f.name.trim()) return toast.error("Medication name is required");
    const payload = {
      organization_id: orgId,
      name: f.name.trim(),
      strength: f.strength.trim() || null,
      form: f.form.trim() || null,
      default_dose: f.default_dose.trim() || null,
      default_instructions: [f.default_frequency.trim(), f.default_instructions.trim()].filter(Boolean).join(" · ") || null,
    };

    const { error } =
      open === "new" || open === null
        ? await supabase.from("medications" as any).insert(payload)
        : await supabase
            .from("medications" as any)
            .update(payload)
            .eq("id", (open as Med).id);

    if (error) return toast.error(error.message);
    toast.success("Medication saved to catalog");
    setOpen(null);
    onChanged();
  }

  async function remove(id: string) {
    if (id.startsWith("seed-")) {
      toast.info("This is a built-in standard medication. Click 'Seed Standard Catalog' to save it to your database.");
      return;
    }
    if (!confirm("Remove this medication from your clinic catalog?")) return;
    await supabase.from("medications" as any).delete().eq("id", id);
    toast.success("Medication removed");
    onChanged();
  }

  return (
    <div className="space-y-8">
      {/* 1-Tap Treatment Bundles Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold flex items-center gap-2">
              <Zap className="size-5 text-amber-500 fill-amber-500" />
              1-Tap Treatment Bundles
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Standard clinical protocols for instant 1-tap prescribing. Automatically populates medicines, dosages, and clinical advice.
            </p>
          </div>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
            {TREATMENT_BUNDLES.length} Bundles Ready
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TREATMENT_BUNDLES.map((b) => (
            <Card
              key={b.id}
              className="p-4 border-border/80 hover:border-primary/50 transition-all flex flex-col justify-between shadow-xs bg-card group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary" className="text-[10px] font-semibold uppercase tracking-wider">
                    {b.tag}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {b.items.length} medicines
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                    {b.name}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {b.description}
                  </p>
                </div>

                <div className="pt-2 space-y-1 border-t border-border/50">
                  {b.items.map((item, idx) => (
                    <div key={idx} className="text-xs flex items-center justify-between text-muted-foreground">
                      <span className="font-medium text-foreground truncate max-w-[170px]">
                        • {item.drug_name}
                      </span>
                      <span className="text-[11px] text-muted-foreground/80 shrink-0">
                        {item.frequency} ({item.duration})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 mt-2">
                <Button
                  size="sm"
                  className="w-full text-xs font-semibold gap-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                  onClick={() => onUseBundle(b)}
                >
                  <Sparkles className="size-3.5" />
                  Prescribe with This Bundle
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Drug Catalog Directory */}
      <Card className="p-5 space-y-4 border-border/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-bold flex items-center gap-2">
              <BookOpen className="size-5 text-primary" />
              Medication Catalog &amp; Formulary
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage your clinic's drug inventory, default dosages, and instructions for quick prescription writing.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {meds.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={seedStandardCatalog}
                disabled={seeding}
                className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5 text-xs font-semibold"
              >
                <RefreshCw className={`size-3.5 ${seeding ? "animate-spin" : ""}`} />
                {seeding ? "Seeding..." : "Seed Standard Formulary (34 Drugs)"}
              </Button>
            )}
            <Button size="sm" onClick={() => openDialog("new")} className="gap-1.5 text-xs">
              <Plus className="size-3.5" />
              Add Medication
            </Button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by drug name, strength, form (e.g. Paracetamol, 650mg, Tablet)…"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-48 h-9 text-xs">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Analgesic">Analgesic / Pain</SelectItem>
              <SelectItem value="Antibiotic">Antibiotics</SelectItem>
              <SelectItem value="Antacid">Antacids / GI</SelectItem>
              <SelectItem value="Cardiovascular">Cardiovascular / HTN</SelectItem>
              <SelectItem value="Antidiabetic">Antidiabetic</SelectItem>
              <SelectItem value="Respiratory">Respiratory &amp; Allergy</SelectItem>
              <SelectItem value="Supplements">Supplements &amp; Vitamins</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Medication List */}
        <div className="border rounded-xl divide-y overflow-hidden">
          {displayMeds.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No matching medications found. Try clearing your search or add a custom medication.
            </div>
          ) : (
            displayMeds.map((m) => (
              <div
                key={m.id}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-muted/40 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-foreground">{m.name}</span>
                    {m.strength && (
                      <Badge variant="outline" className="text-[11px] font-medium py-0 px-1.5">
                        {m.strength}
                      </Badge>
                    )}
                    {m.form && (
                      <Badge variant="secondary" className="text-[10px] font-medium py-0 px-1.5">
                        {m.form}
                      </Badge>
                    )}
                    {m.category && (
                      <span className="text-[11px] text-muted-foreground font-medium">
                        · {m.category}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">Default:</span>{" "}
                    {[m.default_dose, m.default_instructions].filter(Boolean).join(" · ") || "Standard dosage"}
                  </div>
                </div>

                <div className="flex items-center gap-1 self-end sm:self-center">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openDialog(m)}
                    className="size-8 text-muted-foreground hover:text-foreground"
                    title="Edit medication"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(m.id)}
                    className="size-8 text-muted-foreground hover:text-destructive"
                    title="Delete medication"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Add / Edit Medication Modal */}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              {open === "new" ? "Add Medication to Formulary" : "Edit Medication"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-2">
            <div>
              <Label className="text-xs">Drug / Generic Name *</Label>
              <Input
                placeholder="e.g. Amoxicillin + Clavulanate"
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Strength</Label>
                <Input
                  placeholder="e.g. 625mg or 40mg"
                  value={f.strength}
                  onChange={(e) => setF({ ...f, strength: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Form</Label>
                <Select value={f.form} onValueChange={(v) => setF({ ...f, form: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tablet">Tablet</SelectItem>
                    <SelectItem value="Capsule">Capsule</SelectItem>
                    <SelectItem value="Syrup">Syrup</SelectItem>
                    <SelectItem value="Injection">Injection</SelectItem>
                    <SelectItem value="Drops">Drops</SelectItem>
                    <SelectItem value="Sachet">Sachet</SelectItem>
                    <SelectItem value="Ointment">Ointment / Cream</SelectItem>
                    <SelectItem value="Inhaler">Inhaler</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Default Dose</Label>
                <Input
                  placeholder="e.g. 1 tab, 10 ml"
                  value={f.default_dose}
                  onChange={(e) => setF({ ...f, default_dose: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Default Frequency</Label>
                <Input
                  placeholder="e.g. 1-0-1 or 1-0-0"
                  value={f.default_frequency}
                  onChange={(e) => setF({ ...f, default_frequency: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Default Instructions</Label>
              <Input
                placeholder="e.g. After meals, with warm water"
                value={f.default_instructions}
                onChange={(e) => setF({ ...f, default_instructions: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save}>
              Save Medication
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// -------------------------------------------------------------
// PRESCRIPTION EDITOR SHEET (RxSheet)
// -------------------------------------------------------------

function RxSheet({
  orgId,
  patients,
  meds,
  pastRxs,
  existing,
  isClone,
  onClose,
  onSaved,
}: {
  orgId: string;
  patients: PatientOpt[];
  meds: Med[];
  pastRxs: Rx[];
  existing: Rx | null;
  isClone?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [patientId, setPatientId] = useState<string | null>(existing?.patient_id ?? null);
  const [patientName, setPatientName] = useState(existing?.patient_name ?? "");
  const [notes, setNotes] = useState(
    isClone && existing?.notes
      ? `Repeat refill. ${existing.notes}`
      : existing?.notes ?? "",
  );
  const [items, setItems] = useState<RxItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  // Auto-detect chronic patient past prescription
  const previousPatientRx = useMemo(() => {
    if (!patientId || patientId === "__manual") return null;
    return pastRxs.find((r) => r.patient_id === patientId && (!existing || r.id !== existing.id));
  }, [patientId, pastRxs, existing]);

  // Load existing items if editing or cloning
  useEffect(() => {
    if (existing && existing.id && !existing.id.startsWith("__bundle_")) {
      setLoadingItems(true);
      Promise.resolve(
        supabase
          .from("prescription_items" as any)
          .select("*")
          .eq("prescription_id", existing.id)
          .order("position"),
      )
        .then((r) => {
          const loaded = ((r.data as any[]) ?? []).map((it, idx) => ({
            id: isClone ? undefined : it.id,
            medication_id: it.medication_id,
            drug_name: it.drug_name,
            dose: it.dose ?? "1 tab",
            frequency: it.frequency ?? "1-0-1",
            duration: it.duration ?? "5 days",
            instructions: it.instructions ?? "After meals",
            position: idx,
          }));
          setItems(
            loaded.length > 0
              ? loaded
              : [
                  {
                    medication_id: null,
                    drug_name: "",
                    dose: "1 tab",
                    frequency: "1-0-1",
                    duration: "5 days",
                    instructions: "After meals",
                    position: 0,
                  },
                ],
          );
        })
        .finally(() => setLoadingItems(false));
    } else if (existing?.id?.startsWith("__bundle_")) {
      // Applied directly from a Treatment Bundle
      const bundleId = existing.id.replace("__bundle_", "");
      const bundle = TREATMENT_BUNDLES.find((b) => b.id === bundleId);
      if (bundle) {
        applyTreatmentBundle(bundle, "replace");
      }
    } else {
      setItems([
        {
          medication_id: null,
          drug_name: "",
          dose: "1 tab",
          frequency: "1-0-1",
          duration: "5 days",
          instructions: "After meals",
          position: 0,
        },
      ]);
    }
  }, [existing, isClone]);

  // Repeat Previous Prescription for chronic patients
  async function loadPreviousRxItems(prevRx: Rx) {
    try {
      const { data, error } = await supabase
        .from("prescription_items" as any)
        .select("*")
        .eq("prescription_id", prevRx.id)
        .order("position");

      if (error) throw error;
      if (data && data.length > 0) {
        const clonedItems: RxItem[] = (data as any[]).map((it, idx) => ({
          medication_id: it.medication_id,
          drug_name: it.drug_name,
          dose: it.dose ?? "1 tab",
          frequency: it.frequency ?? "1-0-1",
          duration: it.duration ?? "30 days",
          instructions: it.instructions ?? "After meals",
          position: idx,
        }));
        setItems(clonedItems);
        setNotes((prev) =>
          prev
            ? `${prev}\n[Chronic Refill from ${new Date(prevRx.created_at).toLocaleDateString("en-IN")}]`
            : `Chronic Regimen Refill (from previous prescription on ${new Date(prevRx.created_at).toLocaleDateString("en-IN")})`,
        );
        toast.success(`Loaded ${clonedItems.length} maintenance medications from previous prescription!`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load past prescription items");
    }
  }

  // 1-Tap Treatment Bundle Application
  function applyTreatmentBundle(bundle: TreatmentBundle, mode: "replace" | "append") {
    const bundleItems: RxItem[] = bundle.items.map((it, idx) => ({
      medication_id: null,
      drug_name: it.drug_name,
      dose: it.dose,
      frequency: it.frequency,
      duration: it.duration,
      instructions: it.instructions,
      position: idx,
    }));

    if (mode === "replace" || items.length === 0 || (items.length === 1 && !items[0].drug_name)) {
      setItems(bundleItems);
      setNotes(bundle.notes);
    } else {
      setItems([...items, ...bundleItems]);
      setNotes((prev) => (prev ? `${prev}\n\n${bundle.notes}` : bundle.notes));
    }
    toast.success(`Applied "${bundle.name}" protocol (${bundle.items.length} medicines)!`);
  }

  function addItem() {
    setItems([
      ...items,
      {
        medication_id: null,
        drug_name: "",
        dose: "1 tab",
        frequency: "1-0-1",
        duration: "5 days",
        instructions: "After meals",
        position: items.length,
      },
    ]);
  }

  function updItem(i: number, patch: Partial<RxItem>) {
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function removeItem(i: number) {
    if (items.length <= 1) {
      setItems([
        {
          medication_id: null,
          drug_name: "",
          dose: "1 tab",
          frequency: "1-0-1",
          duration: "5 days",
          instructions: "After meals",
          position: 0,
        },
      ]);
      return;
    }
    setItems(items.filter((_, idx) => idx !== i));
  }

  function pickMed(i: number, medId: string) {
    const m = meds.find((x) => x.id === medId);
    if (!m) return;
    updItem(i, {
      medication_id: m.id.startsWith("seed-") ? null : m.id,
      drug_name: `${m.name}${m.strength ? " " + m.strength : ""}`,
      dose: m.default_dose ?? "1 tab",
      frequency: m.default_frequency ?? "1-0-1",
      duration: m.default_duration ?? "5 days",
      instructions: m.default_instructions ?? "After meals",
    });
  }

  // Quick-save custom drug directly into clinic catalog
  async function saveDrugToCatalog(item: RxItem) {
    if (!item.drug_name.trim()) return toast.error("Enter drug name first");
    try {
      const { error } = await supabase.from("medications" as any).insert({
        organization_id: orgId,
        name: item.drug_name.trim(),
        default_dose: item.dose || null,
        default_instructions: [item.frequency, item.instructions].filter(Boolean).join(" · ") || null,
      });
      if (error) throw error;
      toast.success(`"${item.drug_name}" saved to your clinic medication catalog!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to save to catalog");
    }
  }

  async function save() {
    if (!patientName.trim()) return toast.error("Patient name is required");
    const valid = items.filter((it) => it.drug_name.trim());
    if (valid.length === 0) return toast.error("Please add at least one medication line");

    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      let rxId = !isClone && existing?.id && !existing.id.startsWith("__bundle_") ? existing.id : null;
      const cleanPatientId = patientId && patientId !== "__manual" ? patientId : null;
      const cleanPatientName = patientName.trim();
      const cleanNotes = notes.trim() || null;

      if (rxId) {
        // Update existing prescription
        const { error: rxErr } = await supabase
          .from("prescriptions" as any)
          .update({
            patient_id: cleanPatientId,
            patient_name: cleanPatientName,
            notes: cleanNotes,
          })
          .eq("id", rxId);
        if (rxErr) throw rxErr;

        // Delete old items and re-insert fresh
        await supabase
          .from("prescription_items" as any)
          .delete()
          .eq("prescription_id", rxId);
      } else {
        // Create new prescription (or cloned new prescription)
        const { data, error } = await supabase
          .from("prescriptions" as any)
          .insert({
            organization_id: orgId,
            patient_id: cleanPatientId,
            patient_name: cleanPatientName,
            notes: cleanNotes,
            issued_by: u.user?.id ?? null,
          })
          .select("id")
          .single();

        if (error || !data) {
          throw error || new Error("Failed to create prescription");
        }
        rxId = (data as any).id;
      }

      const itemsPayload = valid.map((it, idx) => ({
        organization_id: orgId,
        prescription_id: rxId,
        medication_id: it.medication_id && !it.medication_id.startsWith("seed-") && it.medication_id !== "__custom" ? it.medication_id : null,
        drug_name: it.drug_name.trim(),
        dose: it.dose.trim() || null,
        frequency: it.frequency.trim() || null,
        duration: it.duration.trim() || null,
        instructions: it.instructions.trim() || null,
        position: idx + 1,
      }));

      if (itemsPayload.length) {
        const { error: itemsErr } = await supabase
          .from("prescription_items" as any)
          .insert(itemsPayload);
        if (itemsErr) throw itemsErr;
      }

      toast.success(
        isClone
          ? "Cloned prescription saved successfully as a new Rx!"
          : existing
            ? "Prescription updated!"
            : "Digital prescription saved successfully!",
      );
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to save prescription");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto p-4 sm:p-6">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-display text-xl flex items-center gap-2">
              <span className="font-serif text-2xl text-primary">℞</span>
              {isClone
                ? "Repeat / Re-order Prescription"
                : existing
                  ? "Edit Prescription"
                  : "Write New Prescription"}
            </SheetTitle>
            {isClone && (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                Cloned Regimen
              </Badge>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-6 mt-4">
          {/* Patient Selection Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-muted/20 p-3.5 rounded-xl border">
            <div>
              <Label className="text-xs font-semibold">Select Patient from Directory</Label>
              <Select
                value={patientId ?? "__manual"}
                onValueChange={(v) => {
                  if (v === "__manual") {
                    setPatientId(null);
                    return;
                  }
                  setPatientId(v);
                  const p = patients.find((x) => x.id === v);
                  if (p) setPatientName(p.name);
                }}
              >
                <SelectTrigger className="mt-1 bg-card">
                  <SelectValue placeholder="Search or select patient" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="__manual">— Type Manually / New Patient —</SelectItem>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.phone ? `(${p.phone})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Patient Name *</Label>
              <Input
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Patient Full Name"
                className="mt-1 bg-card"
              />
            </div>
          </div>

          {/* Chronic Patient Previous Rx Banner */}
          {previousPatientRx && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <BookmarkCheck className="size-4" />
                  Past Prescription Found ({new Date(previousPatientRx.created_at).toLocaleDateString("en-IN")})
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Repeat this chronic patient's regular medication regimen in 1 tap.
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => loadPreviousRxItems(previousPatientRx)}
                className="text-xs font-bold text-emerald-700 bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 shrink-0 gap-1.5"
              >
                <Zap className="size-3.5 fill-emerald-600" />
                Repeat Past Rx
              </Button>
            </div>
          )}

          {/* 1-Tap Treatment Bundles Quick Chips */}
          <div className="space-y-2 bg-muted/30 p-3 rounded-xl border border-border/60">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                <Zap className="size-3.5 text-amber-500 fill-amber-500" />
                1-Tap Treatment Bundles
              </Label>
              <span className="text-[11px] text-muted-foreground">Click to auto-populate</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {TREATMENT_BUNDLES.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => applyTreatmentBundle(b, "replace")}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border border-border/70 bg-card hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all text-foreground font-medium shadow-2xs"
                >
                  <Sparkles className="size-3 text-amber-500" />
                  <span>{b.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Prescribed Medications Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold flex items-center gap-2">
                <Pill className="size-4 text-primary" />
                Prescribed Medications ({items.length})
              </Label>
              <Button size="sm" variant="outline" onClick={addItem} className="h-8 text-xs gap-1">
                <Plus className="size-3.5" />
                Add Medicine
              </Button>
            </div>

            {loadingItems ? (
              <div className="space-y-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((it, i) => (
                  <Card
                    key={i}
                    className="p-3.5 space-y-3 border-border/80 bg-card shadow-xs relative"
                  >
                    {/* Top Row: Med Picker + Drug Name */}
                    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                      <span className="text-xs font-bold text-muted-foreground size-5 rounded-full bg-muted grid place-items-center shrink-0">
                        {i + 1}
                      </span>

                      {/* Dropdown from catalog */}
                      <Select
                        value={it.medication_id ?? "__custom"}
                        onValueChange={(v) =>
                          v === "__custom" ? updItem(i, { medication_id: null }) : pickMed(i, v)
                        }
                      >
                        <SelectTrigger className="w-full sm:w-56 h-8 text-xs bg-muted/30">
                          <SelectValue placeholder="From Formulary" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          <SelectItem value="__custom">— Custom Drug —</SelectItem>
                          {meds.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name} {m.strength ? `(${m.strength})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Drug Name text field */}
                      <Input
                        placeholder="Drug name (e.g. Paracetamol 650mg)"
                        value={it.drug_name}
                        onChange={(e) => updItem(i, { drug_name: e.target.value })}
                        className="h-8 text-xs font-semibold flex-1"
                      />

                      {/* Save custom drug to catalog button */}
                      {it.drug_name && !it.medication_id && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => saveDrugToCatalog(it)}
                          className="h-8 text-[11px] text-primary hover:bg-primary/10 px-2 shrink-0 gap-1"
                          title="Save this drug into your clinic catalog for future quick-select"
                        >
                          <BookOpen className="size-3" />
                          <span className="hidden sm:inline">Save to</span> Catalog
                        </Button>
                      )}

                      {/* Remove item button */}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeItem(i)}
                        className="size-8 text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>

                    {/* Middle Row: Dose, Frequency, Duration Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Dosage</Label>
                        <Input
                          placeholder="e.g. 1 tab / 10 ml"
                          value={it.dose}
                          onChange={(e) => updItem(i, { dose: e.target.value })}
                          className="h-8 text-xs mt-0.5"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Frequency</Label>
                        <Input
                          placeholder="e.g. 1-0-1 / SOS"
                          value={it.frequency}
                          onChange={(e) => updItem(i, { frequency: e.target.value })}
                          className="h-8 text-xs mt-0.5"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Duration</Label>
                        <Input
                          placeholder="e.g. 5 days / 30 days"
                          value={it.duration}
                          onChange={(e) => updItem(i, { duration: e.target.value })}
                          className="h-8 text-xs mt-0.5"
                        />
                      </div>
                    </div>

                    {/* Quick Dosage & Frequency Chips Row */}
                    <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-border/40 text-[11px]">
                      <span className="text-[10px] font-semibold text-muted-foreground mr-1">
                        Quick Freq:
                      </span>
                      {DOSAGE_TEMPLATES.frequencies.slice(0, 6).map((freq) => (
                        <button
                          key={freq.label}
                          type="button"
                          onClick={() => updItem(i, { frequency: freq.label })}
                          className={`px-1.5 py-0.5 rounded text-[11px] border transition-colors ${
                            it.frequency === freq.label
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/40 hover:bg-muted text-muted-foreground"
                          }`}
                          title={freq.sub}
                        >
                          {freq.label}
                        </button>
                      ))}

                      <span className="text-[10px] font-semibold text-muted-foreground mx-1">
                        Duration:
                      </span>
                      {["3 days", "5 days", "7 days", "14 days", "30 days"].map((dur) => (
                        <button
                          key={dur}
                          type="button"
                          onClick={() => updItem(i, { duration: dur })}
                          className={`px-1.5 py-0.5 rounded text-[11px] border transition-colors ${
                            it.duration === dur
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/40 hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          {dur}
                        </button>
                      ))}
                    </div>

                    {/* Instructions Row */}
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Instructions &amp; Timing</Label>
                      <Input
                        placeholder="e.g. After meals with warm water"
                        value={it.instructions}
                        onChange={(e) => updItem(i, { instructions: e.target.value })}
                        className="h-8 text-xs mt-0.5"
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {DOSAGE_TEMPLATES.instructions.map((ins) => (
                          <button
                            key={ins}
                            type="button"
                            onClick={() => updItem(i, { instructions: ins })}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 hover:bg-muted text-muted-foreground transition-colors border"
                          >
                            + {ins}
                          </button>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Doctor Notes & Clinical Advice */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs font-semibold">Clinical Notes, Advice &amp; Follow-up</Label>
              <span className="text-[11px] text-muted-foreground">Printed on prescription slip</span>
            </div>
            <Textarea
              placeholder="e.g. Rest, steam inhalation twice daily, low-salt diet. Follow up in 5 days."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[85px] text-xs bg-card"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex gap-2.5 justify-end pt-3 border-t">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={saving}
              className="bg-primary text-primary-foreground min-w-[120px] gap-1.5"
            >
              <Check className="size-4" />
              {saving ? "Saving Rx…" : isClone ? "Save Cloned Rx" : "Save Prescription"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// -------------------------------------------------------------
// PRINT & EXPORT PRESCRIPTION DIALOG
// -------------------------------------------------------------

function PrintDialog({
  rx,
  org,
  clinic,
  onClose,
}: {
  rx: Rx;
  org: any;
  clinic: any;
  onClose: () => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.resolve(
      supabase
        .from("prescription_items" as any)
        .select("*")
        .eq("prescription_id", rx.id)
        .order("position"),
    )
      .then((r) => setItems((r.data as any[]) ?? []))
      .finally(() => setLoading(false));
  }, [rx.id]);

  const clinicName = clinic?.clinic_name || org?.name || "Medical Clinic";
  const doctorName = clinic?.doctor_name ? `Dr. ${clinic.doctor_name}` : "Attending Physician";
  const doctorReg = clinic?.medical_registration_no ? `Reg No: ${clinic.medical_registration_no}` : "";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display text-lg">Prescription Preview</DialogTitle>
            <Badge variant="outline" className="text-xs">
              Print Ready
            </Badge>
          </div>
        </DialogHeader>

        {/* Printable Prescription Slip */}
        <div
          className="p-6 sm:p-8 bg-white text-black rounded-xl border shadow-xs print:border-0 print:p-0"
          id="rx-print-area"
        >
          {/* Clinic Header */}
          <div className="flex justify-between items-start border-b-2 border-primary/60 pb-4 mb-4">
            <div>
              <h2 className="font-bold text-2xl tracking-tight text-gray-900">{clinicName}</h2>
              <div className="text-sm font-semibold text-primary mt-0.5">{doctorName}</div>
              {doctorReg && <div className="text-xs text-gray-500">{doctorReg}</div>}
              {clinic?.address && <div className="text-xs text-gray-500 mt-1">{clinic.address}</div>}
            </div>

            <div className="text-right text-xs text-gray-500 space-y-1">
              <div className="font-bold text-gray-700 text-sm">DIGITAL PRESCRIPTION</div>
              <div>
                <strong>Date:</strong>{" "}
                {new Date(rx.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </div>
              <div>
                <strong>Time:</strong>{" "}
                {new Date(rx.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              {clinic?.phone && <div><strong>Phone:</strong> {clinic.phone}</div>}
            </div>
          </div>

          {/* Patient Details Bar */}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-5 flex justify-between items-center text-sm">
            <div>
              <span className="text-gray-500">Patient: </span>
              <strong className="text-gray-900 font-bold">{rx.patient_name}</strong>
            </div>
            <div className="text-xs text-gray-500">
              Rx Ref: <span className="font-mono">{rx.id.slice(0, 8).toUpperCase()}</span>
            </div>
          </div>

          {/* Classical ℞ Symbol */}
          <div className="text-3xl font-serif font-bold text-primary mb-3">℞</div>

          {/* Medications Table */}
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="py-2.5 pr-2 w-8">#</th>
                    <th className="py-2.5 pr-3">Medication Name</th>
                    <th className="py-2.5 pr-3">Dose</th>
                    <th className="py-2.5 pr-3">Frequency</th>
                    <th className="py-2.5 pr-3">Duration</th>
                    <th className="py-2.5">Instructions &amp; Timing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((it, idx) => (
                    <tr key={it.id || idx} className="hover:bg-gray-50/50">
                      <td className="py-2.5 pr-2 text-xs text-gray-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 pr-3 font-bold text-gray-900">{it.drug_name}</td>
                      <td className="py-2.5 pr-3 text-gray-700">{it.dose || "1 tab"}</td>
                      <td className="py-2.5 pr-3 font-semibold text-primary">{it.frequency || "1-0-1"}</td>
                      <td className="py-2.5 pr-3 text-gray-700">{it.duration || "5 days"}</td>
                      <td className="py-2.5 text-gray-600 text-xs">{it.instructions || "After meals"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Clinical Notes / Advice */}
          {rx.notes && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Clinical Advice &amp; Notes:
              </div>
              <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">
                {rx.notes}
              </p>
            </div>
          )}

          {/* Doctor Signature Block */}
          <div className="mt-12 pt-6 flex justify-between items-end border-t border-gray-200 text-xs">
            <div className="text-gray-400 text-[10px]">
              This prescription was electronically verified by registered practitioner.
            </div>
            <div className="text-right">
              <div className="h-10 border-b border-gray-300 w-44 mb-1"></div>
              <div className="font-bold text-gray-800">{doctorName}</div>
              {doctorReg && <div className="text-[11px] text-gray-500">{doctorReg}</div>}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={() => {
              window.print();
            }}
            className="gap-1.5"
          >
            <Printer className="size-4" />
            Print / Save PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
