import { createFileRoute, useSearch, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "./dashboard";
import { useOrganization } from "@/hooks/useOrganization";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppGuard } from "@/components/app/AppGuard";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { AvatarInitials } from "@/components/ui/skeleton-rows";
import { toast } from "sonner";
import {
  Search,
  Phone,
  Users,
  UserCheck,
  TrendingUp,
  Activity,
  ChevronRight,
  Plus,
  HeartPulse,
  Pencil,
  Trash2,
  CalendarClock,
  FileText,
  Calendar,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/patients/")({
  component: () => (
    <AppGuard appKey="crm">
      <PatientsPage />
    </AppGuard>
  ),
});

type Patient = {
  id: string;
  name: string;
  phone: string;
  email: string;
  age: number | null;
  gender: string | null;
  created_at: string;
  visitCount: number;
  completedCount: number;
  lastVisit: string | null;
  firstSeen: string | null;
};

type AppointmentVisit = {
  id: string;
  scheduled_at: string;
  status: string;
  problem: string;
  appointment_type?: string;
};

type EMRVisit = {
  id: string;
  patient_id: string | null;
  patient_name: string;
  doctor_id: string | null;
  visit_date: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  notes: string | null;
  follow_up_date: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  pulse_bpm: number | null;
  temperature_c: number | null;
  spo2_percent: number | null;
  blood_sugar_mgdl: number | null;
  created_at: string;
};

type PatientOpt = { id: string; name: string };
type DoctorOpt = { id: string; name: string };
type InventoryItem = { id: string; name: string; unit: string; quantity: number };
type PharmacyBatch = {
  id: string;
  medicine_name: string;
  quantity: number;
  unit?: string;
  selling_price?: number;
};
type DispensedItem = { id: string; name: string; qty: number; unit: string; price: number };
type Attachment = {
  id: string;
  visit_id: string | null;
  file_url: string;
  file_name: string;
  kind: string;
  created_at: string;
};
type QuickVitals = {
  visit_id?: string;
  bp_systolic?: string;
  bp_diastolic?: string;
  pulse_bpm?: string;
  temperature_c?: string;
  spo2_percent?: string;
  blood_sugar_mgdl?: string;
  weight_kg?: string;
  recorded_at?: string;
};

const ATTACHMENT_KINDS = ["report", "scan", "photo", "prescription", "other"] as const;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function bmi(v: EMRVisit): string | null {
  if (!v.height_cm || !v.weight_kg || v.height_cm <= 0) return null;
  const m = Number(v.height_cm) / 100;
  return (Number(v.weight_kg) / (m * m)).toFixed(1);
}

