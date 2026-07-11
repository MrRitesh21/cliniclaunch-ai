GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT INSERT, UPDATE ON public.patients TO anon;
GRANT ALL ON public.patients TO service_role;
-- Backfill patients from existing appointments
INSERT INTO public.patients (clinic_id, name, phone, email, age, gender)
SELECT DISTINCT ON (clinic_id, patient_phone)
  clinic_id, patient_name, patient_phone, patient_email, patient_age, patient_gender
FROM public.appointments
WHERE patient_phone IS NOT NULL
ORDER BY clinic_id, patient_phone, created_at DESC
ON CONFLICT (clinic_id, phone) DO NOTHING;