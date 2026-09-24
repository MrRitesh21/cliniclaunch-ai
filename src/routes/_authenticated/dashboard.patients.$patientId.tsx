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
import { ArrowLeft, Phone, Calendar, HeartPulse, FileText, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

          // Fetch EMR visits
          const { data: visitData } = await supabase
            .from("patient_visits" as any)
            .select("*")
            .or(`organization_id.eq.${orgId},clinic_id.eq.${clinic.id}`)
            .eq("patient_id", patientData.id)
            .order("visit_date", { ascending: false });

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

            // Fetch EMR visits by name since ID might not match
            const { data: visitData } = await supabase
              .from("patient_visits" as any)
              .select("*")
              .or(`organization_id.eq.${orgId},clinic_id.eq.${clinic.id}`)
              .eq("patient_name", first.patient_name)
              .order("visit_date", { ascending: false });

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

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <Link
        to="/dashboard/patients"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4 mr-1" /> Back to Directory
      </Link>

      {/* Header Profile Card */}
      <Card className="p-6 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 bg-primary/5 rounded-bl-3xl">
          <HeartPulse className="size-16 text-primary/20" />
        </div>
        <div className="flex items-start gap-4">
          <AvatarInitials name={patient.name} className="size-16 text-xl rounded-xl" />
          <div className="space-y-1">
            <h1 className="text-2xl font-bold font-display">{patient.name}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1"><Phone className="size-3" /> {patient.phone}</span>
              {patient.email && <span>· {patient.email}</span>}
              {patient.age && <span>· {patient.age} yrs</span>}
              {patient.gender && <span className="capitalize">· {patient.gender}</span>}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Appointments & Quick Stats */}
        <div className="space-y-6 md:col-span-1">
          <Card className="p-5">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
              <Calendar className="size-4" /> Appointments ({appointments.length})
            </h3>
            {appointments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No appointments recorded.</p>
            ) : (
              <div className="space-y-3">
                {appointments.map((a) => (
                  <div key={a.id} className="text-sm p-3 border rounded-lg bg-muted/20">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-foreground">
                        {new Date(a.scheduled_at).toLocaleDateString()}
                      </span>
                      <StatusBadge status={a.status as any} />
                    </div>
                    {a.problem && <p className="text-xs text-muted-foreground mt-1">{a.problem}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: EMR Clinical Visits (Complaints, Diagnosis, etc.) */}
        <div className="space-y-6 md:col-span-2">
          <Card className="p-5">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
              <FileText className="size-4" /> Clinical Records & EMR ({emrVisits.length})
            </h3>
            {emrVisits.length === 0 ? (
              <p className="text-sm text-muted-foreground p-8 text-center border rounded-lg bg-muted/10 border-dashed">
                No clinical records found for this patient.
              </p>
            ) : (
              <div className="space-y-4">
                {emrVisits.map((v) => (
                  <div key={v.id} className="border rounded-xl p-4 space-y-3 hover:border-primary/30 transition-colors bg-card">
                    <div className="flex flex-wrap justify-between items-start gap-2 border-b pb-3">
                      <div>
                        <div className="font-semibold text-foreground text-base">
                          {new Date(v.visit_date).toLocaleDateString("en-US", { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                        {v.follow_up_date && (
                          <div className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                            Follow-up: {new Date(v.follow_up_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <Badge variant="secondary" className="font-normal text-xs">
                        Clinical Visit
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {v.chief_complaint && (
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Chief Complaint</div>
                          <p className="text-sm text-foreground">{v.chief_complaint}</p>
                        </div>
                      )}
                      
                      {v.diagnosis && (
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Diagnosis</div>
                          <p className="text-sm font-medium text-primary">{v.diagnosis}</p>
                        </div>
                      )}

                      {v.treatment_plan && (
                        <div className="sm:col-span-2">
                          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Treatment Plan & Rx</div>
                          <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 p-2 rounded-md border">{v.treatment_plan}</p>
                        </div>
                      )}

                      {v.notes && (
                        <div className="sm:col-span-2">
                          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Internal Notes</div>
                          <p className="text-sm text-foreground italic opacity-80">{v.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Vitals Summary */}
                    {(v.bp_systolic || v.pulse_bpm || v.temperature_c || v.spo2_percent || v.weight_kg) && (
                      <div className="pt-3 mt-3 border-t">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Vitals Recorded</div>
                        <div className="flex flex-wrap gap-2 text-xs font-mono">
                          {v.bp_systolic && v.bp_diastolic && <span className="bg-muted px-2 py-1 rounded">BP: {v.bp_systolic}/{v.bp_diastolic}</span>}
                          {v.pulse_bpm && <span className="bg-muted px-2 py-1 rounded">Pulse: {v.pulse_bpm}</span>}
                          {v.temperature_c && <span className="bg-muted px-2 py-1 rounded">Temp: {v.temperature_c}°C</span>}
                          {v.spo2_percent && <span className="bg-muted px-2 py-1 rounded">SpO2: {v.spo2_percent}%</span>}
                          {v.weight_kg && <span className="bg-muted px-2 py-1 rounded">Weight: {v.weight_kg}kg</span>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
