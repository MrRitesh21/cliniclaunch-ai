
-- Replace WITH CHECK (true) on public INSERT policies with minimal validity checks

DROP POLICY IF EXISTS "public book appointment" ON public.appointments;
CREATE POLICY "public book appointment" ON public.appointments
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    clinic_id IS NOT NULL
    AND length(btrim(patient_name)) > 0
    AND length(btrim(patient_phone)) > 0
    AND scheduled_at > now() - interval '1 day'
  );

DROP POLICY IF EXISTS "public upsert patient" ON public.patients;
CREATE POLICY "public upsert patient" ON public.patients
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    clinic_id IS NOT NULL
    AND length(btrim(name)) > 0
    AND length(btrim(phone)) > 0
  );

DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.leads;
CREATE POLICY "Anyone can submit a lead" ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    clinic_id IS NOT NULL
    AND length(btrim(name)) > 0
  );
