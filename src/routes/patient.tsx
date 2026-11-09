import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  HeartPulse,
  FileText,
  Calendar,
  Pill,
  FlaskConical,
  Upload,
  User,
  Users,
  ShieldCheck,
  QrCode,
  ArrowRight,
  Phone,
  Search,
  CheckCircle2,
  Clock,
  Printer,
  ChevronRight,
  AlertCircle,
  Download,
  Share2,
  Lock,
  Plus,
  Activity,
  Stethoscope,
  Sparkles,
  RefreshCw,
  ShoppingBag,
  ExternalLink,
  MapPin,
  IndianRupee,
  Check,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export const Route = createFileRoute("/patient")({
  component: PatientSuperAppPage,
});

// Family Members Profile Types
type FamilyMember = {
  id: string;
  name: string;
  relation: "Self" | "Spouse" | "Child" | "Parent";
  age: number;
  gender: "Male" | "Female" | "Other";
  bloodGroup: string;
  abhaId: string;
  abhaAddress: string;
  allergies: string[];
  chronicConditions: string[];
};

// Universal Health Record Types
type HealthRecord = {
  id: string;
  memberId: string;
  type: "prescription" | "consultation" | "lab_report" | "patient_upload";
  title: string;
  doctorName?: string;
  doctorRegNo?: string;
  doctorSpecialty?: string;
  clinicName: string;
  date: string;
  trustTier: "verified_doctor" | "verified_lab" | "patient_uploaded";
  summary: string;
  vitals?: {
    bp?: string;
    pulse?: number;
    spo2?: number;
    bloodSugar?: number;
    weight?: number;
    temp?: number;
  };
  diagnosis?: string;
  medicines?: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
  }>;
  labTests?: Array<{
    testName: string;
    value: string;
    unit: string;
    normalRange: string;
    isAbnormal: boolean;
  }>;
  fileUrl?: string;
  fileName?: string;
};

// Initial Sample Indian Healthcare Records
const INITIAL_FAMILY: FamilyMember[] = [
  {
    id: "fam-1",
    name: "Rajesh Sharma",
    relation: "Self",
    age: 42,
    gender: "Male",
    bloodGroup: "O+",
    abhaId: "14-9821-4390-1284",
    abhaAddress: "rajesh.sharma@abdm",
    allergies: ["Penicillin", "Sulfa drugs"],
    chronicConditions: ["Hypertension (Controlled)"],
  },
  {
    id: "fam-2",
    name: "Sunita Sharma",
    relation: "Spouse",
    age: 39,
    gender: "Female",
    bloodGroup: "B+",
    abhaId: "14-7712-9014-5521",
    abhaAddress: "sunita.sharma@abdm",
    allergies: ["None known"],
    chronicConditions: ["Hypothyroidism"],
  },
  {
    id: "fam-3",
    name: "Aarav Sharma",
    relation: "Child",
    age: 10,
    gender: "Male",
    bloodGroup: "O+",
    abhaId: "14-3310-8841-9920",
    abhaAddress: "aarav.sharma@abdm",
    allergies: ["Dust mite"],
    chronicConditions: ["Mild Asthma"],
  },
  {
    id: "fam-4",
    name: "Kamla Sharma",
    relation: "Parent",
    age: 68,
    gender: "Female",
    bloodGroup: "A+",
    abhaId: "14-1102-5541-6678",
    abhaAddress: "kamla.sharma@abdm",
    allergies: ["Aspirin"],
    chronicConditions: ["Type 2 Diabetes", "Osteoarthritis"],
  },
];

