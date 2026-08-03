-- Google Business Profile link storage
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS google_business_profile_url text,
  ADD COLUMN IF NOT EXISTS google_business_profile_connected_at timestamptz;

-- WhatsApp automation tracking
ALTER TABLE public.whatsapp_logs
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS automation_key text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_org_scheduled_for
  ON public.whatsapp_logs (organization_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status_scheduled_for
  ON public.whatsapp_logs (status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_appointment_template
  ON public.whatsapp_logs (appointment_id, template_key);

-- Required Data API grants for existing public tables
GRANT SELECT ON public.organizations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;

GRANT SELECT ON public.clinics TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinics TO authenticated;
GRANT ALL ON public.clinics TO service_role;

GRANT INSERT ON public.appointments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;
GRANT ALL ON public.whatsapp_templates TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_logs TO authenticated;
GRANT ALL ON public.whatsapp_logs TO service_role;

-- Ensure appointment rows inherit the clinic organization before RLS checks.
CREATE OR REPLACE FUNCTION public.fill_appointment_org_from_clinic()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.clinic_id IS NOT NULL THEN
    SELECT c.organization_id INTO NEW.organization_id
    FROM public.clinics c
    WHERE c.id = NEW.clinic_id;
  END IF;

  IF NEW.appointment_type IS NULL THEN
    NEW.appointment_type := 'offline';
  END IF;

  IF NEW.source IS NULL THEN
    NEW.source := 'booking';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fill_appointment_org_from_clinic_trigger ON public.appointments;
CREATE TRIGGER fill_appointment_org_from_clinic_trigger
  BEFORE INSERT OR UPDATE OF clinic_id, organization_id, appointment_type, source
  ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_appointment_org_from_clinic();

-- Keep patient organization aligned too, because patient upserts run after public bookings.
CREATE OR REPLACE FUNCTION public.fill_patient_org_from_clinic()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.clinic_id IS NOT NULL THEN
    SELECT c.organization_id INTO NEW.organization_id
    FROM public.clinics c
    WHERE c.id = NEW.clinic_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fill_patient_org_from_clinic_trigger ON public.patients;
CREATE TRIGGER fill_patient_org_from_clinic_trigger
  BEFORE INSERT OR UPDATE OF clinic_id, organization_id
  ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_patient_org_from_clinic();

-- Recreate explicit public appointment insert policy.
DROP POLICY IF EXISTS appointments_public_insert ON public.appointments;
CREATE POLICY appointments_public_insert
ON public.appointments
FOR INSERT
TO anon, authenticated
WITH CHECK (
  clinic_id IS NOT NULL
  AND organization_id IS NOT NULL
  AND scheduled_at IS NOT NULL
  AND patient_name IS NOT NULL
  AND COALESCE(patient_name, '') <> ''
);

-- Allow logged-in clinic members to manage their org's Google profile fields through existing org membership.
DROP POLICY IF EXISTS "members read organizations" ON public.organizations;
CREATE POLICY "members read organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (public.is_org_member(id, auth.uid()));