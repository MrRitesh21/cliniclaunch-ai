import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { HeartPulse, Plus, Search, Trash2, Pencil, CalendarClock, Paperclip } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dashboard/records")({
  component: () => (<AppGuard appKey="emr"><RecordsPage /></AppGuard>),
});

type Visit = {
  id: string; patient_id: string | null; patient_name: string; doctor_id: string | null;
  visit_date: string; chief_complaint: string | null; diagnosis: string | null;
  treatment_plan: string | null; notes: string | null; follow_up_date: string | null;
  height_cm: number | null; weight_kg: number | null;
  bp_systolic: number | null; bp_diastolic: number | null; pulse_bpm: number | null;
  temperature_c: number | null; spo2_percent: number | null; blood_sugar_mgdl: number | null;
  created_at: string;
};
type PatientOpt = { id: string; name: string };
type DoctorOpt = { id: string; name: string };
type Attachment = {
  id: string; visit_id: string | null; file_url: string; file_name: string; kind: string; created_at: string;
};

const ATTACHMENT_KINDS = ["report", "scan", "photo", "prescription", "other"] as const;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** BMI from the visit's own height/weight. Returns null unless both are
 *  present and sane, so a stray 0 can't render "Infinity". */
function bmi(v: Visit): string | null {
  if (!v.height_cm || !v.weight_kg || v.height_cm <= 0) return null;
  const m = Number(v.height_cm) / 100;
  return (Number(v.weight_kg) / (m * m)).toFixed(1);
}