const INITIAL_RECORDS: HealthRecord[] = [
  {
    id: "rec-1",
    memberId: "fam-1",
    type: "prescription",
    title: "OPD Digital Prescription",
    doctorName: "Dr. Ananya Roy",
    doctorRegNo: "MCI-48912/2014",
    doctorSpecialty: "Cardiologist & General Physician",
    clinicName: "Apex Heart & Medical Center, Delhi",
    date: "2026-11-04",
    trustTier: "verified_doctor",
    summary: "Routine cardiovascular review. Blood pressure stable on current regimen.",
    vitals: { bp: "124/82 mmHg", pulse: 74, spo2: 99, weight: 76, bloodSugar: 108 },
    diagnosis: "Essential Hypertension (Stage 1 - Well Controlled)",
    medicines: [
      {
        name: "Telmisartan 40mg",
        dosage: "1 Tab",
        frequency: "1-0-0",
        duration: "30 Days",
        instructions: "Morning after breakfast",
      },
      {
        name: "Rosuvastatin 10mg",
        dosage: "1 Tab",
        frequency: "0-0-1",
        duration: "30 Days",
        instructions: "Bedtime",
      },
    ],
  },
  {
    id: "rec-2",
    memberId: "fam-1",
    type: "lab_report",
    title: "Comprehensive Metabolic & Lipid Panel",
    doctorName: "Dr. S. K. Gupta (Pathologist)",
    clinicName: "Apollo Diagnostics / NABL Lab",
    date: "2026-10-28",
    trustTier: "verified_lab",
    summary: "Fast lipid panel and glycosylated hemoglobin (HbA1c).",
    labTests: [
      { testName: "HbA1c (Glycated Hemoglobin)", value: "5.6", unit: "%", normalRange: "< 5.7", isAbnormal: false },
      { testName: "Total Cholesterol", value: "182", unit: "mg/dL", normalRange: "< 200", isAbnormal: false },
      { testName: "Triglycerides", value: "145", unit: "mg/dL", normalRange: "< 150", isAbnormal: false },
      { testName: "LDL Cholesterol", value: "98", unit: "mg/dL", normalRange: "< 100", isAbnormal: false },
      { testName: "HDL (Good Cholesterol)", value: "48", unit: "mg/dL", normalRange: "> 40", isAbnormal: false },
      { testName: "Serum Creatinine", value: "0.95", unit: "mg/dL", normalRange: "0.7 - 1.2", isAbnormal: false },
    ],
  },
  {
    id: "rec-3",
    memberId: "fam-1",
    type: "patient_upload",
    title: "Historical Paper Prescription Scan",
    clinicName: "Uploaded by Patient (Dr. Verma Clinic)",
    date: "2026-08-15",
    trustTier: "patient_uploaded",
    summary: "Physical prescription scan uploaded by patient for knee ache follow-up.",
    fileName: "Dr_Verma_Knee_Prescription_Aug2026.pdf",
    diagnosis: "Mild patellar tendinitis",
  },
  {
    id: "rec-4",
    memberId: "fam-4",
    type: "prescription",
    title: "Diabetic Care & Glycemic Control Rx",
    doctorName: "Dr. Arvind Mehta",
    doctorRegNo: "DMC-39120",
    doctorSpecialty: "Endocrinologist",
    clinicName: "Medanta Specialty OPD, Gurugram",
    date: "2026-10-18",
    trustTier: "verified_doctor",
    summary: "Glycemic review. Metformin dosage titrated. Advised HbA1c review in 3 months.",
    vitals: { bp: "132/86 mmHg", pulse: 78, bloodSugar: 142, weight: 62 },
    diagnosis: "Type 2 Diabetes Mellitus with Mild Neuropathy",
    medicines: [
      {
        name: "Metformin 500mg (SR)",
        dosage: "1 Tab",
        frequency: "1-0-1",
        duration: "60 Days",
        instructions: "With breakfast and dinner",
      },
      {
        name: "Pregabalin 75mg",
        dosage: "1 Cap",
        frequency: "0-0-1",
        duration: "30 Days",
        instructions: "Night for tingling sensation",
      },
    ],
  },
];

const DISCOVERY_DOCTORS = [
  {
    id: "doc-1",
    name: "Dr. Ananya Roy",
    qualification: "MBBS, MD (Medicine), DM (Cardiology)",
    specialty: "Cardiologist",
    clinic: "Apex Heart & Medical Center",
    city: "New Delhi",
    fee: 600,
    experience: "14 yrs",
    availableToday: true,
    rating: 4.9,
    slug: "apex-heart-center",
  },
  {
    id: "doc-2",
    name: "Dr. Arvind Mehta",
    qualification: "MBBS, MD (Endocrinology)",
    specialty: "Endocrinologist / Diabetes Specialist",
    clinic: "Medanta Specialty OPD",
    city: "Gurugram",
    fee: 800,
    experience: "18 yrs",
    availableToday: true,
    rating: 4.8,
    slug: "medanta-opd",
  },
  {
    id: "doc-3",
    name: "Dr. Pooja Iyer",
    qualification: "MBBS, DCH, DNB (Pediatrics)",
    specialty: "Pediatrician",
    clinic: "Little Stars Child Clinic",
    city: "Bengaluru",
    fee: 500,
    experience: "11 yrs",
    availableToday: false,
    rating: 4.9,
    slug: "little-stars-child-clinic",
  },
  {
    id: "doc-4",
    name: "Dr. Rohan Kulkarni",
    qualification: "MBBS, MS (Orthopedics)",
    specialty: "Orthopedic Surgeon",
    clinic: "Pune Bone & Joint Clinic",
    city: "Pune",
    fee: 700,
    experience: "16 yrs",
    availableToday: true,
    rating: 4.7,
    slug: "bone-joint-clinic",
  },
];

