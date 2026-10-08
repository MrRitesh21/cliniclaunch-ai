import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "./dashboard";
import { useOrganization } from "@/hooks/useOrganization";
import { AppGuard } from "@/components/app/AppGuard";
import { readCache, writeCache } from "@/lib/persist-cache";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { AvatarInitials } from "@/components/ui/skeleton-rows";
import {
  ArrowLeft,
  Phone,
  Calendar,
  HeartPulse,
  FileText,
  MessageCircle,
  Stethoscope,
  Plus,
  Clock,
  Video,
  MapPin,
  Mic,
  MicOff,
  Sparkles,
  Send,
  CheckCircle2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/patients/$patientId")({
  component: () => (
    <AppGuard appKey="crm">
      <PatientProfilePage />
    </AppGuard>
  ),
});

const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

function getCachedPatient(id: string, clinicId?: string): any {
  if (typeof window === "undefined" || !id) return null;
  const snap = readCache<any>(`patient_snap_${id}`, ONE_WEEK);
  if (snap) return snap;
  const dir = (clinicId && readCache<any[]>(`clinicx_patients_${clinicId}`, ONE_WEEK)) ||
              readCache<any[]>(`clinicx_patients_all`, ONE_WEEK);
  return dir?.find((p: any) => p.id === id || p.phone === id) || null;
}

function getCachedAppts(id: string): any[] {
  if (typeof window === "undefined" || !id) return [];
  return readCache<any[]>(`patient_appts_${id}`, ONE_WEEK) || [];
}

function getCachedVisits(id: string): any[] {
  if (typeof window === "undefined" || !id) return [];
  return readCache<any[]>(`patient_visits_${id}`, ONE_WEEK) || [];
}

