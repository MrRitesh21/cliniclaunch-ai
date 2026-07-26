-- ============================================================
-- MODULE: Patient records / EMR
--
-- Per-visit clinical record: complaint, vitals, diagnosis,
-- treatment plan and file attachments, forming a timeline per
-- patient. Extends the existing `crm` patients table rather
-- than duplicating demographics.
--
-- NOTE: this table holds health data. Access is org-members-only
-- via is_org_member() and there is deliberately NO anon grant —
-- unlike appointments, nothing here is ever read by a public page.
-- ============================================================

CREATE TABLE public.patient_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Kept even if the patient record is deleted, so a visit is never
  -- orphaned mid-treatment; patient_name is denormalised for that case.
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name text NOT NULL,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,

  chief_complaint text,
  diagnosis text,
  treatment_plan text,
  notes text,
  follow_up_date date,

  -- Vitals are recorded per visit, so they live on the visit row.
  -- numeric (not int) because weight/temperature are fractional.
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  bp_systolic int,
  bp_diastolic int,
  pulse_bpm int,
  temperature_c numeric(4,1),
  spo2_percent int,
  blood_sugar_mgdl int,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_visits TO authenticated;
GRANT ALL ON public.patient_visits TO service_role;
ALTER TABLE public.patient_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage patient_visits" ON public.patient_visits
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX patient_visits_org_idx ON public.patient_visits(organization_id, visit_date DESC);
CREATE INDEX patient_visits_patient_idx ON public.patient_visits(patient_id, visit_date DESC);
-- Drives the "follow-ups due" list on the dashboard.
CREATE INDEX patient_visits_followup_idx
  ON public.patient_visits(organization_id, follow_up_date)
  WHERE follow_up_date IS NOT NULL;

CREATE TRIGGER patient_visits_updated_at BEFORE UPDATE ON public.patient_visits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- Attachments (scans, reports, photos) hung off a visit.
-- ------------------------------------------------------------
CREATE TABLE public.patient_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES public.patient_visits(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  kind text NOT NULL DEFAULT 'other'
    CHECK (kind IN ('report','scan','photo','prescription','other')),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_attachments TO authenticated;
GRANT ALL ON public.patient_attachments TO service_role;
ALTER TABLE public.patient_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage patient_attachments" ON public.patient_attachments
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX patient_attachments_visit_idx ON public.patient_attachments(visit_id, created_at DESC);
CREATE INDEX patient_attachments_patient_idx ON public.patient_attachments(patient_id, created_at DESC);

-- ------------------------------------------------------------
-- Catalog + plan wiring. Growth and up — clinical record-keeping
-- is not a starter-tier feature.
-- ------------------------------------------------------------
INSERT INTO public.modules (id, name, description, category, icon, is_core, is_available, min_plan, sort_order)
VALUES ('emr', 'Patient Records (EMR)', 'Visit history, vitals, diagnoses and reports in one patient timeline.', 'Clinical', 'HeartPulse', false, true, 'growth', 45)
ON CONFLICT (id) DO NOTHING;

UPDATE public.plans
SET module_ids = array_append(module_ids, 'emr')
WHERE id IN ('growth', 'professional', 'enterprise')
  AND NOT ('emr' = ANY(module_ids));
