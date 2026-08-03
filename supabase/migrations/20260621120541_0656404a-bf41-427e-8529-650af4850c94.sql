
-- Appointments extras
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS patient_age int,
  ADD COLUMN IF NOT EXISTS patient_gender text,
  ADD COLUMN IF NOT EXISTS appointment_type text;

-- Rename verification_token
ALTER TABLE public.clinic_domain_secrets
  RENAME COLUMN verification_token TO domain_verification_token;

-- Backfill clinic_domain_secrets for any clinics missing one
INSERT INTO public.clinic_domain_secrets (clinic_id)
SELECT c.id FROM public.clinics c
LEFT JOIN public.clinic_domain_secrets s ON s.clinic_id = c.id
WHERE s.clinic_id IS NULL;

-- Trigger: auto-fill organization_id from clinic_id for public inserts
CREATE OR REPLACE FUNCTION public.fill_org_from_clinic()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.clinic_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.clinics WHERE id = NEW.clinic_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_appts_fill_org ON public.appointments;
CREATE TRIGGER trg_appts_fill_org
  BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.fill_org_from_clinic();

DROP TRIGGER IF EXISTS trg_leads_fill_org ON public.leads;
CREATE TRIGGER trg_leads_fill_org
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.fill_org_from_clinic();

-- Make organization_id nullable on these tables (trigger fills it; if both null we reject via check)
ALTER TABLE public.appointments ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE public.leads ALTER COLUMN organization_id DROP NOT NULL;

-- Re-enforce: at least one must be set after trigger
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_org_required;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_org_required CHECK (organization_id IS NOT NULL);
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_org_required;
ALTER TABLE public.leads ADD CONSTRAINT leads_org_required CHECK (organization_id IS NOT NULL);
