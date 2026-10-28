-- Migration: 20261023150500_sync_doctor_name_metadata.sql
-- Replaces stale 'Dr. Partner' in clinics copy (hero_subheadline, about_text, bio)
-- and doctors table with the clinic's true doctor_name.

-- 1. Replace 'Dr. Partner' in clinics copy for all clinics where doctor_name != 'Dr. Partner'
UPDATE public.clinics
SET 
  hero_subheadline = REPLACE(hero_subheadline, 'Dr. Partner', doctor_name),
  about_text = REPLACE(about_text, 'Dr. Partner', doctor_name),
  bio = REPLACE(bio, 'Dr. Partner', doctor_name),
  updated_at = now()
WHERE doctor_name IS NOT NULL 
  AND doctor_name != 'Dr. Partner'
  AND (
    hero_subheadline ILIKE '%Dr. Partner%'
    OR about_text ILIKE '%Dr. Partner%'
    OR bio ILIKE '%Dr. Partner%'
  );

-- 2. Update doctors table name to match clinics.doctor_name
UPDATE public.doctors d
SET 
  name = c.doctor_name,
  updated_at = now()
FROM public.clinics c
WHERE (d.organization_id = c.organization_id OR d.clinic_id = c.id)
  AND c.doctor_name IS NOT NULL
  AND c.doctor_name != 'Dr. Partner'
  AND d.name = 'Dr. Partner';

-- 3. Explicitly update ear-to-brain-speech-hearing-clinic-jankipuram-3
UPDATE public.clinics
SET 
  hero_subheadline = REPLACE(hero_subheadline, 'Dr. Partner', doctor_name),
  about_text = REPLACE(about_text, 'Dr. Partner', doctor_name),
  bio = REPLACE(bio, 'Dr. Partner', doctor_name),
  updated_at = now()
WHERE slug = 'ear-to-brain-speech-hearing-clinic-jankipuram-3';

-- 4. Notify PostgREST
NOTIFY pgrst, 'reload schema';
