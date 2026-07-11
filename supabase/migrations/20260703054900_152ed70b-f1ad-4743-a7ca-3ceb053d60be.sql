
-- 1. Doctors table
CREATE TABLE IF NOT EXISTS public.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  specialization text,
  qualification text,
  experience_years integer DEFAULT 0,
  consultation_fee numeric DEFAULT 0,
  avatar_url text,
  bio text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.doctors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctors TO authenticated;
GRANT ALL ON public.doctors TO service_role;

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active doctors" ON public.doctors;
CREATE POLICY "Public can read active doctors" ON public.doctors
  FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "Org members manage doctors" ON public.doctors;
CREATE POLICY "Org members manage doctors" ON public.doctors
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS doctors_org_idx ON public.doctors(organization_id);
CREATE INDEX IF NOT EXISTS doctors_clinic_idx ON public.doctors(clinic_id);

CREATE TRIGGER doctors_set_updated_at
  BEFORE UPDATE ON public.doctors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Link appointments to a specific doctor
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS appointments_doctor_idx ON public.appointments(doctor_id);
