
ALTER TABLE public.appointments ALTER COLUMN appointment_date DROP NOT NULL;
ALTER TABLE public.appointments ALTER COLUMN appointment_time DROP NOT NULL;

ALTER TABLE public.patients ALTER COLUMN organization_id DROP NOT NULL;
DROP TRIGGER IF EXISTS trg_patients_fill_org ON public.patients;
CREATE TRIGGER trg_patients_fill_org
  BEFORE INSERT ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.fill_org_from_clinic();
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS patients_org_required;
ALTER TABLE public.patients ADD CONSTRAINT patients_org_required CHECK (organization_id IS NOT NULL);

-- Unique constraint for clinic_id+phone (upsert in booking flow)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_patients_clinic_phone ON public.patients(clinic_id, phone) WHERE clinic_id IS NOT NULL AND phone IS NOT NULL;
