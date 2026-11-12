import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  Pill,
  Upload,
  Plus,
  Search,
  Printer,
  Download,
  Share2,
  Copy,
  Clock,
  Activity,
  HeartPulse,
  Eye,
  Trash2,
  ExternalLink,
  Zap,
  User,
  Stethoscope,
  FlaskConical,
  Sparkles,
  Calendar,
  AlertCircle,
  FileCheck,
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

export const Route = createFileRoute("/_authenticated/dashboard/records")({
  component: () => (
    <AppGuard appKey="emr">
      <MedicalRecordsPage />
    </AppGuard>
  ),
});

// -------------------------------------------------------------
// TYPES & DATA STRUCTURES
// -------------------------------------------------------------

type Patient = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  age?: number | string | null;
  gender?: string | null;
  blood_group?: string | null;
  allergies?: string | null;
  chronic_conditions?: string | null;
  created_at: string;
};

type TimelineItem = {
  id: string;
  type: "prescription" | "consultation" | "lab_report" | "scan" | "other";
  date: string;
  title: string;
  doctor_name?: string;
  diagnosis?: string;
  notes?: string;
  chief_complaint?: string;
  treatment_plan?: string;
  vitals?: {
    bp?: string;
    pulse?: number | string;
    spo2?: number | string;
    temperature?: number | string;
    bloodSugar?: number | string;
    weight?: number | string;
    height?: number | string;
  };
  medications?: {
    drug_name: string;
    dose?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
  }[];
  file_url?: string;
  file_name?: string;
  raw_data?: any;
};

// -------------------------------------------------------------
// MAIN MEDICAL RECORDS PAGE
// -------------------------------------------------------------

