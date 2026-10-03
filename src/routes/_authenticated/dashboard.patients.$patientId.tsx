import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "./dashboard";
import { useOrganization } from "@/hooks/useOrganization";
import { AppGuard } from "@/components/app/AppGuard";
import { PageHeader } from "@/components/ui/page-header";
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
  ChevronRight,
  MessageCircle,
  Stethoscope,
  Receipt,
  UserRound,
  Plus,
  Clock,
  Video,
  MapPin,
  Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard/patients/$patientId")({
  component: () => (
    <AppGuard appKey="crm">
      <PatientProfilePage />
    </AppGuard>
  ),
});

function PatientProfilePage() {
  const { patientId } = Route.useParams();
  const clinic = useClinic();
  const { org } = useOrganization();
  const orgId = org?.id;

  const [patient, setPatient] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [emrVisits, setEmrVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!clinic?.id || !orgId || !patientId) return;
      setLoading(true);
      try {
        // Fetch patient (Try ID first, then phone)
        let patientData = null;
        
        // Only attempt UUID lookup if it looks like a UUID
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patientId);
        
        if (isUuid) {
          const { data } = await supabase
            .from("patients")
            .select("*")
            .eq("id", patientId)
            .single();
          patientData = data;
        }

        if (!patientData) {
          const { data } = await supabase
            .from("patients")
            .select("*")
            .eq("phone", patientId)
            .limit(1)
            .maybeSingle();
          patientData = data;
        }

        if (patientData) {
          setPatient(patientData);
          
          // Fetch appointments
          const { data: apptData } = await supabase
            .from("appointments")
            .select("id, scheduled_at, status, problem, appointment_type")
            .eq("clinic_id", clinic.id)
            .eq("patient_phone", patientData.phone || "")
            .order("scheduled_at", { ascending: false });
            
          setAppointments(apptData ?? []);

          // Fetch EMR consultations
          const { data: visitData } = await supabase
            .from("consultations")
            .select("*")
            .eq("clinic_id", clinic.id)
            .eq("patient_id", patientData.id)
            .order("created_at", { ascending: false });

          setEmrVisits(visitData ?? []);
        } else {
          // If patientId is a phone number (legacy from previous implementation)
          const { data: apptData } = await supabase
            .from("appointments")
            .select("*")
            .eq("clinic_id", clinic.id)
            .eq("patient_phone", patientId)
            .order("scheduled_at", { ascending: false });

          if (apptData && apptData.length > 0) {
            const first = apptData[0];
            setPatient({
              id: patientId,
              name: first.patient_name,
              phone: first.patient_phone,
              email: first.patient_email,
              age: first.patient_age,
              gender: first.patient_gender,
            });
            setAppointments(apptData);

            // Fetch EMR consultations by name since ID might not match
            const { data: visitData } = await supabase
              .from("consultations")
              .select("*")
              .eq("clinic_id", clinic.id)
              .eq("patient_name", first.patient_name)
              .order("created_at", { ascending: false });

            setEmrVisits(visitData ?? []);
          }
        }
      } catch (err) {
        console.error("Failed to load patient profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [clinic?.id, orgId, patientId]);

  if (loading) {
    return <div className="space-y-6"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!patient) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Patient not found.
      </div>
    );
  }

  const cleanPhone = patient.phone?.replace(/[^0-9]/g, "") || "";
  const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`}` : "#";

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/dashboard/patients"
          className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors bg-muted/50 px-2.5 py-1.5 rounded-lg border border-border/60"
        >
          <ArrowLeft className="size-3.5 mr-1" /> Directory
        </Link>
        <span className="text-xs text-muted-foreground font-mono">ID: {patient.id?.slice(0, 8)}</span>
      </div>

      {/* 360 Header Profile Card */}
      <Card className="p-4 sm:p-6 overflow-hidden relative border-border/80 shadow-xs">
        <div className="absolute top-0 right-0 p-4 bg-primary/5 rounded-bl-3xl pointer-events-none">
          <HeartPulse className="size-16 sm:size-20 text-primary/15" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 sm:gap-4">
            <AvatarInitials name={patient.name} className="size-14 sm:size-16 text-lg sm:text-xl rounded-2xl shadow-xs" />
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold font-display text-foreground">{patient.name}</h1>
                <Badge variant="secondary" className="text-xs font-semibold">
                  {appointments.length} {appointments.length === 1 ? "Visit" : "Visits"}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground mt-1">
                {patient.phone && (
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <Phone className="size-3 text-emerald-600" /> {patient.phone}
                  </span>
                )}
                {patient.email && <span>• {patient.email}</span>}
                {(patient.age || patient.gender) && (
                  <span>
                    • {[patient.age && `${patient.age} yrs`, patient.gender].filter(Boolean).join(", ")}
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
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                    <Phone className="size-3.5" /> Call
                  </Button>
                </a>
                <a href={waUrl} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                    <MessageCircle className="size-3.5" /> WhatsApp
                  </Button>
                </a>
              </>
            )}
            <Link to="/dashboard/consult">
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold shadow-xs">
                <Stethoscope className="size-3.5" /> Consult
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        
        {/* Left Column: Appointments & History */}
        <div className="space-y-4 lg:col-span-1">
          <Card className="p-4 sm:p-5 border-border/80 shadow-xs">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                <Calendar className="size-4 text-primary" /> Appointments ({appointments.length})
              </h3>
              <Link to="/dashboard/appointments">
                <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-primary">
                  View all
                </Button>
              </Link>
            </div>
            {appointments.length === 0 ? (
              <p className="text-xs text-muted-foreground p-4 text-center border border-dashed rounded-lg">
                No appointments recorded.
              </p>
            ) : (
              <div className="space-y-2.5">
                {appointments.map((a) => {
                  const d = new Date(a.scheduled_at);
                  const isOnline = a.appointment_type === "online";
                  return (
                    <div key={a.id} className="text-xs p-3 border rounded-xl bg-muted/20 border-border/70 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-foreground">
                          {d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <StatusBadge status={a.status as any} />
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" /> {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
                        <span className="flex items-center gap-1">
                          {isOnline ? <Video className="size-3 text-purple-600" /> : <MapPin className="size-3 text-emerald-600" />}
                          {isOnline ? "Video" : "Clinic"}
                        </span>
                      </div>
                      {a.problem && <p className="text-[11px] text-muted-foreground italic mt-1">{a.problem}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: EMR Clinical Visits (Complaints, Diagnosis, Treatment) */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-4 sm:p-5 border-border/80 shadow-xs">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
                <FileText className="size-4 text-primary" /> Clinical Records & EMR ({emrVisits.length})
              </h3>
              <Link to="/dashboard/prescriptions">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <Plus className="size-3" /> New Rx
                </Button>
              </Link>
            </div>
            {emrVisits.length === 0 ? (
              <div className="p-8 text-center border rounded-xl bg-muted/10 border-dashed space-y-2">
                <FileText className="size-8 mx-auto text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">No clinical records found</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Create prescriptions and SOAP notes from the Consultation module to record patient history.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {emrVisits.map((v) => {
                  const visitDate = v.created_at || v.visit_date;
                  return (
                    <div key={v.id} className="border rounded-xl p-4 space-y-3 hover:border-primary/40 transition-colors bg-card border-border/80 shadow-xs">
                      <div className="flex flex-wrap justify-between items-start gap-2 border-b border-border/60 pb-2.5">
                        <div>
                          <div className="font-bold text-foreground text-sm sm:text-base">
                            {visitDate ? new Date(visitDate).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "long", day: "numeric" }) : "Consultation"}
                          </div>
                          {v.follow_up_date && (
                            <div className="text-xs text-amber-600 dark:text-amber-500 font-medium mt-0.5">
                              Follow-up: {new Date(v.follow_up_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className="font-semibold text-[10px] bg-primary/5 text-primary border-primary/20">
                          Consultation Visit
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {v.chief_complaint && (
                          <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">Chief Complaint</div>
                            <p className="text-xs text-foreground bg-muted/20 p-2 rounded-lg border border-border/60">{v.chief_complaint}</p>
                          </div>
                        )}
                        
                        {v.diagnosis && (
                          <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">Diagnosis</div>
                            <p className="text-xs font-semibold text-primary bg-primary/5 p-2 rounded-lg border border-primary/20">{v.diagnosis}</p>
                          </div>
                        )}

                        {v.treatment_plan && (
                          <div className="sm:col-span-2">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">Treatment Plan & Rx</div>
                            <p className="text-xs text-foreground whitespace-pre-wrap bg-muted/30 p-2.5 rounded-lg border border-border/60 leading-relaxed font-mono">{v.treatment_plan}</p>
                          </div>
                        )}

                        {(v.examination || v.history || v.notes) && (
                          <div className="sm:col-span-2">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">Clinical Examination & Notes</div>
                            <p className="text-xs text-foreground italic opacity-85 bg-muted/10 p-2 rounded-lg">{v.examination || v.history || v.notes}</p>
                          </div>
                        )}
                      </div>

                      {/* Vitals Summary */}
                      {(v.bp || v.bp_systolic || v.pulse || v.pulse_bpm || v.temperature || v.temperature_c || v.spo2_percent || v.weight || v.weight_kg) && (
                        <div className="pt-2.5 mt-2 border-t border-border/60">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1.5">Vitals</div>
                          <div className="flex flex-wrap gap-1.5 text-xs font-mono">
                            {(v.bp || (v.bp_systolic && v.bp_diastolic)) && (
                              <span className="bg-muted px-2 py-0.5 rounded border">BP: {v.bp || `${v.bp_systolic}/${v.bp_diastolic}`}</span>
                            )}
                            {(v.pulse || v.pulse_bpm) && (
                              <span className="bg-muted px-2 py-0.5 rounded border">Pulse: {v.pulse || v.pulse_bpm} bpm</span>
                            )}
                            {(v.temperature || v.temperature_c) && (
                              <span className="bg-muted px-2 py-0.5 rounded border">Temp: {v.temperature || v.temperature_c}°C</span>
                            )}
                            {v.spo2_percent && <span className="bg-muted px-2 py-0.5 rounded border">SpO2: {v.spo2_percent}%</span>}
                            {(v.weight || v.weight_kg) && (
                              <span className="bg-muted px-2 py-0.5 rounded border">Weight: {v.weight || v.weight_kg}kg</span>
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
      </div>
    </div>
  );
}