function StatTile({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <Card className="p-4 card-soft flex items-start gap-3">
      <div className="size-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-2xl font-bold font-display leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

function PatientsPage() {
  const clinic = useClinic();
  const { org } = useOrganization();
  const orgId = org?.id;
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as { tab?: string };

  const [activeTab, setActiveTab] = useState<"directory" | "records">(
    searchParams.tab === "records" ? "records" : "directory",
  );

  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "visits" | "last_seen">("last_seen");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientAppointments, setPatientAppointments] = useState<AppointmentVisit[]>([]);

  const [emrVisits, setEmrVisits] = useState<EMRVisit[]>([]);
  const [patientOpts, setPatientOpts] = useState<PatientOpt[]>([]);
  const [doctorOpts, setDoctorOpts] = useState<DoctorOpt[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [pharmacyBatches, setPharmacyBatches] = useState<PharmacyBatch[]>([]);
  const [recordSearch, setRecordSearch] = useState("");
  const [patientFilter, setPatientFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [editingVisit, setEditingVisit] = useState<EMRVisit | "new" | null>(null);
  const [loading, setLoading] = useState(true);
  const [vitalsDialogPatient, setVitalsDialogPatient] = useState<Patient | null>(null);

  async function loadData() {
    if (!clinic?.id || !orgId) return;
    setLoading(true);
    try {
      const [apptsRes, visitsRes, patientsRes, doctorsRes, invRes] = await Promise.all([
        supabase
          .from("appointments")
          .select(
            "patient_name, patient_phone, patient_email, patient_age, patient_gender, scheduled_at, status",
          )
          .eq("clinic_id", clinic.id)
          .order("scheduled_at", { ascending: false }),
        supabase
          .from("consultations")
          .select("*")
          .eq("clinic_id", clinic.id)
          .order("created_at", { ascending: false }),
        supabase.from("patients").select("id, name").eq("clinic_id", clinic.id).order("name"),
        supabase.from("doctors").select("id, name").eq("clinic_id", clinic.id).order("name"),
        supabase
          .from("inventory_items")
          .select("id, name, unit, quantity")
          .eq("clinic_id", clinic.id)
          .order("name"),
      ]);

      const byPhone = new Map<string, Patient>();
      ((apptsRes.data as any[]) ?? []).forEach((r) => {
        if (!r.patient_phone) return;
        const phone = r.patient_phone;
        const existing = byPhone.get(phone);
        if (!existing) {
          byPhone.set(phone, {
            id: phone,
            name: r.patient_name,
            phone,
            email: r.patient_email ?? "",
            age: r.patient_age,
            gender: r.patient_gender,
            created_at: r.scheduled_at ?? "",
            visitCount: 1,
            completedCount: r.status === "completed" ? 1 : 0,
            lastVisit: r.scheduled_at ?? null,
            firstSeen: r.scheduled_at ?? null,
          });
        } else {
          existing.visitCount += 1;
          if (r.status === "completed") existing.completedCount += 1;
          if (r.scheduled_at && (!existing.lastVisit || r.scheduled_at > existing.lastVisit)) {
            existing.lastVisit = r.scheduled_at;
          }
          if (r.scheduled_at && (!existing.firstSeen || r.scheduled_at < existing.firstSeen)) {
            existing.firstSeen = r.scheduled_at;
          }
        }
      });

      setPatients(Array.from(byPhone.values()));
      setEmrVisits((visitsRes.data as any[]) ?? []);
      setPatientOpts((patientsRes.data as any[]) ?? []);
      setDoctorOpts((doctorsRes.data as any[]) ?? []);
      setInventoryItems((invRes.data as any[]) ?? []);
      setPharmacyBatches((pharmRes.data as any[]) ?? []);
    } catch (e) {
      console.error("Error loading patient data:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [clinic?.id, orgId]);

  const dirStats = useMemo(() => {
    const total = patients.length;
    const returning = patients.filter((r) => r.visitCount > 1).length;
    const thisMonth = patients.filter((r) => {
      if (!r.lastVisit) return false;
      const d = new Date(r.lastVisit);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const avgVisits =
      total > 0 ? (patients.reduce((s, r) => s + r.visitCount, 0) / total).toFixed(1) : "0";
    return { total, returning, thisMonth, avgVisits };
  }, [patients]);

  const emrStats = useMemo(() => {
    const today = todayISO();
    const month = today.slice(0, 7);
    return {
      total: emrVisits.length,
      thisMonth: emrVisits.filter((v) => v.visit_date.startsWith(month)).length,
      followUps: emrVisits.filter((v) => v.follow_up_date && v.follow_up_date <= today).length,
      patientsCount: new Set(emrVisits.map((v) => v.patient_id).filter(Boolean)).size,
    };
  }, [emrVisits]);

  const filteredPatients = useMemo(() => {
    let r = patients;
    if (patientSearch) {
      const q = patientSearch.toLowerCase();
      r = r.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          p.email?.toLowerCase().includes(q),
      );
    }
    return [...r].sort((a, b) => {
      if (sortBy === "visits") return b.visitCount - a.visitCount;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return (b.lastVisit ?? "").localeCompare(a.lastVisit ?? "");
    });
  }, [patients, patientSearch, sortBy]);

  const filteredEmrVisits = useMemo(() => {
    let r = emrVisits;
    if (patientFilter !== "all") r = r.filter((v) => v.patient_id === patientFilter);
    if (dateFilter) r = r.filter((v) => v.visit_date.startsWith(dateFilter));
    const q = recordSearch.trim().toLowerCase();
    if (q) {
      r = r.filter(
        (v) =>
          v.patient_name.toLowerCase().includes(q) ||
          (v.diagnosis ?? "").toLowerCase().includes(q) ||
          (v.chief_complaint ?? "").toLowerCase().includes(q),
      );
    }
    return r;
  }, [emrVisits, recordSearch, patientFilter, dateFilter]);

  async function openPatientDetail(p: Patient) {
    setSelectedPatient(p);
    const { data } = await supabase
      .from("appointments")
      .select("id, scheduled_at, status, problem, appointment_type")
      .eq("clinic_id", clinic!.id)
      .eq("patient_phone", p.phone)
      .order("scheduled_at", { ascending: false });
    setPatientAppointments((data as AppointmentVisit[]) ?? []);
  }

  async function removeVisit(id: string) {
    if (!confirm("Delete this visit record? Attachments on it will also be removed.")) return;
    const { error } = await supabase
      .from("patient_visits" as any)
      .delete()
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Visit record deleted");
    void loadData();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patients & Medical Records"
        subtitle="Unified patient directory, consultation histories, vitals, and EMR records."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => setEditingVisit("new")} className="gap-1.5">
              <Plus className="size-4" /> New Visit Record
            </Button>
          </div>
        }
      />

      {/* Native App Pill Tabs */}
      <div className="flex bg-muted/50 p-1 rounded-2xl border border-border/60 max-w-md">
        <button
          onClick={() => setActiveTab("directory")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "directory"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="size-4" />
          <span>Directory</span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-bold">
            {dirStats.total}
          </Badge>
        </button>
        <button
          onClick={() => setActiveTab("records")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "records"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="size-4" />
          <span>EMR Records</span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-bold">
            {emrStats.total}
          </Badge>
        </button>
      </div>

      {activeTab === "directory" ? (
        <div className="space-y-4 sm:space-y-6">
          {/* Micro Stat Grid for Native Feel */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl border border-border/70 bg-card/60 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-medium">Total Patients</span>
                <Users className="size-3.5 text-blue-500" />
              </div>
              <p className="text-xl font-bold tracking-tight text-foreground">{dirStats.total}</p>
            </div>
            <div className="p-3 rounded-2xl border border-border/70 bg-card/60 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-medium">Returning</span>
                <UserCheck className="size-3.5 text-emerald-500" />
              </div>
              <p className="text-xl font-bold tracking-tight text-foreground">
                {dirStats.returning}{" "}
                <span className="text-[11px] text-muted-foreground font-normal">
                  ({dirStats.total ? Math.round((dirStats.returning / dirStats.total) * 100) : 0}%)
                </span>
              </p>
            </div>
            <div className="p-3 rounded-2xl border border-border/70 bg-card/60 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-medium">This Month</span>
                <Activity className="size-3.5 text-purple-500" />
              </div>
              <p className="text-xl font-bold tracking-tight text-foreground">{dirStats.thisMonth}</p>
            </div>
            <div className="p-3 rounded-2xl border border-border/70 bg-card/60 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-medium">Avg Visits</span>
                <TrendingUp className="size-3.5 text-amber-500" />
              </div>
              <p className="text-xl font-bold tracking-tight text-foreground">{dirStats.avgVisits}</p>
            </div>
          </div>

          {/* Touch-optimized search & sort */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, email…"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-card border-border/80 text-xs sm:text-sm"
              />
            </div>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-32 sm:w-40 h-10 rounded-xl text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="last_seen">Last seen</SelectItem>
                <SelectItem value="visits">Most visits</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <Skeleton className="h-48 w-full rounded-2xl" />
          ) : filteredPatients.length === 0 ? (
            <EmptyState
              icon={<Users className="size-6" />}
              title="No patients found"
              description="Patients added through appointments or walk-ins will appear here."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
              {filteredPatients.map((p) => (
                <Link
                  key={p.id}
                  to="/dashboard/patients/$patientId"
                  params={{ patientId: p.id }}
                  className="block focus:outline-none group"
                >
                  <Card className="p-3.5 sm:p-4 rounded-2xl hover:border-primary/50 transition-all active:scale-[0.99] border-border/70 bg-card shadow-xs hover:shadow-sm space-y-3">
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <AvatarInitials name={p.name} />
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate text-foreground group-hover:text-primary transition-colors">
                            {p.name}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 font-mono">
                            {p.phone}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[10px] font-bold rounded-lg px-2 py-0.5">
                        {p.visitCount} {p.visitCount === 1 ? "visit" : "visits"}
                      </Badge>
                    </div>

                    <div className="pt-2.5 border-t border-border/50 text-xs text-muted-foreground flex items-center justify-between">
                      <span className="text-[11px]">
                        {p.lastVisit ? `Last visit: ${new Date(p.lastVisit).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No visits yet"}
                      </span>
                      <div className="flex items-center gap-2">
                        {p.phone && (
                          <a
                            href={`https://wa.me/${p.phone.replace(/[^\d]/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="size-7 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 grid place-items-center transition"
                            title="Chat on WhatsApp"
                          >
                            <Phone className="size-3.5" />
                          </a>
                        )}
                        <span className="text-primary font-semibold text-xs flex items-center">
                          Profile <ChevronRight className="size-3.5 ml-0.5" />
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl border border-border/70 bg-card/60 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-medium">Total Visits</span>
                <HeartPulse className="size-3.5 text-rose-500" />
              </div>
              <p className="text-xl font-bold tracking-tight text-foreground">{emrStats.total}</p>
            </div>
            <div className="p-3 rounded-2xl border border-border/70 bg-card/60 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-medium">This Month</span>
                <Calendar className="size-3.5 text-blue-500" />
              </div>
              <p className="text-xl font-bold tracking-tight text-foreground">{emrStats.thisMonth}</p>
            </div>
            <div className="p-3 rounded-2xl border border-border/70 bg-card/60 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-medium">Patients Seen</span>
                <Users className="size-3.5 text-emerald-500" />
              </div>
              <p className="text-xl font-bold tracking-tight text-foreground">{emrStats.patientsCount}</p>
            </div>
            <div className={`p-3 rounded-2xl border space-y-1 ${
              emrStats.followUps > 0
                ? "border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/20"
                : "border-border/70 bg-card/60"
            }`}>
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-medium">Follow-ups Due</span>
                <CalendarClock className="size-3.5 text-amber-500" />
              </div>
              <p className="text-xl font-bold tracking-tight text-foreground">{emrStats.followUps}</p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search name, diagnosis, complaint…"
                value={recordSearch}
                onChange={(e) => setRecordSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-card border-border/80 text-xs sm:text-sm"
              />
            </div>
            <Select value={patientFilter} onValueChange={setPatientFilter}>
              <SelectTrigger className="w-36 sm:w-48 h-10 rounded-xl text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All patients</SelectItem>
                {patientOpts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="month"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-10 border border-border/80 rounded-xl px-3 text-xs bg-card focus:outline-none"
              title="Filter by month"
            />
            {dateFilter && (
              <Button size="sm" variant="ghost" onClick={() => setDateFilter("")} className="h-10 text-xs rounded-xl">
                Clear
              </Button>
            )}
          </div>

          {loading ? (
            <Skeleton className="h-48 w-full rounded-2xl" />
          ) : filteredEmrVisits.length === 0 ? (
            <EmptyState
              icon={<HeartPulse className="size-6" />}
              title="No visit records found"
              description="Click '+ New Visit Record' above to record patient vitals, diagnosis, and reports."
            />
          ) : (
            <div className="space-y-2.5">
              {filteredEmrVisits.map((v) => {
                const b = bmi(v);
                const isOverdue = v.follow_up_date && v.follow_up_date <= todayISO();
                return (
                  <Card
                    key={v.id}
                    className="p-3.5 sm:p-4 rounded-2xl border-border/70 bg-card hover:border-primary/40 transition shadow-xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        className="text-left flex-1 min-w-0 bg-transparent border-none p-0 cursor-pointer"
                        onClick={() => setEditingVisit(v)}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground">{v.patient_name}</span>
                          <Badge variant="outline" className="text-[10px] rounded-lg">
                            {new Date(v.visit_date).toLocaleDateString()}
                          </Badge>
                          {isOverdue && (
                            <Badge
                              variant="outline"
                              className="bg-rose-500/15 text-rose-700 border-rose-500/30 text-[10px] rounded-lg"
                            >
                              <CalendarClock className="size-3 mr-1" /> Follow-up due
                            </Badge>
                          )}
                        </div>
                        {v.chief_complaint && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {v.chief_complaint}
                          </div>
                        )}
                        {v.diagnosis && (
                          <div className="text-xs mt-0.5 font-medium">
                            <span className="text-muted-foreground">Dx:</span> {v.diagnosis}
                          </div>
                        )}
                        <div className="text-[11px] text-muted-foreground mt-1.5 flex gap-2.5 flex-wrap font-mono">
                          {v.bp_systolic && v.bp_diastolic && (
                            <span className="bg-muted/60 px-1.5 py-0.5 rounded">
                              BP {v.bp_systolic}/{v.bp_diastolic}
                            </span>
                          )}
                          {v.pulse_bpm && (
                            <span className="bg-muted/60 px-1.5 py-0.5 rounded">
                              Pulse {v.pulse_bpm}
                            </span>
                          )}
                          {v.spo2_percent && (
                            <span className="bg-muted/60 px-1.5 py-0.5 rounded">
                              SpO2 {v.spo2_percent}%
                            </span>
                          )}
                        </div>
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingVisit(v)}
                        className="size-8 rounded-lg hover:bg-muted shrink-0 text-muted-foreground"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit/New Visit Record Dialog */}
      {editingVisit && (
        <EMRVisitDialog
          orgId={orgId ?? ""}
          clinicId={clinic?.id ?? ""}
          patients={patientOpts}
          doctors={doctorOpts}
          inventoryItems={inventoryItems}
          pharmacyBatches={pharmacyBatches}
          existing={editingVisit === "new" ? null : editingVisit}
          onClose={() => setEditingVisit(null)}
          onSaved={() => {
            setEditingVisit(null);
            void loadData();
          }}
        />
      )}
    </div>
  );
}

function EMRVisitDialog({
  orgId,
  clinicId,
  patients,
  doctors,
  inventoryItems,
  pharmacyBatches,
  existing,
  onClose,
  onSaved,
}: {
  orgId: string;
  clinicId: string;
  patients: PatientOpt[];
  doctors: DoctorOpt[];
  inventoryItems: InventoryItem[];
  pharmacyBatches: PharmacyBatch[];
  existing: EMRVisit | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<"clinical" | "vitals" | "items">("clinical");
  const [form, setForm] = useState({
    patient_id: existing?.patient_id ?? "",
    patient_name: existing?.patient_name ?? "",
    doctor_id: existing?.doctor_id ?? "",
    visit_date: existing?.visit_date ?? todayISO(),
    chief_complaint: existing?.chief_complaint ?? "",
    diagnosis: existing?.diagnosis ?? "",
    treatment_plan: existing?.treatment_plan ?? "",
    notes: existing?.notes ?? "",
    follow_up_date: existing?.follow_up_date ?? "",
    height_cm: existing?.height_cm ? String(existing.height_cm) : "",
    weight_kg: existing?.weight_kg ? String(existing.weight_kg) : "",
    bp_systolic: existing?.bp_systolic ? String(existing.bp_systolic) : "",
    bp_diastolic: existing?.bp_diastolic ? String(existing.bp_diastolic) : "",
    pulse_bpm: existing?.pulse_bpm ? String(existing.pulse_bpm) : "",
    temperature_c: existing?.temperature_c ? String(existing.temperature_c) : "",
    spo2_percent: existing?.spo2_percent ? String(existing.spo2_percent) : "",
    blood_sugar_mgdl: existing?.blood_sugar_mgdl ? String(existing.blood_sugar_mgdl) : "",
  });
  const [dispensed, setDispensed] = useState<DispensedItem[]>([]);
  const [itemSearch, setItemSearch] = useState("");

  const n = (v: string) => (v.trim() ? Number(v) : null);

  // Combined medicines list: pharmacy batches + inventory
  const allItems = useMemo(() => {
    const pharma = pharmacyBatches.map((b) => ({
      id: `ph_${b.id}`,
      name: b.medicine_name,
      unit: b.unit ?? "pcs",
      qty: b.quantity,
      price: b.selling_price ?? 0,
      source: "pharmacy" as const,
    }));
    const inv = inventoryItems.map((i) => ({
      id: `inv_${i.id}`,
      name: i.name,
      unit: i.unit ?? "pcs",
      qty: i.quantity,
      price: 0,
      source: "inventory" as const,
    }));
    return [...pharma, ...inv];
  }, [pharmacyBatches, inventoryItems]);

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((i) => i.name.toLowerCase().includes(q));
  }, [allItems, itemSearch]);

  function addItem(item: (typeof allItems)[0]) {
    setDispensed((prev) => {
      const ex = prev.find((d) => d.id === item.id);
      if (ex) return prev.map((d) => (d.id === item.id ? { ...d, qty: d.qty + 1 } : d));
      return [
        ...prev,
        { id: item.id, name: item.name, qty: 1, unit: item.unit, price: item.price },
      ];
    });
  }

  function removeItem(id: string) {
    setDispensed((d) => d.filter((x) => x.id !== id));
  }

  async function save() {
    if (!form.patient_name.trim()) {
      toast.error("Patient name required");
      return;
    }
    setSaving(true);
    const payload: any = {
      organization_id: orgId,
      clinic_id: clinicId,
      patient_id: form.patient_id || null,
      patient_name: form.patient_name.trim(),
      doctor_id: form.doctor_id || null,
      visit_date: form.visit_date || todayISO(),
      chief_complaint: form.chief_complaint || null,
      diagnosis: form.diagnosis || null,
      treatment_plan: form.treatment_plan || null,
      notes: form.notes || null,
      follow_up_date: form.follow_up_date || null,
      height_cm: n(form.height_cm),
      weight_kg: n(form.weight_kg),
      bp_systolic: n(form.bp_systolic),
      bp_diastolic: n(form.bp_diastolic),
      pulse_bpm: n(form.pulse_bpm),
      temperature_c: n(form.temperature_c),
      spo2_percent: n(form.spo2_percent),
      blood_sugar_mgdl: n(form.blood_sugar_mgdl),
      dispensed_items: dispensed.length > 0 ? dispensed : null,
    };
    const { error } = existing
      ? await supabase
          .from("patient_visits" as any)
          .update(payload)
          .eq("id", existing.id)
      : await supabase.from("patient_visits" as any).insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Visit updated" : "Visit recorded");
    onSaved();
  }

  const inp = (label: string, key: keyof typeof form, type = "text", placeholder = "") => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <input
        type={type}
        value={form[key] as string}
        placeholder={placeholder}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full h-9 border rounded-md px-3 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );

  const tabCls = (t: string) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeSection === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span>{existing ? "Edit Visit Record" : "New Visit Record"}</span>
            <span className="text-xs font-normal text-muted-foreground">
              Each visit = one vitals snapshot (tracked over time)
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Patient + doctor header — always visible */}
        <div className="grid grid-cols-2 gap-3 shrink-0 pt-1">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Patient</Label>
            <select
              value={form.patient_id}
              onChange={(e) => {
                const p = patients.find((x) => x.id === e.target.value);
                setForm((f) => ({
                  ...f,
                  patient_id: e.target.value,
                  patient_name: p?.name ?? f.patient_name,
                }));
              }}
              className="w-full h-9 border rounded-md px-3 text-sm bg-background focus:outline-none"
            >
              <option value="">— select or type name —</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Or type patient name</Label>
            <input
              value={form.patient_name}
              placeholder="Full name"
              onChange={(e) => setForm((f) => ({ ...f, patient_name: e.target.value }))}
              className="w-full h-9 border rounded-md px-3 text-sm bg-background focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Doctor</Label>
            <select
              value={form.doctor_id}
              onChange={(e) => setForm((f) => ({ ...f, doctor_id: e.target.value }))}
              className="w-full h-9 border rounded-md px-3 text-sm bg-background focus:outline-none"
            >
              <option value="">— no doctor —</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          {inp("Visit date", "visit_date", "date")}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-lg shrink-0">
          <button className={tabCls("clinical")} onClick={() => setActiveSection("clinical")}>
            📋 Clinical Notes
          </button>
          <button className={tabCls("vitals")} onClick={() => setActiveSection("vitals")}>
            💓 Vitals
          </button>
          <button className={tabCls("items")} onClick={() => setActiveSection("items")}>
            💊 Dispensed Items {dispensed.length > 0 && `(${dispensed.length})`}
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* ── CLINICAL NOTES ── */}
          {activeSection === "clinical" && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Chief complaint / Reason for visit
                </Label>
                <input
                  value={form.chief_complaint}
                  placeholder="e.g. Fever and headache for 2 days"
                  onChange={(e) => setForm((f) => ({ ...f, chief_complaint: e.target.value }))}
                  className="w-full h-9 border rounded-md px-3 text-sm bg-background focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Diagnosis</Label>
                <input
                  value={form.diagnosis}
                  placeholder="e.g. Viral URTI, Type-2 Diabetes"
                  onChange={(e) => setForm((f) => ({ ...f, diagnosis: e.target.value }))}
                  className="w-full h-9 border rounded-md px-3 text-sm bg-background focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Treatment plan / Prescription
                </Label>
                <textarea
                  rows={3}
                  value={form.treatment_plan}
                  placeholder="Medications, dosage, lifestyle advice…"
                  onChange={(e) => setForm((f) => ({ ...f, treatment_plan: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none resize-none"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Follow-up date</Label>
                <input
                  type="date"
                  value={form.follow_up_date}
                  onChange={(e) => setForm((f) => ({ ...f, follow_up_date: e.target.value }))}
                  className="w-full h-9 border rounded-md px-3 text-sm bg-background focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Internal notes (not visible to patient)
                </Label>
                <textarea
                  rows={2}
                  value={form.notes}
                  placeholder="Private clinical notes…"
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none resize-none"
                />
              </div>
            </div>
          )}

          {/* ── VITALS ── */}
          {activeSection === "vitals" && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2 p-3 bg-blue-500/10 text-blue-700 dark:text-blue-300 rounded-lg text-xs">
                <HeartPulse className="size-4 shrink-0" />
                <span>
                  Vitals are saved as a <strong>per-visit snapshot</strong>. Log a new visit each
                  time vitals change to build a time-series history.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* BP */}
                <div className="col-span-2 border rounded-lg p-3 space-y-2">
                  <Label className="text-xs font-semibold">Blood Pressure</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      value={form.bp_systolic}
                      placeholder="Systolic"
                      onChange={(e) => setForm((f) => ({ ...f, bp_systolic: e.target.value }))}
                      className="flex-1 h-10 border rounded-md px-3 text-base font-mono bg-background focus:outline-none text-center"
                    />
                    <span className="text-muted-foreground font-bold text-lg">/</span>
                    <input
                      type="number"
                      value={form.bp_diastolic}
                      placeholder="Diastolic"
                      onChange={(e) => setForm((f) => ({ ...f, bp_diastolic: e.target.value }))}
                      className="flex-1 h-10 border rounded-md px-3 text-base font-mono bg-background focus:outline-none text-center"
                    />
                    <span className="text-xs text-muted-foreground">mmHg</span>
                  </div>
                </div>

                {/* Pulse */}
                <div className="border rounded-lg p-3 space-y-1">
                  <Label className="text-xs font-semibold">Pulse</Label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={form.pulse_bpm}
                      placeholder="72"
                      onChange={(e) => setForm((f) => ({ ...f, pulse_bpm: e.target.value }))}
                      className="flex-1 h-9 border rounded-md px-2 text-sm font-mono bg-background focus:outline-none text-center"
                    />
                    <span className="text-xs text-muted-foreground">bpm</span>
                  </div>
                </div>

                {/* Temperature */}
                <div className="border rounded-lg p-3 space-y-1">
                  <Label className="text-xs font-semibold">Temperature</Label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      value={form.temperature_c}
                      placeholder="37.0"
                      onChange={(e) => setForm((f) => ({ ...f, temperature_c: e.target.value }))}
                      className="flex-1 h-9 border rounded-md px-2 text-sm font-mono bg-background focus:outline-none text-center"
                    />
                    <span className="text-xs text-muted-foreground">°C</span>
                  </div>
                </div>

                {/* SpO2 */}
                <div className="border rounded-lg p-3 space-y-1">
                  <Label className="text-xs font-semibold">SpO₂</Label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={form.spo2_percent}
                      placeholder="98"
                      onChange={(e) => setForm((f) => ({ ...f, spo2_percent: e.target.value }))}
                      className="flex-1 h-9 border rounded-md px-2 text-sm font-mono bg-background focus:outline-none text-center"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>

                {/* Blood Sugar */}
                <div className="border rounded-lg p-3 space-y-1">
                  <Label className="text-xs font-semibold">Blood Sugar</Label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={form.blood_sugar_mgdl}
                      placeholder="100"
                      onChange={(e) => setForm((f) => ({ ...f, blood_sugar_mgdl: e.target.value }))}
                      className="flex-1 h-9 border rounded-md px-2 text-sm font-mono bg-background focus:outline-none text-center"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">mg/dL</span>
                  </div>
                </div>

                {/* Weight */}
                <div className="border rounded-lg p-3 space-y-1">
                  <Label className="text-xs font-semibold">Weight</Label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      value={form.weight_kg}
                      placeholder="70"
                      onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))}
                      className="flex-1 h-9 border rounded-md px-2 text-sm font-mono bg-background focus:outline-none text-center"
                    />
                    <span className="text-xs text-muted-foreground">kg</span>
                  </div>
                </div>

                {/* Height */}
                <div className="border rounded-lg p-3 space-y-1">
                  <Label className="text-xs font-semibold">Height</Label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={form.height_cm}
                      placeholder="170"
                      onChange={(e) => setForm((f) => ({ ...f, height_cm: e.target.value }))}
                      className="flex-1 h-9 border rounded-md px-2 text-sm font-mono bg-background focus:outline-none text-center"
                    />
                    <span className="text-xs text-muted-foreground">cm</span>
                  </div>
                </div>

                {/* BMI auto-calc */}
                {form.height_cm && form.weight_kg && Number(form.height_cm) > 0 && (
                  <div className="col-span-2 text-xs text-center text-muted-foreground bg-muted/50 rounded p-2">
                    BMI ={" "}
                    {(Number(form.weight_kg) / Math.pow(Number(form.height_cm) / 100, 2)).toFixed(
                      1,
                    )}{" "}
                    ·{" "}
                    {Number(form.weight_kg) / Math.pow(Number(form.height_cm) / 100, 2) < 18.5
                      ? "Underweight"
                      : Number(form.weight_kg) / Math.pow(Number(form.height_cm) / 100, 2) < 25
                        ? "Normal"
                        : Number(form.weight_kg) / Math.pow(Number(form.height_cm) / 100, 2) < 30
                          ? "Overweight"
                          : "Obese"}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── DISPENSED ITEMS (Pharmacy + Inventory) ── */}
          {activeSection === "items" && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2 p-3 bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded-lg text-xs">
                <span>
                  Select medicines/items dispensed to patient from Pharmacy or Inventory stock.
                </span>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  value={itemSearch}
                  placeholder="Search medicines, supplies…"
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="w-full h-9 border rounded-md pl-9 pr-3 text-sm bg-background focus:outline-none"
                />
              </div>

              {/* Item list */}
              {allItems.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No items in Pharmacy or Inventory. Add stock there first.
                </p>
              ) : (
                <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                  {filteredItems.map((item) => {
                    const added = dispensed.find((d) => d.id === item.id);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/30"
                      >
                        <div className="min-w-0">
                          <span className="font-medium truncate">{item.name}</span>
                          <span
                            className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${item.source === "pharmacy" ? "bg-green-500/15 text-green-700" : "bg-blue-500/15 text-blue-700"}`}
                          >
                            {item.source === "pharmacy" ? "Pharmacy" : "Inventory"} · {item.qty}{" "}
                            {item.unit}
                          </span>
                          {item.price > 0 && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ₹{item.price}
                            </span>
                          )}
                        </div>
                        {added ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() =>
                                setDispensed((d) =>
                                  d.map((x) =>
                                    x.id === item.id && x.qty > 1 ? { ...x, qty: x.qty - 1 } : x,
                                  ),
                                )
                              }
                              className="size-6 border rounded flex items-center justify-center text-muted-foreground hover:bg-muted"
                            >
                              –
                            </button>
                            <span className="w-6 text-center text-sm font-mono">{added.qty}</span>
                            <button
                              onClick={() => addItem(item)}
                              className="size-6 border rounded flex items-center justify-center text-muted-foreground hover:bg-muted"
                            >
                              +
                            </button>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="size-6 text-destructive hover:bg-destructive/10 rounded flex items-center justify-center ml-1"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => addItem(item)}
                          >
                            + Add
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Dispensed summary */}
              {dispensed.length > 0 && (
                <div className="border rounded-lg p-3 space-y-2">
                  <Label className="text-xs font-semibold">Dispensed this visit</Label>
                  {dispensed.map((d) => (
                    <div key={d.id} className="flex items-center justify-between text-sm">
                      <span>{d.name}</span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {d.qty} {d.unit}
                        {d.price > 0 ? ` · ₹${d.qty * d.price}` : ""}
                      </span>
                    </div>
                  ))}
                  {dispensed.some((d) => d.price > 0) && (
                    <div className="pt-2 border-t flex justify-between font-semibold text-sm">
                      <span>Total items cost</span>
                      <span>
                        ₹{dispensed.reduce((s, d) => s + d.qty * d.price, 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — always visible */}
        <div className="flex justify-between items-center pt-3 border-t shrink-0">
          <p className="text-xs text-muted-foreground">
            {activeSection === "vitals" && "Tip: vitals change → log a new visit each visit"}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : existing ? "Update record" : "Save record"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
