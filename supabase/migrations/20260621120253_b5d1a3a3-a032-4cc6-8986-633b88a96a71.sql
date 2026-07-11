
-- Legacy columns on clinics so existing settings/website UI keeps working
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS custom_domain text UNIQUE,
  ADD COLUMN IF NOT EXISTS domain_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS domain_verified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_clinics_owner ON public.clinics(owner_id);

-- Patient extended fields
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS age text,
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patients_clinic ON public.patients(clinic_id);

-- Appointments legacy fields
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS problem text;

-- Backfill scheduled_at from date + time when present
UPDATE public.appointments
SET scheduled_at = (appointment_date::timestamp + appointment_time::time) AT TIME ZONE 'UTC'
WHERE scheduled_at IS NULL AND appointment_date IS NOT NULL AND appointment_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appts_scheduled ON public.appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appts_clinic ON public.appointments(clinic_id);

-- Clinic domain secrets (used by custom domain UI)
CREATE TABLE IF NOT EXISTS public.clinic_domain_secrets (
  clinic_id uuid PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  verification_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_domain_secrets TO authenticated;
GRANT ALL ON public.clinic_domain_secrets TO service_role;
ALTER TABLE public.clinic_domain_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read domain secret" ON public.clinic_domain_secrets;
CREATE POLICY "members read domain secret" ON public.clinic_domain_secrets
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_id AND public.is_org_member(c.organization_id, auth.uid()))
  );

CREATE OR REPLACE FUNCTION public.create_clinic_domain_secret()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.clinic_domain_secrets (clinic_id) VALUES (NEW.id)
  ON CONFLICT (clinic_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_clinic_domain_secret ON public.clinics;
CREATE TRIGGER trg_clinic_domain_secret
  AFTER INSERT ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.create_clinic_domain_secret();

-- Sync phone/email/address ↔ public_* on insert/update so old UI keeps working
CREATE OR REPLACE FUNCTION public.sync_clinic_legacy_fields()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- old → new
  IF NEW.phone IS NOT NULL AND NEW.public_phone IS NULL THEN NEW.public_phone := NEW.phone; END IF;
  IF NEW.email IS NOT NULL AND NEW.public_email IS NULL THEN NEW.public_email := NEW.email; END IF;
  IF NEW.address IS NOT NULL AND NEW.public_address IS NULL THEN NEW.public_address := NEW.address; END IF;
  -- new → old (mirror back)
  IF NEW.public_phone IS NOT NULL THEN NEW.phone := NEW.public_phone; END IF;
  IF NEW.public_email IS NOT NULL THEN NEW.email := NEW.public_email; END IF;
  IF NEW.public_address IS NOT NULL THEN NEW.address := NEW.public_address; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_clinic_sync_legacy ON public.clinics;
CREATE TRIGGER trg_clinic_sync_legacy
  BEFORE INSERT OR UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.sync_clinic_legacy_fields();