function PatientSuperAppPage() {
  const [family, setFamily] = useState<FamilyMember[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("clinicx_patient_family");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return INITIAL_FAMILY;
  });

  const [activeMemberId, setActiveMemberId] = useState<string>("fam-1");
  const [records, setRecords] = useState<HealthRecord[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("clinicx_patient_records");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return INITIAL_RECORDS;
  });

  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<HealthRecord | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAbhaModalOpen, setIsAbhaModalOpen] = useState(false);
  const [isPharmacyOrderOpen, setIsPharmacyOrderOpen] = useState(false);
  const [pharmacyItems, setPharmacyItems] = useState<string[]>([]);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("all");

  // Upload Form State
  const [uploadCategory, setUploadCategory] = useState<string>("patient_upload");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadClinic, setUploadClinic] = useState("");
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split("T")[0]);
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadFileName, setUploadFileName] = useState("");

  // Persist local state
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("clinicx_patient_family", JSON.stringify(family));
    }
  }, [family]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("clinicx_patient_records", JSON.stringify(records));
    }
  }, [records]);

  const activeMember = useMemo(() => {
    return family.find((m) => m.id === activeMemberId) || family[0];
  }, [family, activeMemberId]);

  // Filter records for active family member
  const memberRecords = useMemo(() => {
    return records
      .filter((r) => r.memberId === activeMemberId)
      .filter((r) => {
        if (filterType !== "all" && r.type !== filterType) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            r.title.toLowerCase().includes(q) ||
            r.clinicName.toLowerCase().includes(q) ||
            r.doctorName?.toLowerCase().includes(q) ||
            r.diagnosis?.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records, activeMemberId, filterType, searchQuery]);

  // Handle Document Upload
  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) {
      toast.error("Please enter a document title");
      return;
    }

    const newRec: HealthRecord = {
      id: "rec-" + Date.now(),
      memberId: activeMemberId,
      type: uploadCategory as any,
      title: uploadTitle.trim(),
      clinicName: uploadClinic.trim() || "Uploaded by Patient",
      date: uploadDate,
      trustTier: "patient_uploaded",
      summary: uploadNotes.trim() || "Patient uploaded health record document.",
      fileName: uploadFileName || "Uploaded_Medical_Scan_" + Date.now() + ".pdf",
    };

    setRecords((prev) => [newRec, ...prev]);
    setIsUploadOpen(false);
    setUploadTitle("");
    setUploadClinic("");
    setUploadNotes("");
    setUploadFileName("");
    toast.success("Document added to Universal Health Profile!");
  };

  // Handle Order Medicines
  const handleOpenPharmacyOrder = (rx: HealthRecord) => {
    if (!rx.medicines || rx.medicines.length === 0) {
      toast.error("No prescribed medicines found in this record.");
      return;
    }
    setPharmacyItems(rx.medicines.map((m) => `${m.name} (${m.dosage} - ${m.duration})`));
    setIsPharmacyOrderOpen(true);
  };

  const handleConfirmPharmacyOrder = () => {
    setIsPharmacyOrderOpen(false);
    toast.success("Pharmacy order placed! Nearest licensed partner pharmacy will contact you for delivery.");
  };

  // Filtered Doctors
  const filteredDoctors = useMemo(() => {
    return DISCOVERY_DOCTORS.filter((d) => {
      if (selectedSpecialty !== "all" && d.specialty.toLowerCase() !== selectedSpecialty.toLowerCase()) {
        return false;
      }
      if (doctorSearch.trim()) {
        const q = doctorSearch.toLowerCase();
        return (
          d.name.toLowerCase().includes(q) ||
          d.specialty.toLowerCase().includes(q) ||
          d.clinic.toLowerCase().includes(q) ||
          d.city.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [doctorSearch, selectedSpecialty]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Top Universal Health Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 shadow-xs backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="size-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm shadow-blue-500/20">
                <HeartPulse className="size-5" />
              </div>
              <div>
                <div className="font-bold text-base tracking-tight leading-none text-slate-900 flex items-center gap-1.5">
                  One Health Account <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full">Bharat</span>
                </div>
                <div className="text-[11px] text-slate-500">Universal Health Profile & ABHA</div>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* ABHA Badge Shortcut */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAbhaModalOpen(true)}
              className="h-8 gap-1.5 border-emerald-300 text-emerald-800 bg-emerald-50/60 hover:bg-emerald-100/80 text-xs font-semibold rounded-lg"
            >
              <ShieldCheck className="size-3.5 text-emerald-600" />
              <span className="hidden sm:inline">ABHA ID:</span> {activeMember.abhaId.slice(0, 7)}...
            </Button>

            {/* Emergency 108 SOS */}
            <a
              href="tel:108"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-xs font-bold transition-colors"
              title="Call National Ambulance Service"
            >
              <Phone className="size-3 text-red-600" />
              <span>SOS 108</span>
            </a>

            <Link to="/">
              <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-600">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Profile & Family Switcher Section */}
      <div className="bg-gradient-to-b from-blue-900 via-indigo-950 to-slate-900 text-white pt-6 pb-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="size-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl font-bold text-white shadow-inner shrink-0">
                {activeMember.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">{activeMember.name}</h1>
                  <Badge variant="outline" className="border-blue-400/40 text-blue-200 bg-blue-500/10 text-xs">
                    {activeMember.relation}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-blue-200/80 mt-1">
                  <span>Age: <b>{activeMember.age} yrs</b></span>
                  <span>•</span>
                  <span>Gender: <b>{activeMember.gender}</b></span>
                  <span>•</span>
                  <span>Blood: <b className="text-red-300">{activeMember.bloodGroup}</b></span>
                  <span>•</span>
                  <span className="font-mono text-emerald-300">ABHA: {activeMember.abhaAddress}</span>
                </div>

                {/* Allergies and Chronic conditions tag */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                  {activeMember.allergies.map((alg) => (
                    <span
                      key={alg}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-200 border border-amber-500/30"
                    >
                      <AlertCircle className="size-2.5" /> Allergy: {alg}
                    </span>
                  ))}
                  {activeMember.chronicConditions.map((cond) => (
                    <span
                      key={cond}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-200 border border-blue-500/30"
                    >
                      <Activity className="size-2.5" /> {cond}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Button
                onClick={() => setIsUploadOpen(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold gap-1.5 h-10 shadow-lg shadow-blue-900/40"
              >
                <Upload className="size-4" /> Upload Health Record
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsAbhaModalOpen(true)}
                className="border-white/20 bg-white/5 hover:bg-white/10 text-white font-medium gap-1.5 h-10"
              >
                <QrCode className="size-4 text-emerald-400" /> Digital ABHA Card
              </Button>
            </div>
          </div>

          {/* Family Profiles Bar */}
          <div className="mt-6 pt-5 border-t border-white/10 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-2 shrink-0 flex items-center gap-1">
              <Users className="size-3.5" /> Family Members:
            </span>
            {family.map((mem) => {
              const isActive = mem.id === activeMemberId;
              return (
                <button
                  key={mem.id}
                  onClick={() => setActiveMemberId(mem.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                    isActive
                      ? "bg-white text-slate-950 shadow-md font-bold scale-105"
                      : "bg-white/10 text-slate-200 hover:bg-white/20 border border-white/10"
                  }`}
                >
                  <span className="size-2 rounded-full bg-emerald-400" />
                  <span>{mem.name}</span>
                  <span className={`text-[10px] ${isActive ? "text-slate-500" : "text-slate-400"}`}>
                    ({mem.relation})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 -mt-6">
        <Tabs defaultValue="timeline" className="w-full">
          <TabsList className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full grid grid-cols-2 sm:grid-cols-4 h-12">
            <TabsTrigger value="timeline" className="font-bold text-xs sm:text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <FileText className="size-4 mr-1.5 hidden sm:inline" /> Universal Timeline
            </TabsTrigger>
            <TabsTrigger value="prescriptions" className="font-bold text-xs sm:text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Pill className="size-4 mr-1.5 hidden sm:inline" /> Prescriptions & Meds
            </TabsTrigger>
            <TabsTrigger value="labs" className="font-bold text-xs sm:text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <FlaskConical className="size-4 mr-1.5 hidden sm:inline" /> Lab Reports
            </TabsTrigger>
            <TabsTrigger value="doctors" className="font-bold text-xs sm:text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Stethoscope className="size-4 mr-1.5 hidden sm:inline" /> Discover & Rebook
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: UNIVERSAL HEALTH TIMELINE */}
          <TabsContent value="timeline" className="mt-6 space-y-6">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                <Button
                  size="sm"
                  variant={filterType === "all" ? "default" : "ghost"}
                  onClick={() => setFilterType("all")}
                  className="h-8 text-xs font-semibold rounded-lg"
                >
                  All ({records.filter((r) => r.memberId === activeMemberId).length})
                </Button>
                <Button
                  size="sm"
                  variant={filterType === "prescription" ? "default" : "ghost"}
                  onClick={() => setFilterType("prescription")}
                  className="h-8 text-xs font-semibold rounded-lg"
                >
                  Prescriptions
                </Button>
                <Button
                  size="sm"
                  variant={filterType === "lab_report" ? "default" : "ghost"}
                  onClick={() => setFilterType("lab_report")}
                  className="h-8 text-xs font-semibold rounded-lg"
                >
                  Lab Reports
                </Button>
                <Button
                  size="sm"
                  variant={filterType === "patient_upload" ? "default" : "ghost"}
                  onClick={() => setFilterType("patient_upload")}
                  className="h-8 text-xs font-semibold rounded-lg"
                >
                  Uploaded Scans
                </Button>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="size-4 absolute left-3 top-2.5 text-slate-400" />
                <Input
                  placeholder="Search doctor, medicine, diagnosis..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-lg"
                />
              </div>
            </div>

            {/* Chronological Feed */}
            {memberRecords.length === 0 ? (
              <Card className="p-12 text-center bg-white border-dashed border-slate-300">
                <div className="size-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                  <FileText className="size-6" />
                </div>
                <h3 className="font-bold text-base text-slate-800">No medical records match this filter</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Upload an existing paper prescription or book an OPD consultation to build this health profile.
                </p>
                <Button
                  onClick={() => setIsUploadOpen(true)}
                  className="mt-4 bg-blue-600 text-white text-xs font-semibold"
                >
                  Upload First Record
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {memberRecords.map((rec) => {
                  return (
                    <Card
                      key={rec.id}
                      className="p-5 bg-white border border-slate-200/90 hover:border-blue-400 transition-all rounded-xl shadow-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                          <div
                            className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${
                              rec.type === "prescription"
                                ? "bg-blue-50 text-blue-600"
                                : rec.type === "lab_report"
                                ? "bg-purple-50 text-purple-600"
                                : "bg-amber-50 text-amber-600"
                            }`}
                          >
                            {rec.type === "prescription" && <Pill className="size-5" />}
                            {rec.type === "lab_report" && <FlaskConical className="size-5" />}
                            {rec.type === "patient_upload" && <FileText className="size-5" />}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-base text-slate-900">{rec.title}</h3>
                              {/* Trust Tier Badge */}
                              {rec.trustTier === "verified_doctor" && (
                                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-300 text-[10px] gap-1">
                                  <ShieldCheck className="size-3 text-emerald-600" /> Doctor Verified
                                </Badge>
                              )}
                              {rec.trustTier === "verified_lab" && (
                                <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-300 text-[10px] gap-1">
                                  <CheckCircle2 className="size-3 text-purple-600" /> NABL Lab Verified
                                </Badge>
                              )}
                              {rec.trustTier === "patient_uploaded" && (
                                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-300 text-[10px] gap-1">
                                  <Upload className="size-3 text-amber-600" /> Patient Uploaded (Unverified)
                                </Badge>
                              )}
                            </div>

                            <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              {rec.doctorName && (
                                <>
                                  <span className="font-semibold text-slate-800">{rec.doctorName}</span>
                                  {rec.doctorRegNo && <span className="text-slate-400 font-mono">({rec.doctorRegNo})</span>}
                                  <span>•</span>
                                </>
                              )}
                              <span>{rec.clinicName}</span>
                              <span>•</span>
                              <span className="font-medium text-slate-600">
                                {new Date(rec.date).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            </div>

                            {rec.diagnosis && (
                              <div className="mt-2 text-xs font-semibold text-blue-900 bg-blue-50/70 border border-blue-100 px-2.5 py-1 rounded-md inline-block">
                                Diagnosis: {rec.diagnosis}
                              </div>
                            )}

                            {/* Vitals Summary Strip */}
                            {rec.vitals && (
                              <div className="flex flex-wrap gap-2 mt-2.5">
                                {rec.vitals.bp && (
                                  <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                                    BP: <b>{rec.vitals.bp}</b>
                                  </span>
                                )}
                                {rec.vitals.pulse && (
                                  <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                                    Pulse: <b>{rec.vitals.pulse} bpm</b>
                                  </span>
                                )}
                                {rec.vitals.bloodSugar && (
                                  <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                                    Sugar: <b>{rec.vitals.bloodSugar} mg/dL</b>
                                  </span>
                                )}
                                {rec.vitals.weight && (
                                  <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                                    Weight: <b>{rec.vitals.weight} kg</b>
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Medicines Snippet */}
                            {rec.medicines && rec.medicines.length > 0 && (
                              <div className="mt-3 bg-slate-50 border border-slate-200/60 rounded-lg p-2.5">
                                <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                                  <span>Prescribed Medicines ({rec.medicines.length})</span>
                                  <button
                                    onClick={() => handleOpenPharmacyOrder(rec)}
                                    className="text-blue-600 hover:text-blue-700 text-xs font-semibold inline-flex items-center gap-1"
                                  >
                                    <ShoppingBag className="size-3" /> Order from Pharmacy
                                  </button>
                                </div>
                                <div className="space-y-1">
                                  {rec.medicines.map((m, idx) => (
                                    <div key={idx} className="text-xs flex items-center justify-between text-slate-800">
                                      <span className="font-semibold">{m.name}</span>
                                      <span className="text-slate-500 font-mono text-[11px]">
                                        {m.dosage} • {m.frequency} • {m.duration}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Lab Tests Snippet */}
                            {rec.labTests && rec.labTests.length > 0 && (
                              <div className="mt-3 bg-slate-50 border border-slate-200/60 rounded-lg p-2.5">
                                <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                                  Lab Investigations ({rec.labTests.length})
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {rec.labTests.map((t, idx) => (
                                    <div
                                      key={idx}
                                      className={`text-xs p-1.5 rounded flex items-center justify-between ${
                                        t.isAbnormal ? "bg-red-50 text-red-900 border border-red-200" : "bg-white border border-slate-200 text-slate-800"
                                      }`}
                                    >
                                      <span className="font-medium truncate mr-2">{t.testName}</span>
                                      <span className="font-bold shrink-0 font-mono">
                                        {t.value} {t.unit}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <p className="text-xs text-slate-600 mt-2.5">{rec.summary}</p>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex sm:flex-col items-center gap-2 shrink-0 pt-2 sm:pt-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedRecord(rec)}
                            className="h-8 text-xs font-semibold border-slate-300 text-slate-700 hover:bg-slate-100 gap-1 w-full sm:w-auto"
                          >
                            <FileText className="size-3.5" /> View Slip
                          </Button>
                          {rec.type === "prescription" && (
                            <Button
                              size="sm"
                              onClick={() => handleOpenPharmacyOrder(rec)}
                              className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1 w-full sm:w-auto"
                            >
                              <ShoppingBag className="size-3.5" /> Order Meds
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: ACTIVE MEDICATIONS & ROUTINE */}
          <TabsContent value="prescriptions" className="mt-6 space-y-6">
            <Card className="p-6 bg-white border border-slate-200 rounded-xl shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Pill className="size-5 text-blue-600" /> Active Daily Medication Routine
                  </h2>
                  <p className="text-xs text-slate-500">
                    Showing doctor-prescribed active doses for {activeMember.name}
                  </p>
                </div>
                <Button
                  onClick={() => {
                    const allMeds: string[] = [];
                    memberRecords
                      .filter((r) => r.type === "prescription" && r.medicines)
                      .forEach((r) => r.medicines?.forEach((m) => allMeds.push(`${m.name} (${m.dosage})`)));
                    if (allMeds.length === 0) {
                      toast.error("No active prescriptions found.");
                      return;
                    }
                    setPharmacyItems(allMeds);
                    setIsPharmacyOrderOpen(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold h-9 gap-1.5 shadow-sm"
                >
                  <ShoppingBag className="size-4" /> Refill All Active Medicines
                </Button>
              </div>

              {/* Medication Schedule Timeline */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Morning */}
                <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-4">
                  <div className="flex items-center justify-between text-amber-900 font-bold text-xs uppercase tracking-wider mb-2">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-amber-600" /> Morning (8:00 AM)
                    </span>
                    <Badge variant="outline" className="border-amber-300 text-amber-800 text-[10px]">
                      Breakfast
                    </Badge>
                  </div>
                  <div className="space-y-2 mt-2">
                    <div className="bg-white p-2.5 rounded-lg border border-amber-200/80 text-xs shadow-2xs">
                      <div className="font-bold text-slate-900">Telmisartan 40mg</div>
                      <div className="text-slate-500 text-[11px]">1 Tablet • After food</div>
                      <div className="text-[10px] text-blue-600 font-semibold mt-1">Prescribed by Dr. Ananya Roy</div>
                    </div>
                  </div>
                </div>

                {/* Afternoon */}
                <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4">
                  <div className="flex items-center justify-between text-blue-900 font-bold text-xs uppercase tracking-wider mb-2">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-blue-600" /> Afternoon (1:30 PM)
                    </span>
                    <Badge variant="outline" className="border-blue-300 text-blue-800 text-[10px]">
                      Lunch
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-500 py-3 text-center italic">
                    No medications scheduled for afternoon.
                  </div>
                </div>

                {/* Night */}
                <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4">
                  <div className="flex items-center justify-between text-indigo-900 font-bold text-xs uppercase tracking-wider mb-2">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-indigo-600" /> Night (9:00 PM)
                    </span>
                    <Badge variant="outline" className="border-indigo-300 text-indigo-800 text-[10px]">
                      Dinner / Bedtime
                    </Badge>
                  </div>
                  <div className="space-y-2 mt-2">
                    <div className="bg-white p-2.5 rounded-lg border border-indigo-200/80 text-xs shadow-2xs">
                      <div className="font-bold text-slate-900">Rosuvastatin 10mg</div>
                      <div className="text-slate-500 text-[11px]">1 Tablet • At bedtime</div>
                      <div className="text-[10px] text-blue-600 font-semibold mt-1">Prescribed by Dr. Ananya Roy</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* TAB 3: DIAGNOSTICS & LABS */}
          <TabsContent value="labs" className="mt-6 space-y-6">
            <Card className="p-6 bg-white border border-slate-200 rounded-xl shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <FlaskConical className="size-5 text-purple-600" /> Diagnostic Investigations & Blood Reports
                  </h2>
                  <p className="text-xs text-slate-500">
                    NABL accredited lab tests and diagnostic reports synced with ABHA
                  </p>
                </div>
                <Button
                  onClick={() => toast.info("Partner diagnostic booking dialog opened. Select home collection slot.")}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold h-9 gap-1.5 shadow-sm"
                >
                  <Calendar className="size-4" /> Book Home Sample Collection
                </Button>
              </div>

              {/* Lab Reports List */}
              <div className="space-y-4">
                {memberRecords
                  .filter((r) => r.type === "lab_report")
                  .map((lab) => (
                    <div key={lab.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-bold text-sm text-slate-900">{lab.title}</div>
                          <div className="text-xs text-slate-500">
                            {lab.clinicName} • Date: {lab.date}
                          </div>
                        </div>
                        <Badge className="bg-emerald-100 text-emerald-800 text-xs">
                          NABL Certified
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {lab.labTests?.map((t, idx) => (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-lg border text-xs ${
                              t.isAbnormal
                                ? "bg-red-50 border-red-200 text-red-900"
                                : "bg-white border-slate-200 text-slate-800"
                            }`}
                          >
                            <div className="text-[11px] text-slate-500 truncate">{t.testName}</div>
                            <div className="flex items-baseline justify-between mt-1">
                              <span className="font-bold font-mono text-sm">
                                {t.value} {t.unit}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Ref: {t.normalRange}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedRecord(lab)}
                          className="h-7 text-xs border-slate-300"
                        >
                          <Download className="size-3 mr-1" /> Download PDF Report
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          </TabsContent>

          {/* TAB 4: DISCOVER & REBOOK DOCTORS */}
          <TabsContent value="doctors" className="mt-6 space-y-6">
            <Card className="p-6 bg-white border border-slate-200 rounded-xl shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Stethoscope className="size-5 text-blue-600" /> Doctor Discovery & Fast OPD Booking
                  </h2>
                  <p className="text-xs text-slate-500">
                    Discover specialists, view consultation fees, and book guaranteed OPD tokens
                  </p>
                </div>
              </div>

              {/* Search & Specialty Filter */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="size-4 absolute left-3 top-2.5 text-slate-400" />
                  <Input
                    placeholder="Search doctor by name, specialty, or hospital..."
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    className="pl-9 h-9 text-xs rounded-lg"
                  />
                </div>
                <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                  <SelectTrigger className="w-full sm:w-56 h-9 text-xs">
                    <SelectValue placeholder="All Specialties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Specialties</SelectItem>
                    <SelectItem value="cardiologist">Cardiologist</SelectItem>
                    <SelectItem value="endocrinologist / diabetes specialist">Endocrinologist</SelectItem>
                    <SelectItem value="pediatrician">Pediatrician</SelectItem>
                    <SelectItem value="orthopedic surgeon">Orthopedic Surgeon</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Doctors Directory Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredDoctors.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-400 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-base text-slate-900">{doc.name}</div>
                          <div className="text-xs font-semibold text-blue-600">{doc.specialty}</div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">{doc.qualification}</div>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            doc.availableToday
                              ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                              : "border-slate-300 text-slate-500"
                          }
                        >
                          {doc.availableToday ? "Available Today" : "Next Available Tomorrow"}
                        </Badge>
                      </div>

                      <div className="mt-3 flex items-center gap-3 text-xs text-slate-600">
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3.5 text-slate-400" /> {doc.clinic}, {doc.city}
                        </span>
                        <span>•</span>
                        <span>Exp: {doc.experience}</span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">Consultation Fee:</span>
                        <span className="font-bold text-slate-900 text-sm">₹{doc.fee}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      <Link to={`/c/${doc.slug}/book`}>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8 gap-1">
                          Book Slot / Token <ChevronRight className="size-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* MODAL 1: VIEW & PRINT PRESCRIPTION SLIP */}
      {selectedRecord && (
        <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
          <DialogContent className="max-w-2xl bg-white text-slate-900 p-0 overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="size-5 text-blue-400" /> {selectedRecord.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  {selectedRecord.clinicName} • Authorized Medical Record
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="h-8 border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs gap-1"
              >
                <Printer className="size-3.5" /> Print
              </Button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Patient</span>
                  <strong className="text-sm">{activeMember.name}</strong> ({activeMember.age}y / {activeMember.gender})
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Doctor / Facility</span>
                  <strong className="text-sm">{selectedRecord.doctorName || selectedRecord.clinicName}</strong>
                  {selectedRecord.doctorRegNo && <div className="text-slate-500 font-mono text-[11px]">{selectedRecord.doctorRegNo}</div>}
                </div>
              </div>

              {selectedRecord.diagnosis && (
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Clinical Diagnosis</div>
                  <div className="p-2.5 rounded bg-blue-50 border border-blue-200 text-xs font-bold text-blue-950">
                    {selectedRecord.diagnosis}
                  </div>
                </div>
              )}

              {selectedRecord.medicines && selectedRecord.medicines.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Rx Prescribed Medicines</div>
                  <div className="space-y-1.5">
                    {selectedRecord.medicines.map((m, i) => (
                      <div key={i} className="p-2.5 rounded border border-slate-200 bg-white text-xs flex items-center justify-between">
                        <div>
                          <strong className="text-slate-900">{m.name}</strong>
                          <div className="text-slate-500 text-[11px]">{m.instructions}</div>
                        </div>
                        <div className="text-right font-mono text-slate-700">
                          <div>{m.dosage} • {m.frequency}</div>
                          <div className="text-[10px] text-slate-400">{m.duration}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="font-bold block text-slate-700 mb-1">Doctor's Clinical Notes:</span>
                {selectedRecord.summary}
              </div>

              {/* Tamper-evident tamper seal */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  <span>Tamper-Evident SHA-256 Prescription Hash: <span className="font-mono text-slate-700">8f9b...a12c</span></span>
                </div>
                <span>ABDM Care-Context Linked</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 2: ABHA DIGITAL IDENTITY CARD */}
      <Dialog open={isAbhaModalOpen} onOpenChange={setIsAbhaModalOpen}>
        <DialogContent className="max-w-md bg-white text-slate-900 p-0 overflow-hidden">
          <div className="p-5 bg-gradient-to-r from-orange-600 via-white to-green-600 text-slate-900 flex items-center justify-between border-b">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-white flex items-center justify-center font-bold text-blue-700 shadow-xs">
                🇮🇳
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-950 uppercase tracking-tight">Ayushman Bharat Digital Mission</h3>
                <p className="text-[10px] text-slate-700 font-semibold">National Health Authority • Govt. of India</p>
              </div>
            </div>
          </div>

          <div className="p-6 text-center space-y-4">
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 shadow-inner">
              <div className="flex justify-center mb-3">
                <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200">
                  <QRCodeSVG
                    value={`https://abdm.gov.in/profile/${activeMember.abhaAddress}`}
                    size={140}
                    level="H"
                  />
                </div>
              </div>
              <div className="font-extrabold text-xl tracking-wider text-slate-900 font-mono">
                {activeMember.abhaId}
              </div>
              <div className="text-xs font-bold text-blue-700 font-mono mt-0.5">
                {activeMember.abhaAddress}
              </div>
              <div className="text-xs text-slate-600 mt-2 font-medium">
                {activeMember.name} • {activeMember.gender} • Blood Group: {activeMember.bloodGroup}
              </div>
            </div>

            <div className="text-xs text-slate-500 bg-blue-50 border border-blue-200 p-3 rounded-xl text-left space-y-1">
              <div className="font-bold text-blue-900 flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-blue-700" /> Unified Health Interface (UHI) Enabled
              </div>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                Your medical records are linked with your 14-digit ABHA. You have complete control to consent or revoke record sharing with any clinic or hospital.
              </p>
            </div>

            <Button
              onClick={() => {
                toast.success("ABHA Card download started");
                setIsAbhaModalOpen(false);
              }}
              className="w-full bg-blue-600 text-white font-bold text-xs h-10 gap-1.5"
            >
              <Download className="size-4" /> Download Official ABHA Card
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: UPLOAD DOCUMENT */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="max-w-md bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Upload className="size-5 text-blue-600" /> Upload Medical Record
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Upload paper prescriptions, external diagnostic scans, or discharge summaries for {activeMember.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadSubmit} className="space-y-3.5 mt-2">
            <div>
              <Label className="text-xs font-semibold">Document Category</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger className="mt-1 h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="patient_upload">Paper Prescription</SelectItem>
                  <SelectItem value="lab_report">Diagnostic Lab Report</SelectItem>
                  <SelectItem value="consultation">Discharge Summary / Clinical Slip</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Document Title</Label>
              <Input
                placeholder="e.g. Dr. Verma Knee Prescription"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                className="mt-1 h-9 text-xs"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Clinic / Hospital / Lab Name</Label>
              <Input
                placeholder="e.g. Apollo Diagnostics or Verma Clinic"
                value={uploadClinic}
                onChange={(e) => setUploadClinic(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Date of Record</Label>
              <Input
                type="date"
                value={uploadDate}
                onChange={(e) => setUploadDate(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Select File (PDF, JPG, PNG)</Label>
              <div className="mt-1 border-2 border-dashed border-slate-300 rounded-xl p-4 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setUploadFileName(f.name);
                  }}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="size-6 text-slate-400 mx-auto mb-1" />
                  <span className="text-xs font-semibold text-blue-600">
                    {uploadFileName || "Click to browse or drag file here"}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-0.5">Maximum file size: 10MB</p>
                </label>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Additional Notes / Symptoms</Label>
              <Input
                placeholder="Optional notes for your timeline"
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                className="mt-1 h-9 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsUploadOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-blue-600 text-white font-semibold">
                Save to Health Timeline
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: ORDER FROM PARTNER PHARMACY */}
      <Dialog open={isPharmacyOrderOpen} onOpenChange={setIsPharmacyOrderOpen}>
        <DialogContent className="max-w-md bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ShoppingBag className="size-5 text-emerald-600" /> Order via Licensed Partner Pharmacy
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Medicines will be fulfilled by licensed pharmacy partners in compliance with Drugs & Cosmetics Act.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Order Items ({pharmacyItems.length})
              </div>
              <ul className="space-y-1">
                {pharmacyItems.map((item, i) => (
                  <li key={i} className="text-xs text-slate-800 flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800">Delivery Address:</div>
              <div className="text-slate-500">Sector 14, Rohini, New Delhi - 110085 (Primary Address)</div>
            </div>

            <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
              ⚠️ Schedule H/H1 medicines require digital prescription verification by the dispensing registered pharmacist prior to dispatch.
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsPharmacyOrderOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmPharmacyOrder} size="sm" className="bg-emerald-600 text-white font-semibold">
                Confirm & Place Order
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
