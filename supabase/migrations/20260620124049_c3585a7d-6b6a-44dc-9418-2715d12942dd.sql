
CREATE OR REPLACE FUNCTION public.clinic_exists(_clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.clinics WHERE id = _clinic_id)
$$;

REVOKE EXECUTE ON FUNCTION public.clinic_exists(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clinic_exists(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "public book appointment" ON public.appointments;
CREATE POLICY "public book appointment" ON public.appointments
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.clinic_exists(clinic_id)
    AND length(btrim(patient_name)) > 0
    AND length(btrim(patient_phone)) > 0
    AND scheduled_at > now() - interval '1 day'
  );

DROP POLICY IF EXISTS "public upsert patient" ON public.patients;
CREATE POLICY "public upsert patient" ON public.patients
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.clinic_exists(clinic_id)
    AND length(btrim(name)) > 0
    AND length(btrim(phone)) > 0
  );

DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.leads;
CREATE POLICY "Anyone can submit a lead" ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.clinic_exists(clinic_id)
    AND length(btrim(name)) > 0
  );