function PatientProfilePage() {
  const { patientId } = Route.useParams();
  const clinic = useClinic();
  const { org } = useOrganization();
  const orgId = org?.id;

  const cachedPatient = getCachedPatient(patientId, clinic?.id);
  const [patient, setPatient] = useState<any>(cachedPatient);
  const [appointments, setAppointments] = useState<any[]>(() => getCachedAppts(patientId));
  const [emrVisits, setEmrVisits] = useState<any[]>(() => getCachedVisits(patientId));
  const [loading, setLoading] = useState(!cachedPatient);
  const [refreshing, setRefreshing] = useState(false);

  // Direct Voice & Quick EMR state
  const [showQuickRx, setShowQuickRx] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [activeVoiceField, setActiveVoiceField] = useState<"complaint" | "diagnosis" | "rx">("rx");
  const [savingRx, setSavingRx] = useState(false);

  // Form Fields
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [bp, setBp] = useState("");
  const [pulse, setPulse] = useState("");
  const [temp, setTemp] = useState("");
  const [weight, setWeight] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    async function loadData() {
      if (!patientId) return;
      if (!patient) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patientId);

        // Run all queries simultaneously in parallel for instant roundtrip
        const [patientRes, apptRes, visitRes] = await Promise.all([
          isUuid
            ? supabase.from("patients").select("*").eq("id", patientId).maybeSingle()
            : supabase.from("patients").select("*").eq("phone", patientId).limit(1).maybeSingle(),
          clinic?.id
            ? supabase
                .from("appointments")
                .select("id, scheduled_at, status, problem, appointment_type, patient_name, patient_phone, patient_email, patient_age, patient_gender")
                .eq("clinic_id", clinic.id)
                .or(`patient_phone.eq.${patientId},id.eq.${isUuid ? patientId : "00000000-0000-0000-0000-000000000000"}`)
                .order("scheduled_at", { ascending: false })
            : Promise.resolve({ data: [] }),
          clinic?.id
            ? supabase
                .from("consultations" as any)
                .select("*")
                .eq("clinic_id", clinic.id)
                .or(isUuid ? `patient_id.eq.${patientId}` : `patient_name.eq.${cachedPatient?.name || patientId}`)
                .order("created_at", { ascending: false })
            : Promise.resolve({ data: [] }),
        ]);

        let resolvedPatient: any = patientRes.data;
        if (!resolvedPatient && apptRes.data && (apptRes.data as any[]).length > 0) {
          const first = (apptRes.data as any[])[0];
          resolvedPatient = {
            id: patientId,
            name: first.patient_name,
            phone: first.patient_phone,
            email: first.patient_email,
            age: first.patient_age,
            gender: first.patient_gender,
          };
        }
        if (!resolvedPatient && cachedPatient) {
          resolvedPatient = cachedPatient;
        }

        if (resolvedPatient) {
          setPatient(resolvedPatient);
          writeCache(`patient_snap_${patientId}`, resolvedPatient);
          if (resolvedPatient.phone) writeCache(`patient_snap_${resolvedPatient.phone}`, resolvedPatient);
        }

        if (apptRes.data) {
          setAppointments(apptRes.data as any[]);
          writeCache(`patient_appts_${patientId}`, apptRes.data);
        }

        let visits = (visitRes.data as any[]) ?? [];
        if (visits.length === 0 && resolvedPatient?.name && clinic?.id) {
          const { data: nameVisits } = await supabase
            .from("consultations" as any)
            .select("*")
            .eq("clinic_id", clinic.id)
            .eq("patient_name", resolvedPatient.name)
            .order("created_at", { ascending: false });
          if (nameVisits && nameVisits.length > 0) {
            visits = nameVisits;
          }
        }

        setEmrVisits(visits);
        writeCache(`patient_visits_${patientId}`, visits);
      } catch (err) {
        console.error("Failed to load patient profile:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }
    loadData();
  }, [clinic?.id, orgId, patientId]);

  // Speech-to-Text Voice Dictation handler
  function toggleVoiceDictation(field: "complaint" | "diagnosis" | "rx") {
    setActiveVoiceField(field);

    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      toast.error("Voice dictation is not supported on this browser. Type directly in the box.");
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-IN"; // Supports English with Indian medical context

      recognition.onstart = () => {
        setIsRecording(true);
        toast.info(`🎙️ Listening... Speak ${field === "rx" ? "medicines & instructions" : field}`);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTranscript += item[0].transcript + " ";
          }
        }

        if (finalTranscript.trim()) {
          const text = finalTranscript.trim();
          if (field === "complaint") {
            setChiefComplaint((prev) => (prev ? `${prev} ${text}` : text));
          } else if (field === "diagnosis") {
            setDiagnosis((prev) => (prev ? `${prev} ${text}` : text));
          } else if (field === "rx") {
            setTreatmentPlan((prev) => (prev ? `${prev}\n${text}` : text));
          }
        }
      };

      recognition.onerror = (e: any) => {
        setIsRecording(false);
        if (e.error === "not-allowed") {
          toast.error("Microphone permission denied. Enable microphone access in browser settings.");
        } else if (e.error !== "no-speech" && e.error !== "aborted") {
          toast.info("Voice dictation paused.");
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error(e);
      toast.error("Failed to start microphone.");
      setIsRecording(false);
    }
  }

  async function handleSaveQuickRx() {
    if (!treatmentPlan.trim() && !chiefComplaint.trim() && !diagnosis.trim()) {
      toast.error("Please enter symptoms, diagnosis, or prescription medicines");
      return;
    }

    setSavingRx(true);
    try {
      const isRealUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patient.id);

      const payload = {
        organization_id: orgId,
        clinic_id: clinic?.id,
        patient_id: isRealUuid ? patient.id : null,
        patient_name: patient.name,
        chief_complaint: chiefComplaint.trim() || null,
        diagnosis: diagnosis.trim() || null,
        treatment_plan: treatmentPlan.trim() || null,
        bp: bp.trim() || null,
        pulse_bpm: pulse.trim() ? Number(pulse) : null,
        temperature_c: temp.trim() ? Number(temp) : null,
        weight_kg: weight.trim() ? Number(weight) : null,
        follow_up_date: followUpDate || null,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("consultations" as any)
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      toast.success("Clinical Record & Rx saved successfully!");
      setEmrVisits((prev) => [data, ...prev]);

      // Reset Form & Collapse
      setChiefComplaint("");
      setDiagnosis("");
      setTreatmentPlan("");
      setBp("");
      setPulse("");
      setTemp("");
      setWeight("");
      setFollowUpDate("");
      setShowQuickRx(false);
      if (isRecording && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsRecording(false);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingRx(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!patient) {
    return <div className="p-8 text-center text-muted-foreground">Patient not found.</div>;
  }

  const cleanPhone = patient.phone?.replace(/[^0-9]/g, "") || "";
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`}`
    : "#";

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/dashboard/patients"
          className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors bg-muted/50 px-2.5 py-1.5 rounded-xl border border-border/60"
        >
          <ArrowLeft className="size-3.5 mr-1" /> Directory
        </Link>
        <div className="flex items-center gap-2">
          {refreshing && (
            <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md font-medium">
              <span className="size-1.5 rounded-full bg-primary animate-ping" />
              Syncing…
            </span>
          )}
          <span className="text-xs text-muted-foreground font-mono">
            ID: {patient.id?.slice(0, 8)}
          </span>
        </div>
      </div>

      {/* 360 Header Profile Card */}
      <Card className="p-4 sm:p-5 overflow-hidden relative border-border/80 shadow-xs bg-card">
        <div className="absolute top-0 right-0 p-4 bg-primary/5 rounded-bl-3xl pointer-events-none">
          <HeartPulse className="size-16 sm:size-20 text-primary/15" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 sm:gap-4">
            <AvatarInitials
              name={patient.name}
              className="size-13 sm:size-15 text-lg sm:text-xl rounded-2xl shadow-xs"
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold font-display text-foreground">
                  {patient.name}
                </h1>
                <Badge variant="secondary" className="text-xs font-semibold">
                  {appointments.length} {appointments.length === 1 ? "Visit" : "Visits"}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground mt-0.5">
                {patient.phone && (
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <Phone className="size-3 text-emerald-600" /> {patient.phone}
                  </span>
                )}
                {patient.email && <span>• {patient.email}</span>}
                {(patient.age || patient.gender) && (
                  <span>
                    •{" "}
                    {[patient.age && `${patient.age} yrs`, patient.gender]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Contact & Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
            {patient.phone && (
              <>
                <a href={`tel:${patient.phone}`}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl font-medium"
                  >
                    <Phone className="size-3.5" /> Call
                  </Button>
                </a>
                <a href={waUrl} target="_blank" rel="noreferrer">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl font-medium"
                  >
                    <MessageCircle className="size-3.5" /> WhatsApp
                  </Button>
                </a>
              </>
            )}
            <Button
              size="sm"
              onClick={() => setShowQuickRx((prev) => !prev)}
              className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold shadow-xs rounded-xl"
            >
              <Mic className="size-3.5" /> {showQuickRx ? "Close Rx" : "Quick Voice Rx"}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Column: Direct Voice Rx Creator & EMR Clinical Visits (Rendered First / Above Appointments) */}
        <div className="space-y-4 lg:col-span-2">
          {/* Direct Quick Voice Mode Prescription Writer */}
          {showQuickRx && (
            <Card className="p-4 sm:p-5 border-primary/40 bg-gradient-to-br from-primary/[0.03] to-transparent shadow-md space-y-4 rounded-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-xl bg-primary/10 text-primary grid place-items-center">
                    <Mic className="size-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Direct Clinical Voice Writer</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Dictate symptoms, diagnosis, and medicines directly with live speech recognition.
                    </p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 rounded-lg text-muted-foreground hover:bg-muted"
                  onClick={() => setShowQuickRx(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>

              {/* Speech Recognition Active Banner */}
              {isRecording && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between text-xs text-rose-600 dark:text-rose-400 font-medium animate-pulse">
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-rose-500 animate-ping" />
                    Listening to doctor voice for: <b className="uppercase">{activeVoiceField}</b>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleVoiceDictation(activeVoiceField)}
                    className="h-6 text-[11px] px-2 text-rose-600 hover:bg-rose-500/20"
                  >
                    <MicOff className="size-3 mr-1" /> Stop Mic
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                {/* Chief Complaint */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-semibold">Chief Complaint / Symptoms</Label>
                    <button
                      type="button"
                      onClick={() => toggleVoiceDictation("complaint")}
                      className={`text-[11px] px-2 py-0.5 rounded-lg border font-semibold flex items-center gap-1 transition ${
                        isRecording && activeVoiceField === "complaint"
                          ? "bg-rose-500 text-white border-rose-500 shadow-xs"
                          : "bg-background border-border/80 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Mic className="size-3" /> Dictate
                    </button>
                  </div>
                  <Input
                    placeholder="e.g. Fever with dry cough for 3 days, mild headache"
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    className="text-xs h-9 rounded-xl"
                  />
                </div>

                {/* Diagnosis */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-semibold">Diagnosis</Label>
                    <button
                      type="button"
                      onClick={() => toggleVoiceDictation("diagnosis")}
                      className={`text-[11px] px-2 py-0.5 rounded-lg border font-semibold flex items-center gap-1 transition ${
                        isRecording && activeVoiceField === "diagnosis"
                          ? "bg-rose-500 text-white border-rose-500 shadow-xs"
                          : "bg-background border-border/80 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Mic className="size-3" /> Dictate
                    </button>
                  </div>
                  <Input
                    placeholder="e.g. Acute Upper Respiratory Tract Infection (URTI)"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    className="text-xs h-9 rounded-xl"
                  />
                </div>

                {/* Treatment Plan & Rx */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-semibold">Prescription Medicines & Dosage *</Label>
                    <button
                      type="button"
                      onClick={() => toggleVoiceDictation("rx")}
                      className={`text-[11px] px-2 py-0.5 rounded-lg border font-semibold flex items-center gap-1 transition ${
                        isRecording && activeVoiceField === "rx"
                          ? "bg-rose-500 text-white border-rose-500 shadow-xs"
                          : "bg-primary text-primary-foreground border-primary shadow-xs"
                      }`}
                    >
                      <Mic className="size-3" /> 🎙️ Dictate Rx
                    </button>
                  </div>
                  <Textarea
                    rows={3}
                    placeholder="1. Tab Paracetamol 650mg — 1-0-1 after food (3 days)&#10;2. Tab Cetirizine 10mg — 0-0-1 at bedtime (5 days)&#10;3. Warm saline gargles twice daily"
                    value={treatmentPlan}
                    onChange={(e) => setTreatmentPlan(e.target.value)}
                    className="text-xs font-mono rounded-xl leading-relaxed"
                  />
                </div>

                {/* Vitals Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">BP (mmHg)</Label>
                    <Input
                      placeholder="120/80"
                      value={bp}
                      onChange={(e) => setBp(e.target.value)}
                      className="text-xs h-8 rounded-lg mt-0.5"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Pulse (bpm)</Label>
                    <Input
                      type="number"
                      placeholder="72"
                      value={pulse}
                      onChange={(e) => setPulse(e.target.value)}
                      className="text-xs h-8 rounded-lg mt-0.5"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Temp (°C)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="37.0"
                      value={temp}
                      onChange={(e) => setTemp(e.target.value)}
                      className="text-xs h-8 rounded-lg mt-0.5"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Weight (kg)</Label>
                    <Input
                      type="number"
                      placeholder="65"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="text-xs h-8 rounded-lg mt-0.5"
                    />
                  </div>
                </div>

                {/* Follow up date */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1">
                    <Label className="text-[11px] text-muted-foreground">Follow-up Date</Label>
                    <Input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="text-xs h-8 rounded-lg mt-0.5"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuickRx(false)}
                  disabled={savingRx}
                  className="h-8 text-xs rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveQuickRx}
                  disabled={savingRx}
                  className="h-8 text-xs font-bold rounded-xl bg-primary text-primary-foreground shadow-xs flex-1 gap-1.5"
                >
                  <Send className="size-3.5" />
                  {savingRx ? "Saving Record…" : "Save Record & Add to Timeline"}
                </Button>
              </div>
            </Card>
          )}

          {/* EMR Consultation Feed */}
          <Card className="p-4 sm:p-5 border-border/80 shadow-xs bg-card">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="font-bold text-sm flex items-center gap-2 text-foreground">
                <FileText className="size-4 text-primary" /> Clinical Records &amp; EMR ({emrVisits.length})
              </h3>
              <Button
                size="sm"
                onClick={() => setShowQuickRx(true)}
                className="h-7 text-xs gap-1 font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
              >
                <Plus className="size-3" /> Direct Rx
              </Button>
            </div>

            {emrVisits.length === 0 ? (
              <div className="p-8 text-center border rounded-2xl bg-muted/10 border-dashed space-y-2">
                <FileText className="size-8 mx-auto text-muted-foreground/40" />
                <p className="text-sm font-bold text-foreground">No clinical records found</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Click <b>Direct Rx</b> above to write or voice-dictate a prescription directly into this patient timeline.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {emrVisits.map((v) => {
                  const visitDate = v.created_at || v.visit_date;
                  return (
                    <div
                      key={v.id}
                      className="border rounded-xl p-4 space-y-3 hover:border-primary/40 transition-colors bg-card border-border/80 shadow-xs"
                    >
                      <div className="flex flex-wrap justify-between items-start gap-2 border-b border-border/60 pb-2.5">
                        <div>
                          <div className="font-bold text-foreground text-sm sm:text-base">
                            {visitDate
                              ? new Date(visitDate).toLocaleDateString("en-US", {
                                  weekday: "short",
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })
                              : "Consultation"}
                          </div>
                          {v.follow_up_date && (
                            <div className="text-xs text-amber-600 dark:text-amber-500 font-semibold mt-0.5">
                              Follow-up: {new Date(v.follow_up_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className="font-semibold text-[10px] bg-primary/10 text-primary border-primary/20"
                        >
                          Consultation Visit
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {v.chief_complaint && (
                          <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">
                              Chief Complaint
                            </div>
                            <p className="text-xs text-foreground bg-muted/20 p-2 rounded-lg border border-border/60">
                              {v.chief_complaint}
                            </p>
                          </div>
                        )}

                        {v.diagnosis && (
                          <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">
                              Diagnosis
                            </div>
                            <p className="text-xs font-semibold text-primary bg-primary/5 p-2 rounded-lg border border-primary/20">
                              {v.diagnosis}
                            </p>
                          </div>
                        )}

                        {v.treatment_plan && (
                          <div className="sm:col-span-2">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">
                              Treatment Plan &amp; Rx
                            </div>
                            <p className="text-xs text-foreground whitespace-pre-wrap bg-muted/30 p-2.5 rounded-lg border border-border/60 leading-relaxed font-mono">
                              {v.treatment_plan}
                            </p>
                          </div>
                        )}

                        {(v.examination || v.history || v.notes) && (
                          <div className="sm:col-span-2">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">
                              Clinical Examination &amp; Notes
                            </div>
                            <p className="text-xs text-foreground italic opacity-85 bg-muted/10 p-2 rounded-lg">
                              {v.examination || v.history || v.notes}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Vitals Summary */}
                      {(v.bp ||
                        v.bp_systolic ||
                        v.pulse ||
                        v.pulse_bpm ||
                        v.temperature ||
                        v.temperature_c ||
                        v.spo2_percent ||
                        v.weight ||
                        v.weight_kg) && (
                        <div className="pt-2.5 mt-2 border-t border-border/60">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1.5">
                            Vitals
                          </div>
                          <div className="flex flex-wrap gap-1.5 text-xs font-mono">
                            {(v.bp || (v.bp_systolic && v.bp_diastolic)) && (
                              <span className="bg-muted px-2 py-0.5 rounded border">
                                BP: {v.bp || `${v.bp_systolic}/${v.bp_diastolic}`}
                              </span>
                            )}
                            {(v.pulse || v.pulse_bpm) && (
                              <span className="bg-muted px-2 py-0.5 rounded border">
                                Pulse: {v.pulse || v.pulse_bpm} bpm
                              </span>
                            )}
                            {(v.temperature || v.temperature_c) && (
                              <span className="bg-muted px-2 py-0.5 rounded border">
                                Temp: {v.temperature || v.temperature_c}°C
                              </span>
                            )}
                            {v.spo2_percent && (
                              <span className="bg-muted px-2 py-0.5 rounded border">
                                SpO2: {v.spo2_percent}%
                              </span>
                            )}
                            {(v.weight || v.weight_kg) && (
                              <span className="bg-muted px-2 py-0.5 rounded border">
                                Weight: {v.weight || v.weight_kg}kg
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Secondary Column: Appointments & History (Rendered Below EMR on Mobile) */}
        <div className="space-y-4 lg:col-span-1">
          <Card className="p-4 sm:p-5 border-border/80 shadow-xs bg-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm flex items-center gap-2 text-foreground">
                <Calendar className="size-4 text-primary" /> Appointments ({appointments.length})
              </h3>
              <Link to="/dashboard/appointments">
                <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-primary font-semibold">
                  View all
                </Button>
              </Link>
            </div>
            {appointments.length === 0 ? (
              <p className="text-xs text-muted-foreground p-4 text-center border border-dashed rounded-xl">
                No appointments recorded.
              </p>
            ) : (
              <div className="space-y-2.5">
                {appointments.map((a) => {
                  const d = new Date(a.scheduled_at);
                  const isOnline = a.appointment_type === "online";
                  return (
                    <div
                      key={a.id}
                      className="text-xs p-3 border rounded-xl bg-muted/20 border-border/70 space-y-1.5"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-foreground">
                          {d.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <StatusBadge status={a.status as any} />
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />{" "}
                          {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
                        <span className="flex items-center gap-1 font-medium">
                          {isOnline ? (
                            <Video className="size-3 text-purple-600" />
                          ) : (
                            <MapPin className="size-3 text-emerald-600" />
                          )}
                          {isOnline ? "Video" : "Clinic"}
                        </span>
                      </div>
                      {a.problem && (
                        <p className="text-[11px] text-muted-foreground italic mt-1">{a.problem}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