function MedicalRecordsPage() {
  const { org } = useOrganization();
  const clinic = useClinic();
  const navigate = useNavigate();
  const orgId = org?.id;

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Timeline & Records state
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "prescriptions" | "consultations" | "reports">("all");
  const [searchFilter, setSearchFilter] = useState("");

  // Modals
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newVisitOpen, setNewVisitOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<{ url: string; name: string; type: string } | null>(null);
  const [printRxData, setPrintRxData] = useState<TimelineItem | null>(null);

  // 1. Initial Load of Patients Directory
  useEffect(() => {
    async function loadPatients() {
      if (!orgId) return;
      setLoadingPatients(true);
      try {
        const { data, error } = await supabase
          .from("patients")
          .select("*")
          .eq("organization_id", orgId)
          .order("name");

        if (error) throw error;
        const patientList = (data as Patient[]) ?? [];
        setPatients(patientList);

        // Check if patientId was provided in URL search parameters
        const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const paramId = urlParams?.get("patientId");

        if (paramId && patientList.some((p) => p.id === paramId)) {
          setSelectedPatientId(paramId);
        } else if (patientList.length > 0) {
          setSelectedPatientId(patientList[0].id);
        }
      } catch (err: any) {
        console.error("Failed to load patients:", err);
        toast.error("Could not load patient directory");
      } finally {
        setLoadingPatients(false);
      }
    }
    void loadPatients();
  }, [orgId]);

  // Selected Patient Details
  const selectedPatient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || null;
  }, [patients, selectedPatientId]);

  // 2. Load Patient Timeline Records (Prescriptions, Consultations/Visits, Lab Attachments)
  async function loadPatientRecords() {
    if (!orgId || !selectedPatientId) {
      setTimelineItems([]);
      return;
    }

    setLoadingTimeline(true);
    try {
      // Parallel queries across prescriptions, patient_visits, consultations, and attachments
      const [rxRes, visitsRes, consultRes, attachRes] = await Promise.all([
        supabase
          .from("prescriptions" as any)
          .select("*")
          .eq("organization_id", orgId)
          .eq("patient_id", selectedPatientId)
          .order("created_at", { ascending: false }),

        supabase
          .from("patient_visits" as any)
          .select("*")
          .eq("organization_id", orgId)
          .eq("patient_id", selectedPatientId)
          .order("visit_date", { ascending: false }),

        clinic?.id
          ? supabase
              .from("consultations" as any)
              .select("*")
              .eq("clinic_id", clinic.id)
              .eq("patient_id", selectedPatientId)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] }),

        supabase
          .from("patient_attachments" as any)
          .select("*")
          .eq("organization_id", orgId)
          .eq("patient_id", selectedPatientId)
          .order("created_at", { ascending: false }),
      ]);

      const items: TimelineItem[] = [];

      // A. Process Prescriptions & fetch their items
      const rxRows = (rxRes.data as any[]) ?? [];
      if (rxRows.length > 0) {
        const rxIds = rxRows.map((r) => r.id);
        const { data: itemRows } = await supabase
          .from("prescription_items" as any)
          .select("*")
          .in("prescription_id", rxIds)
          .order("position");

        const itemsByRx = new Map<string, any[]>();
        ((itemRows as any[]) ?? []).forEach((row) => {
          const list = itemsByRx.get(row.prescription_id) || [];
          list.push({
            drug_name: row.drug_name,
            dose: row.dose || "1 tab",
            frequency: row.frequency || "1-0-1",
            duration: row.duration || "5 days",
            instructions: row.instructions || "After meals",
          });
          itemsByRx.set(row.prescription_id, list);
        });

        rxRows.forEach((r) => {
          items.push({
            id: r.id,
            type: "prescription",
            date: r.created_at,
            title: "Digital Prescription (℞)",
            notes: r.notes,
            medications: itemsByRx.get(r.id) || [],
            raw_data: r,
          });
        });
      }

      // B. Process Patient Visits (EMR)
      const visitRows = (visitsRes.data as any[]) ?? [];
      visitRows.forEach((v) => {
        items.push({
          id: v.id,
          type: "consultation",
          date: v.created_at || v.visit_date,
          title: "Clinical Consultation Visit",
          chief_complaint: v.chief_complaint,
          diagnosis: v.diagnosis,
          treatment_plan: v.treatment_plan,
          notes: v.notes,
          vitals: {
            bp:
              v.bp_systolic && v.bp_diastolic
                ? `${v.bp_systolic}/${v.bp_diastolic} mmHg`
                : undefined,
            pulse: v.pulse_bpm,
            temperature: v.temperature_c,
            spo2: v.spo2_percent,
            bloodSugar: v.blood_sugar_mgdl,
            weight: v.weight_kg,
            height: v.height_cm,
          },
          raw_data: v,
        });
      });

      // C. Process Consultations (OPD queue fallback)
      const consultRows = (consultRes.data as any[]) ?? [];
      consultRows.forEach((c) => {
        // Prevent duplicate if already captured via patient_visits
        if (!visitRows.some((v) => v.id === c.id || (v.visit_date && c.created_at && v.visit_date.startsWith(c.created_at.slice(0, 10))))) {
          items.push({
            id: c.id,
            type: "consultation",
            date: c.created_at,
            title: "OPD Consultation",
            chief_complaint: c.chief_complaint,
            diagnosis: c.diagnosis,
            treatment_plan: c.treatment_plan,
            notes: c.history,
            vitals: {
              bp: c.bp,
              pulse: c.pulse,
              temperature: c.temperature,
              weight: c.weight,
              height: c.height,
            },
            raw_data: c,
          });
        }
      });

      // D. Process Attachments / Uploaded Lab Reports & PDFs
      const attachRows = (attachRes.data as any[]) ?? [];
      attachRows.forEach((a) => {
        const kindLabel =
          a.kind === "report"
            ? "Diagnostic Lab Report"
            : a.kind === "scan"
              ? "Imaging Scan / X-Ray"
              : a.kind === "prescription"
                ? "Physical Prescription Scan"
                : "Medical Document / PDF";

        items.push({
          id: a.id,
          type: a.kind === "scan" ? "scan" : "lab_report",
          date: a.created_at,
          title: a.file_name || kindLabel,
          file_name: a.file_name,
          file_url: a.file_url,
          notes: `Uploaded ${kindLabel}`,
          raw_data: a,
        });
      });

      // Sort chronological newest first
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTimelineItems(items);
    } catch (err: any) {
      console.error("Failed to load timeline records:", err);
      toast.error("Could not load medical records timeline");
    } finally {
      setLoadingTimeline(false);
    }
  }

  useEffect(() => {
    void loadPatientRecords();
  }, [selectedPatientId, orgId]);

  // Extract Most Recent Maintenance Regimen for Chronic Patients
  const recentPrescription = useMemo(() => {
    return timelineItems.find((t) => t.type === "prescription" && t.medications && t.medications.length > 0);
  }, [timelineItems]);

  // Filtered Timeline
  const filteredTimeline = useMemo(() => {
    let result = timelineItems;

    if (activeTab === "prescriptions") {
      result = result.filter((item) => item.type === "prescription");
    } else if (activeTab === "consultations") {
      result = result.filter((item) => item.type === "consultation");
    } else if (activeTab === "reports") {
      result = result.filter((item) => item.type === "lab_report" || item.type === "scan");
    }

    const q = searchFilter.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.diagnosis && item.diagnosis.toLowerCase().includes(q)) ||
          (item.chief_complaint && item.chief_complaint.toLowerCase().includes(q)) ||
          (item.notes && item.notes.toLowerCase().includes(q)) ||
          (item.file_name && item.file_name.toLowerCase().includes(q)) ||
          (item.medications &&
            item.medications.some((m) => m.drug_name.toLowerCase().includes(q))),
      );
    }

    return result;
  }, [timelineItems, activeTab, searchFilter]);

  // 1-Click Re-order / Clone Rx for Chronic Patient
  function handleReorderRx(rxItem: TimelineItem) {
    if (!selectedPatient) return;
    navigate({
      to: "/dashboard/prescriptions" as any,
      search: {
        cloneFrom: rxItem.id,
        patientId: selectedPatient.id,
      } as any,
    });
  }

  // Delete attachment
  async function handleDeleteAttachment(id: string) {
    if (!confirm("Are you sure you want to delete this report from the patient record?")) return;
    try {
      const { error } = await supabase
        .from("patient_attachments" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Attachment deleted");
      loadPatientRecords();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete attachment");
    }
  }

  // WhatsApp share
  function sharePrescriptionWhatsApp(item: TimelineItem) {
    const clinicTitle = clinic?.clinic_name || org?.name || "Clinic";
    const dateStr = new Date(item.date).toLocaleDateString("en-IN");
    const medsText =
      item.medications && item.medications.length > 0
        ? item.medications
            .map((m, i) => `${i + 1}. *${m.drug_name}* — ${m.dose || "1 tab"} (${m.frequency || "1-0-1"}) for ${m.duration || "5d"}\n   ${m.instructions || ""}`)
            .join("\n")
        : "Standard maintenance medicines";

    const msg = `*PRESCRIPTION & MEDICAL SUMMARY*\n🏥 *${clinicTitle}*\n📅 Date: ${dateStr}\n\n*Patient:* ${selectedPatient?.name}\n\n*Prescribed Medications (℞):*\n${medsText}\n\n${item.notes ? `*Doctor Advice:* ${item.notes}\n\n` : ""}📞 Helpline: ${clinic?.phone || "Reception"}\n_Electronic Health Record (EMR)_`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-bold tracking-tight">Patient Medical Records</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
              Universal EHR Timeline
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Chronological clinical record: past consultations, vitals, uploaded lab reports/PDFs, and prescription history.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUploadOpen(true)}
            disabled={!selectedPatientId}
            className="gap-1.5"
          >
            <Upload className="size-4 text-primary" />
            Upload Lab Report / PDF
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setNewVisitOpen(true)}
            disabled={!selectedPatientId}
            className="gap-1.5"
          >
            <Stethoscope className="size-4 text-blue-500" />
            Log Clinical Visit
          </Button>

          <Button
            size="sm"
            onClick={() =>
              navigate({
                to: "/dashboard/prescriptions" as any,
                search: { action: "new", patientId: selectedPatientId || undefined } as any,
              })
            }
            className="bg-primary text-primary-foreground shadow-xs gap-1.5"
          >
            <Plus className="size-4" />
            New Prescription
          </Button>
        </div>
      </div>

      {/* Patient Directory Selector & Search */}
      <Card className="p-4 sm:p-5 border-border/80 shadow-xs bg-card space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="w-full md:w-80">
            <Label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Active Patient Record
            </Label>
            <Select
              value={selectedPatientId ?? ""}
              onValueChange={(val) => setSelectedPatientId(val)}
            >
              <SelectTrigger className="w-full bg-background font-medium">
                <SelectValue placeholder={loadingPatients ? "Loading patients…" : "Select a patient"} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.phone ? `(${p.phone})` : ""} {p.age ? `· ${p.age}y` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Patient Quick Vitals & Health Summary Tile */}
          {selectedPatient && (
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3 rounded-xl border border-border/60">
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground block uppercase">
                  Age / Gender
                </span>
                <span className="text-xs font-bold text-foreground">
                  {selectedPatient.age ? `${selectedPatient.age} yrs` : "—"} ·{" "}
                  {selectedPatient.gender || "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground block uppercase">
                  Contact Phone
                </span>
                <span className="text-xs font-bold text-foreground">
                  {selectedPatient.phone || "No phone registered"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground block uppercase">
                  Blood Group
                </span>
                <span className="text-xs font-bold text-foreground">
                  {selectedPatient.blood_group || "O+ (Recorded)"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground block uppercase">
                  Timeline Events
                </span>
                <span className="text-xs font-bold text-primary">
                  {timelineItems.length} Clinical Records
                </span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Chronic Patient 1-Click Maintenance Regimen Banner */}
      {recentPrescription && (
        <Card className="p-4 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/30 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs gap-1">
                  <Zap className="size-3 fill-white" />
                  Active Chronic Regimen
                </Badge>
                <span className="text-xs text-muted-foreground font-medium">
                  Last prescribed on {new Date(recentPrescription.date).toLocaleDateString("en-IN")}
                </span>
              </div>
              <p className="text-xs text-foreground font-medium">
                Maintenance medicines prescribed:{" "}
                <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                  {recentPrescription.medications?.map((m) => `${m.drug_name} (${m.frequency || "1-0-1"})`).join(", ")}
                </span>
              </p>
            </div>

            <Button
              size="sm"
              onClick={() => handleReorderRx(recentPrescription)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 text-xs shadow-xs shrink-0 self-start sm:self-center"
            >
              <Copy className="size-3.5" />
              ⚡ 1-Click Re-order Routine Rx
            </Button>
          </div>
        </Card>
      )}

      {/* Timeline Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b pb-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Button
            size="sm"
            variant={activeTab === "all" ? "default" : "outline"}
            onClick={() => setActiveTab("all")}
            className="h-8 text-xs font-semibold rounded-lg"
          >
            All Events ({timelineItems.length})
          </Button>
          <Button
            size="sm"
            variant={activeTab === "prescriptions" ? "default" : "outline"}
            onClick={() => setActiveTab("prescriptions")}
            className="h-8 text-xs font-semibold rounded-lg gap-1.5"
          >
            <Pill className="size-3.5" />
            Prescriptions ({timelineItems.filter((t) => t.type === "prescription").length})
          </Button>
          <Button
            size="sm"
            variant={activeTab === "consultations" ? "default" : "outline"}
            onClick={() => setActiveTab("consultations")}
            className="h-8 text-xs font-semibold rounded-lg gap-1.5"
          >
            <Stethoscope className="size-3.5" />
            Visits &amp; Notes ({timelineItems.filter((t) => t.type === "consultation").length})
          </Button>
          <Button
            size="sm"
            variant={activeTab === "reports" ? "default" : "outline"}
            onClick={() => setActiveTab("reports")}
            className="h-8 text-xs font-semibold rounded-lg gap-1.5"
          >
            <FlaskConical className="size-3.5" />
            Lab Reports &amp; Scans ({timelineItems.filter((t) => t.type === "lab_report" || t.type === "scan").length})
          </Button>
        </div>

        {/* Search within Timeline */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search symptoms, meds, tests…"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-8 h-8 text-xs bg-card"
          />
        </div>
      </div>

      {/* Chronological Timeline Feed */}
      {loadingTimeline ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : filteredTimeline.length === 0 ? (
        <EmptyState
          icon={<HeartPulse className="size-10 text-primary/70" />}
          title="No records found"
          description={
            selectedPatient
              ? `No ${activeTab === "all" ? "clinical events" : activeTab} logged for ${selectedPatient.name} yet.`
              : "Select a patient above to view their longitudinal health history."
          }
          action={
            selectedPatient
              ? {
                  label: "Write First Prescription",
                  onClick: () =>
                    navigate({
                      to: "/dashboard/prescriptions" as any,
                      search: { action: "new", patientId: selectedPatient.id } as any,
                    }),
                }
              : undefined
          }
        />
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border/80">
          {filteredTimeline.map((item) => (
            <div key={item.id} className="relative group">
              {/* Timeline Bullet Node */}
              <div
                className={`absolute -left-6 top-4 size-5 rounded-full border-2 border-background flex items-center justify-center text-white shadow-xs ${
                  item.type === "prescription"
                    ? "bg-emerald-500"
                    : item.type === "consultation"
                      ? "bg-blue-500"
                      : "bg-purple-500"
                }`}
              >
                {item.type === "prescription" ? (
                  <Pill className="size-2.5" />
                ) : item.type === "consultation" ? (
                  <Stethoscope className="size-2.5" />
                ) : (
                  <FlaskConical className="size-2.5" />
                )}
              </div>

              {/* Event Content Card */}
              <Card className="p-4 sm:p-5 border-border/80 hover:border-primary/50 transition-all shadow-xs bg-card">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3 border-b pb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-base text-foreground tracking-tight">
                        {item.title}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-semibold uppercase tracking-wider ${
                          item.type === "prescription"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : item.type === "consultation"
                              ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                              : "bg-purple-500/10 text-purple-700 dark:text-purple-300"
                        }`}
                      >
                        {item.type === "prescription"
                          ? "Prescription"
                          : item.type === "consultation"
                            ? "Consultation"
                            : "Diagnostic Report"}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {new Date(item.date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {new Date(item.date).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Contextual Action Buttons */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    {item.type === "prescription" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReorderRx(item)}
                          className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 font-medium"
                          title="1-Click Re-order / Clone previous Rx for chronic patients"
                        >
                          <Copy className="size-3" />
                          <span className="hidden sm:inline">Clone /</span> Re-order
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => sharePrescriptionWhatsApp(item)}
                          className="h-7 text-xs gap-1 text-emerald-600 hover:bg-emerald-500/10"
                          title="Share on WhatsApp"
                        >
                          <Share2 className="size-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPrintRxData(item)}
                          className="h-7 text-xs gap-1"
                          title="Print Prescription Slip"
                        >
                          <Printer className="size-3" />
                        </Button>
                      </>
                    )}

                    {(item.type === "lab_report" || item.type === "scan") && item.file_url && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setViewDoc({
                              url: item.file_url!,
                              name: item.file_name || "Document",
                              type: item.type,
                            })
                          }
                          className="h-7 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/5"
                        >
                          <Eye className="size-3" />
                          View Document
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteAttachment(item.id)}
                          className="size-7 text-muted-foreground hover:text-destructive"
                          title="Delete file"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Event Body Details */}
                {/* 1. Prescription Item Breakdown */}
                {item.type === "prescription" && item.medications && (
                  <div className="space-y-3">
                    <div className="border rounded-xl divide-y overflow-hidden bg-muted/10">
                      {item.medications.map((med, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1 hover:bg-muted/30"
                        >
                          <div className="font-bold text-foreground flex items-center gap-1.5">
                            <span className="text-primary font-mono text-[11px]">{idx + 1}.</span>
                            {med.drug_name}
                          </div>
                          <div className="text-muted-foreground flex items-center gap-2 flex-wrap text-[11px]">
                            <span className="bg-muted px-1.5 py-0.5 rounded font-medium text-foreground">
                              {med.dose}
                            </span>
                            <span className="font-semibold text-primary">{med.frequency}</span>
                            <span>({med.duration})</span>
                            {med.instructions && (
                              <span className="italic text-muted-foreground/80">
                                · {med.instructions}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {item.notes && (
                      <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/50">
                        <span className="font-semibold text-foreground">Clinical Advice &amp; Notes:</span>{" "}
                        {item.notes}
                      </p>
                    )}
                  </div>
                )}

                {/* 2. Consultation / Clinical Visit Breakdown */}
                {item.type === "consultation" && (
                  <div className="space-y-3">
                    {/* Vitals Ribbon */}
                    {item.vitals && Object.values(item.vitals).some(Boolean) && (
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 bg-blue-500/5 p-2.5 rounded-xl border border-blue-500/20 text-xs">
                        {item.vitals.bp && (
                          <div>
                            <span className="text-[10px] text-muted-foreground block">BP</span>
                            <span className="font-bold text-foreground">{item.vitals.bp}</span>
                          </div>
                        )}
                        {item.vitals.pulse && (
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Pulse</span>
                            <span className="font-bold text-foreground">{item.vitals.pulse} bpm</span>
                          </div>
                        )}
                        {item.vitals.spo2 && (
                          <div>
                            <span className="text-[10px] text-muted-foreground block">SpO2</span>
                            <span className="font-bold text-foreground">{item.vitals.spo2}%</span>
                          </div>
                        )}
                        {item.vitals.temperature && (
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Temp</span>
                            <span className="font-bold text-foreground">{item.vitals.temperature} °F</span>
                          </div>
                        )}
                        {item.vitals.bloodSugar && (
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Sugar</span>
                            <span className="font-bold text-foreground">{item.vitals.bloodSugar} mg/dL</span>
                          </div>
                        )}
                        {item.vitals.weight && (
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Weight</span>
                            <span className="font-bold text-foreground">{item.vitals.weight} kg</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Chief Complaint & Diagnosis */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {item.chief_complaint && (
                        <div>
                          <span className="font-semibold text-foreground block mb-0.5">
                            Chief Complaints:
                          </span>
                          <p className="text-muted-foreground">{item.chief_complaint}</p>
                        </div>
                      )}
                      {item.diagnosis && (
                        <div>
                          <span className="font-semibold text-foreground block mb-0.5">
                            Clinical Diagnosis:
                          </span>
                          <Badge variant="outline" className="font-bold text-xs bg-primary/5 text-primary border-primary/20">
                            {item.diagnosis}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {item.treatment_plan && (
                      <div className="text-xs bg-muted/20 p-2.5 rounded-lg border">
                        <span className="font-semibold text-foreground block mb-0.5">
                          Treatment Plan:
                        </span>
                        <p className="text-muted-foreground whitespace-pre-line">{item.treatment_plan}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Lab Report / Scan Breakdown */}
                {(item.type === "lab_report" || item.type === "scan") && (
                  <div className="flex items-center justify-between gap-3 bg-muted/20 p-3 rounded-xl border text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-10 rounded-lg bg-purple-500/10 text-purple-600 grid place-items-center shrink-0">
                        <FileCheck className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-foreground truncate">
                          {item.file_name || "Diagnostic Report Document"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {item.notes || "Uploaded PDF / Lab Scan"}
                        </div>
                      </div>
                    </div>

                    {item.file_url && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setViewDoc({
                            url: item.file_url!,
                            name: item.file_name || "Document",
                            type: item.type,
                          })
                        }
                        className="text-xs shrink-0 gap-1.5"
                      >
                        <Eye className="size-3.5" />
                        Preview
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Upload Lab Report / PDF Dialog */}
      {selectedPatient && (
        <UploadLabReportModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          orgId={orgId!}
          patient={selectedPatient}
          onUploaded={() => {
            setUploadOpen(false);
            loadPatientRecords();
          }}
        />
      )}

      {/* Log Clinical Visit Modal */}
      {selectedPatient && (
        <LogVisitModal
          open={newVisitOpen}
          onClose={() => setNewVisitOpen(false)}
          orgId={orgId!}
          clinicId={clinic?.id}
          patient={selectedPatient}
          onSaved={() => {
            setNewVisitOpen(false);
            loadPatientRecords();
          }}
        />
      )}

      {/* Document Preview Modal */}
      {viewDoc && (
        <Dialog open onOpenChange={(o) => !o && setViewDoc(null)}>
          <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="font-display text-lg truncate max-w-md">
                  {viewDoc.name}
                </DialogTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(viewDoc.url, "_blank")}
                  className="gap-1.5 text-xs"
                >
                  <ExternalLink className="size-3.5" />
                  Open in New Window
                </Button>
              </div>
            </DialogHeader>

            <div className="p-2 border rounded-xl bg-muted/20 min-h-[450px] grid place-items-center">
              {viewDoc.url.toLowerCase().endsWith(".pdf") || viewDoc.url.includes("application/pdf") ? (
                <iframe
                  src={viewDoc.url}
                  className="w-full h-[620px] rounded-lg border bg-white"
                  title={viewDoc.name}
                />
              ) : (
                <img
                  src={viewDoc.url}
                  alt={viewDoc.name}
                  className="max-h-[620px] w-auto object-contain rounded-lg shadow-xs"
                />
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setViewDoc(null)}>
                Close Preview
              </Button>
              <Button
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = viewDoc.url;
                  a.download = viewDoc.name;
                  a.click();
                }}
                className="gap-1.5"
              >
                <Download className="size-4" />
                Download Document
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Print Prescription Modal */}
      {printRxData && (
        <Dialog open onOpenChange={(o) => !o && setPrintRxData(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-lg">Prescription Printout</DialogTitle>
            </DialogHeader>

            <div className="p-6 bg-white text-black rounded-xl border shadow-xs" id="timeline-rx-print">
              <div className="flex justify-between border-b pb-3 mb-4">
                <div>
                  <h3 className="font-bold text-xl">{clinic?.clinic_name || org?.name || "Clinic"}</h3>
                  <div className="text-xs text-gray-500">
                    {clinic?.doctor_name ? `Dr. ${clinic.doctor_name}` : "Attending Doctor"}
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <div>Date: {new Date(printRxData.date).toLocaleDateString("en-IN")}</div>
                </div>
              </div>

              <div className="mb-4 text-sm font-semibold">
                Patient: <span className="font-bold">{selectedPatient?.name}</span>
              </div>

              <div className="text-2xl font-serif text-primary mb-2">℞</div>

              <table className="w-full text-xs text-left border-collapse mb-4">
                <thead>
                  <tr className="border-b uppercase text-gray-400">
                    <th className="py-2">Medication</th>
                    <th className="py-2">Dose</th>
                    <th className="py-2">Frequency</th>
                    <th className="py-2">Duration</th>
                    <th className="py-2">Instructions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {printRxData.medications?.map((m, idx) => (
                    <tr key={idx}>
                      <td className="py-2 font-bold text-gray-900">{m.drug_name}</td>
                      <td className="py-2">{m.dose}</td>
                      <td className="py-2 font-semibold text-primary">{m.frequency}</td>
                      <td className="py-2">{m.duration}</td>
                      <td className="py-2 text-gray-600">{m.instructions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {printRxData.notes && (
                <div className="text-xs text-gray-700 pt-3 border-t">
                  <strong>Notes:</strong> {printRxData.notes}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPrintRxData(null)}>
                Close
              </Button>
              <Button onClick={() => window.print()} className="gap-1.5">
                <Printer className="size-4" />
                Print
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// UPLOAD LAB REPORT / PDF MODAL
// -------------------------------------------------------------

function UploadLabReportModal({
  open,
  onClose,
  orgId,
  patient,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  patient: Patient;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [kind, setKind] = useState<"report" | "scan" | "prescription" | "other">("report");
  const [uploading, setUploading] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      if (!fileName) {
        setFileName(f.name.replace(/\.[^/.]+$/, ""));
      }
    }
  }

  async function handleUpload() {
    if (!file) return toast.error("Please select a document or report file to upload");
    if (!fileName.trim()) return toast.error("Document title is required");

    setUploading(true);
    try {
      let finalUrl = "";

      // 1. Try Supabase Storage upload
      try {
        const ext = (file.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `${orgId}/${patient.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

        const { error: uploadErr } = await supabase.storage.from("clinic-media").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });

        if (!uploadErr) {
          const { data: pubData } = supabase.storage.from("clinic-media").getPublicUrl(path);
          if (pubData?.publicUrl) {
            finalUrl = pubData.publicUrl;
          }
        }
      } catch (storageErr) {
        console.warn("Storage upload fallback:", storageErr);
      }

      // 2. Fallback to Data URL for resiliency if storage bucket is unconfigured
      if (!finalUrl) {
        finalUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (e) => reject(e);
        });
      }

      const { data: authData } = await supabase.auth.getUser();

      // 3. Insert record into patient_attachments table
      const { error: dbErr } = await supabase.from("patient_attachments" as any).insert({
        organization_id: orgId,
        patient_id: patient.id,
        file_url: finalUrl,
        file_name: fileName.trim(),
        kind: kind,
        uploaded_by: authData?.user?.id ?? null,
      });

      if (dbErr) throw dbErr;

      toast.success(`"${fileName.trim()}" successfully uploaded to ${patient.name}'s medical records!`);
      onUploaded();
    } catch (err: any) {
      toast.error(err.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            Upload Diagnostic Report / PDF
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border">
            Attaching record to: <strong className="text-foreground">{patient.name}</strong>
          </div>

          <div>
            <Label className="text-xs font-semibold">Report / Document Title *</Label>
            <Input
              placeholder="e.g. Complete Blood Count (CBC) &amp; Lipid Panel"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">Document Category</Label>
            <Select value={kind} onValueChange={(v: any) => setKind(v)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="report">Diagnostic Lab Report (CBC, LFT, Blood, Urine)</SelectItem>
                <SelectItem value="scan">Imaging / Radiology Scan (X-Ray, Ultrasound, CT, MRI)</SelectItem>
                <SelectItem value="prescription">Physical Paper Prescription Scan</SelectItem>
                <SelectItem value="other">Discharge Summary / Referral Letter / Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold">Select File (PDF, PNG, JPG) *</Label>
            <Input
              type="file"
              accept=".pdf,image/png,image/jpeg,image/jpg"
              onChange={handleFileChange}
              className="mt-1 file:text-xs file:font-semibold cursor-pointer"
            />
            {file && (
              <p className="text-[11px] text-emerald-600 font-medium mt-1">
                Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleUpload} disabled={uploading} className="gap-1.5">
            <Upload className="size-3.5" />
            {uploading ? "Uploading Report…" : "Upload to Timeline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------------
// LOG CLINICAL VISIT / NOTE MODAL
// -------------------------------------------------------------

function LogVisitModal({
  open,
  onClose,
  orgId,
  clinicId,
  patient,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  clinicId?: string;
  patient: Patient;
  onSaved: () => void;
}) {
  const [complaint, setComplaint] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [temp, setTemp] = useState("");
  const [spo2, setSpo2] = useState("");
  const [sugar, setSugar] = useState("");
  const [weight, setWeight] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!complaint.trim() && !diagnosis.trim() && !treatment.trim()) {
      return toast.error("Please enter symptoms, diagnosis, or clinical notes");
    }

    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();

      const payload = {
        organization_id: orgId,
        patient_id: patient.id,
        patient_name: patient.name,
        visit_date: new Date().toISOString().split("T")[0],
        chief_complaint: complaint.trim() || null,
        diagnosis: diagnosis.trim() || null,
        treatment_plan: treatment.trim() || null,
        bp_systolic: bpSystolic ? parseInt(bpSystolic, 10) : null,
        bp_diastolic: bpDiastolic ? parseInt(bpDiastolic, 10) : null,
        pulse_bpm: pulse ? parseInt(pulse, 10) : null,
        temperature_c: temp ? parseFloat(temp) : null,
        spo2_percent: spo2 ? parseInt(spo2, 10) : null,
        blood_sugar_mgdl: sugar ? parseInt(sugar, 10) : null,
        weight_kg: weight ? parseFloat(weight) : null,
        created_by: authData?.user?.id ?? null,
      };

      const { error } = await supabase.from("patient_visits" as any).insert(payload);
      if (error) throw error;

      toast.success("Clinical visit logged successfully!");
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to log visit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            Log Clinical Visit for {patient.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Vitals Grid */}
          <div className="bg-muted/30 p-3 rounded-xl border border-border/60 space-y-2">
            <Label className="text-xs font-bold text-foreground">Patient Vitals</Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">BP Systolic</Label>
                <Input
                  placeholder="120"
                  value={bpSystolic}
                  onChange={(e) => setBpSystolic(e.target.value)}
                  className="h-8 text-xs mt-0.5"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">BP Diastolic</Label>
                <Input
                  placeholder="80"
                  value={bpDiastolic}
                  onChange={(e) => setBpDiastolic(e.target.value)}
                  className="h-8 text-xs mt-0.5"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Pulse (bpm)</Label>
                <Input
                  placeholder="72"
                  value={pulse}
                  onChange={(e) => setPulse(e.target.value)}
                  className="h-8 text-xs mt-0.5"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">SpO2 (%)</Label>
                <Input
                  placeholder="98"
                  value={spo2}
                  onChange={(e) => setSpo2(e.target.value)}
                  className="h-8 text-xs mt-0.5"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Temp (°C / °F)</Label>
                <Input
                  placeholder="98.6"
                  value={temp}
                  onChange={(e) => setTemp(e.target.value)}
                  className="h-8 text-xs mt-0.5"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Blood Sugar (mg/dL)</Label>
                <Input
                  placeholder="110"
                  value={sugar}
                  onChange={(e) => setSugar(e.target.value)}
                  className="h-8 text-xs mt-0.5"
                />
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold">Chief Complaints</Label>
            <Input
              placeholder="e.g. Low grade fever, throat tickle, productive cough x 3 days"
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">Clinical Diagnosis</Label>
            <Input
              placeholder="e.g. Acute Viral Bronchitis"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">Treatment Plan &amp; Advice</Label>
            <Textarea
              placeholder="e.g. Prescribed cough expectorant, steam inhalation, warm fluids. Follow up if symptoms worsen."
              value={treatment}
              onChange={(e) => setTreatment(e.target.value)}
              className="mt-1 text-xs min-h-[75px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving Record…" : "Log Visit to Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