function RecordsPage() {
  const { org } = useOrganization();
  const orgId = org?.id;
  const [visits, setVisits] = useState<Visit[]>([]);
  const [patients, setPatients] = useState<PatientOpt[]>([]);
  const [doctors, setDoctors] = useState<DoctorOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Visit | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [patientFilter, setPatientFilter] = useState<string>("all");

  async function load() {
    if (!orgId) return;
    const [v, p, d] = await Promise.all([
      supabase.from("patient_visits" as any).select("*")
        .eq("organization_id", orgId).order("visit_date", { ascending: false }),
      supabase.from("patients").select("id, name").eq("organization_id", orgId).order("name"),
      supabase.from("doctors").select("id, name").eq("organization_id", orgId).order("name"),
    ]);
    setVisits((v.data as any[]) ?? []);
    setPatients((p.data as any[]) ?? []);
    setDoctors((d.data as any[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [orgId]);

  const filtered = useMemo(() => {
    let r = visits;
    if (patientFilter !== "all") r = r.filter((v) => v.patient_id === patientFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      r = r.filter((v) =>
        v.patient_name.toLowerCase().includes(q) ||
        (v.diagnosis ?? "").toLowerCase().includes(q) ||
        (v.chief_complaint ?? "").toLowerCase().includes(q));
    }
    return r;
  }, [visits, search, patientFilter]);

  const stats = useMemo(() => {
    const today = todayISO();
    const month = today.slice(0, 7);
    return {
      total: visits.length,
      thisMonth: visits.filter((v) => v.visit_date.startsWith(month)).length,
      // Overdue or due today — the list a receptionist actually chases.
      followUps: visits.filter((v) => v.follow_up_date && v.follow_up_date <= today).length,
      patients: new Set(visits.map((v) => v.patient_id).filter(Boolean)).size,
    };
  }, [visits]);

  async function remove(id: string) {
    if (!confirm("Delete this visit record? Attachments on it are removed too.")) return;
    const { error } = await supabase.from("patient_visits" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Patient records</h1>
          <p className="text-sm text-muted-foreground">Visit history, vitals, diagnoses and reports.</p>
        </div>
        <Button onClick={() => setEditing("new")}><Plus className="size-4 mr-1" /> New visit</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsCard title="Total visits" value={stats.total} />
        <StatsCard title="This month" value={stats.thisMonth} />
        <StatsCard title="Patients seen" value={stats.patients} />
        <StatsCard title="Follow-ups due" value={stats.followUps} />
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search name, diagnosis, complaint…" value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={patientFilter} onValueChange={setPatientFilter}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All patients</SelectItem>
            {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? <Skeleton className="h-48 w-full" /> :
        filtered.length === 0 ? (
          <EmptyState icon={<HeartPulse className="size-6" />} title="No visit records"
            description="Record a visit after a consultation to build the patient's history." />
        ) : (
          <Card className="divide-y">
            {filtered.map((v) => {
              const b = bmi(v);
              const overdue = v.follow_up_date && v.follow_up_date <= todayISO();
              return (
                <div key={v.id} className="p-4 flex items-start justify-between gap-3 hover:bg-muted/40">
                  <button className="text-left flex-1 min-w-0" onClick={() => setEditing(v)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{v.patient_name}</span>
                      <Badge variant="outline">{new Date(v.visit_date).toLocaleDateString()}</Badge>
                      {overdue && (
                        <Badge variant="outline" className="bg-rose-500/15 text-rose-700 border-rose-500/30">
                          <CalendarClock className="size-3 mr-1" /> Follow-up due
                        </Badge>
                      )}
                    </div>
                    {v.chief_complaint && <div className="text-sm text-muted-foreground mt-0.5">{v.chief_complaint}</div>}
                    {v.diagnosis && <div className="text-sm mt-0.5"><span className="text-muted-foreground">Dx:</span> {v.diagnosis}</div>}
                    <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                      {v.bp_systolic && v.bp_diastolic && <span>BP {v.bp_systolic}/{v.bp_diastolic}</span>}
                      {v.pulse_bpm && <span>Pulse {v.pulse_bpm}</span>}
                      {v.temperature_c && <span>Temp {v.temperature_c}°C</span>}
                      {v.spo2_percent && <span>SpO₂ {v.spo2_percent}%</span>}
                      {v.blood_sugar_mgdl && <span>Sugar {v.blood_sugar_mgdl}</span>}
                      {b && <span>BMI {b}</span>}
                    </div>
                  </button>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(v)}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(v.id)}><Trash2 className="size-4" /></Button>
                  </div>
                </div>
              );
            })}
          </Card>
        )}

      {editing && orgId && (
        <VisitSheet orgId={orgId} patients={patients} doctors={doctors}
          existing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

function VisitSheet({ orgId, patients, doctors, existing, onClose, onSaved }: {
  orgId: string; patients: PatientOpt[]; doctors: DoctorOpt[];
  existing: Visit | null; onClose: () => void; onSaved: () => void;
}) {
  const [patientId, setPatientId] = useState<string | null>(existing?.patient_id ?? null);
  const [patientName, setPatientName] = useState(existing?.patient_name ?? "");
  const [doctorId, setDoctorId] = useState<string | null>(existing?.doctor_id ?? null);
  const [visitDate, setVisitDate] = useState(existing?.visit_date ?? todayISO());
  const [complaint, setComplaint] = useState(existing?.chief_complaint ?? "");
  const [diagnosis, setDiagnosis] = useState(existing?.diagnosis ?? "");
  const [plan, setPlan] = useState(existing?.treatment_plan ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [followUp, setFollowUp] = useState(existing?.follow_up_date ?? "");
  const [saving, setSaving] = useState(false);

  // Vitals are all optional free numbers; keep them as strings in the form so
  // a cleared field round-trips to NULL instead of 0.
  const [vitals, setVitals] = useState({
    height_cm: existing?.height_cm?.toString() ?? "",
    weight_kg: existing?.weight_kg?.toString() ?? "",
    bp_systolic: existing?.bp_systolic?.toString() ?? "",
    bp_diastolic: existing?.bp_diastolic?.toString() ?? "",
    pulse_bpm: existing?.pulse_bpm?.toString() ?? "",
    temperature_c: existing?.temperature_c?.toString() ?? "",
    spo2_percent: existing?.spo2_percent?.toString() ?? "",
    blood_sugar_mgdl: existing?.blood_sugar_mgdl?.toString() ?? "",
  });
  const setV = (k: keyof typeof vitals, val: string) => setVitals((s) => ({ ...s, [k]: val }));
  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  async function save() {
    if (!patientName.trim()) return toast.error("Patient name required");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const payload: any = {
      organization_id: orgId, patient_id: patientId, patient_name: patientName.trim(),
      doctor_id: doctorId, visit_date: visitDate,
      chief_complaint: complaint.trim() || null, diagnosis: diagnosis.trim() || null,
      treatment_plan: plan.trim() || null, notes: notes.trim() || null,
      follow_up_date: followUp || null,
      height_cm: num(vitals.height_cm), weight_kg: num(vitals.weight_kg),
      bp_systolic: num(vitals.bp_systolic), bp_diastolic: num(vitals.bp_diastolic),
      pulse_bpm: num(vitals.pulse_bpm), temperature_c: num(vitals.temperature_c),
      spo2_percent: num(vitals.spo2_percent), blood_sugar_mgdl: num(vitals.blood_sugar_mgdl),
    };
    if (!existing) payload.created_by = u.user?.id ?? null;
    const { error } = existing
      ? await supabase.from("patient_visits" as any).update(payload).eq("id", existing.id)
      : await supabase.from("patient_visits" as any).insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved"); onSaved();
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader><SheetTitle>{existing ? "Edit visit" : "New visit"}</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Patient</Label>
              <Select value={patientId ?? "__manual"} onValueChange={(v) => {
                if (v === "__manual") return setPatientId(null);
                setPatientId(v);
                const p = patients.find((x) => x.id === v);
                if (p) setPatientName(p.name);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__manual">— Type manually —</SelectItem>
                  {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Patient name</Label><Input value={patientName} onChange={(e) => setPatientName(e.target.value)} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Doctor</Label>
              <Select value={doctorId ?? "__none"} onValueChange={(v) => setDoctorId(v === "__none" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Not set —</SelectItem>
                  {doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Visit date</Label><Input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} /></div>
          </div>

          <div><Label>Chief complaint</Label><Textarea rows={2} value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="What the patient came in for" /></div>

          <div className="rounded-xl border p-3 space-y-3">
            <p className="font-medium text-sm">Vitals</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div><Label className="text-xs">Height (cm)</Label><Input type="number" value={vitals.height_cm} onChange={(e) => setV("height_cm", e.target.value)} /></div>
              <div><Label className="text-xs">Weight (kg)</Label><Input type="number" value={vitals.weight_kg} onChange={(e) => setV("weight_kg", e.target.value)} /></div>
              <div><Label className="text-xs">BP systolic</Label><Input type="number" value={vitals.bp_systolic} onChange={(e) => setV("bp_systolic", e.target.value)} /></div>
              <div><Label className="text-xs">BP diastolic</Label><Input type="number" value={vitals.bp_diastolic} onChange={(e) => setV("bp_diastolic", e.target.value)} /></div>
              <div><Label className="text-xs">Pulse (bpm)</Label><Input type="number" value={vitals.pulse_bpm} onChange={(e) => setV("pulse_bpm", e.target.value)} /></div>
              <div><Label className="text-xs">Temp (°C)</Label><Input type="number" value={vitals.temperature_c} onChange={(e) => setV("temperature_c", e.target.value)} /></div>
              <div><Label className="text-xs">SpO₂ (%)</Label><Input type="number" value={vitals.spo2_percent} onChange={(e) => setV("spo2_percent", e.target.value)} /></div>
              <div><Label className="text-xs">Sugar (mg/dL)</Label><Input type="number" value={vitals.blood_sugar_mgdl} onChange={(e) => setV("blood_sugar_mgdl", e.target.value)} /></div>
            </div>
          </div>

          <div><Label>Diagnosis</Label><Textarea rows={2} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></div>
          <div><Label>Treatment plan</Label><Textarea rows={3} value={plan} onChange={(e) => setPlan(e.target.value)} /></div>
          <div><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div><Label>Follow-up date</Label><Input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} /></div>

          {existing && <Attachments orgId={orgId} visitId={existing.id} patientId={existing.patient_id} />}

          <div className="flex gap-2 justify-end pb-4">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Attachments are only offered once the visit exists, so there is always a
 *  visit_id to hang them on rather than orphaning uploads on a cancelled form. */
function Attachments({ orgId, visitId, patientId }: {
  orgId: string; visitId: string; patientId: string | null;
}) {
  const [rows, setRows] = useState<Attachment[]>([]);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("report");

  async function load() {
    const { data } = await supabase.from("patient_attachments" as any)
      .select("*").eq("visit_id", visitId).order("created_at", { ascending: false });
    setRows((data as any[]) ?? []);
  }
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [visitId]);

  async function add() {
    if (!url.trim() || !name.trim()) return toast.error("File name and URL required");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("patient_attachments" as any).insert({
      organization_id: orgId, visit_id: visitId, patient_id: patientId,
      file_url: url.trim(), file_name: name.trim(), kind, uploaded_by: u.user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    setUrl(""); setName(""); toast.success("Attached"); load();
  }

  async function remove(id: string) {
    await supabase.from("patient_attachments" as any).delete().eq("id", id);
    load();
  }

  return (
    <div className="rounded-xl border p-3 space-y-3">
      <p className="font-medium text-sm"><Paperclip className="size-4 inline mr-1" /> Attachments</p>
      {rows.length > 0 && (
        <div className="divide-y">
          {rows.map((a) => (
            <div key={a.id} className="py-2 flex items-center justify-between gap-2">
              <a href={a.file_url} target="_blank" rel="noreferrer" className="text-sm underline truncate">
                {a.file_name}
              </a>
              <div className="flex items-center gap-1 shrink-0">
                <Badge variant="outline">{a.kind}</Badge>
                <Button size="icon" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="size-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="File name" value={name} onChange={(e) => setName(e.target.value)} />
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ATTACHMENT_KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Input placeholder="https://… file URL" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button variant="outline" onClick={add}>Attach</Button>
      </div>
    </div>
  );
}
