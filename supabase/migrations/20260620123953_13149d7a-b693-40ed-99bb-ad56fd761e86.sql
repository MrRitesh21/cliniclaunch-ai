
-- 1) Private secrets table for domain verification tokens
CREATE TABLE IF NOT EXISTS public.clinic_domain_secrets (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  domain_verification_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_domain_secrets TO authenticated;
GRANT ALL ON public.clinic_domain_secrets TO service_role;

ALTER TABLE public.clinic_domain_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner read clinic_domain_secrets" ON public.clinic_domain_secrets
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_domain_secrets.clinic_id AND c.owner_id = auth.uid()));

CREATE POLICY "owner insert clinic_domain_secrets" ON public.clinic_domain_secrets
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_domain_secrets.clinic_id AND c.owner_id = auth.uid()));

CREATE POLICY "owner update clinic_domain_secrets" ON public.clinic_domain_secrets
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_domain_secrets.clinic_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_domain_secrets.clinic_id AND c.owner_id = auth.uid()));

CREATE TRIGGER trg_clinic_domain_secrets_updated_at
BEFORE UPDATE ON public.clinic_domain_secrets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Backfill from existing column
INSERT INTO public.clinic_domain_secrets (clinic_id, domain_verification_token)
SELECT id, domain_verification_token FROM public.clinics
ON CONFLICT (clinic_id) DO NOTHING;

-- 3) Auto-create a secret row whenever a new clinic is created
CREATE OR REPLACE FUNCTION public.create_clinic_domain_secret()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clinic_domain_secrets (clinic_id) VALUES (NEW.id)
  ON CONFLICT (clinic_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_clinic_domain_secret() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_clinics_create_secret
AFTER INSERT ON public.clinics
FOR EACH ROW EXECUTE FUNCTION public.create_clinic_domain_secret();

-- 4) Drop the column from clinics
ALTER TABLE public.clinics DROP COLUMN IF EXISTS domain_verification_token;

-- 5) Tighten public INSERT policies to require a real clinic_id
DROP POLICY IF EXISTS "public book appointment" ON public.appointments;
CREATE POLICY "public book appointment" ON public.appointments
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_id)
    AND length(btrim(patient_name)) > 0
    AND length(btrim(patient_phone)) > 0
    AND scheduled_at > now() - interval '1 day'
  );

DROP POLICY IF EXISTS "public upsert patient" ON public.patients;
CREATE POLICY "public upsert patient" ON public.patients
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_id)
    AND length(btrim(name)) > 0
    AND length(btrim(phone)) > 0
  );

DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.leads;
CREATE POLICY "Anyone can submit a lead" ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_id)
    AND length(btrim(name)) > 0
  );
