-- Add medical registration number column to clinics
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS medical_registration_no TEXT;
