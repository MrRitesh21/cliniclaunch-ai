
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS personal_phone text,
  ADD COLUMN IF NOT EXISTS personal_email text,
  ADD COLUMN IF NOT EXISTS public_phone text,
  ADD COLUMN IF NOT EXISTS public_email text,
  ADD COLUMN IF NOT EXISTS public_address text,
  ADD COLUMN IF NOT EXISTS section_variants jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Backfill public_* from existing legacy columns (phone/email/address remain for backwards compat)
UPDATE public.clinics
SET public_phone = COALESCE(public_phone, phone),
    public_email = COALESCE(public_email, email),
    public_address = COALESCE(public_address, address)
WHERE public_phone IS NULL OR public_email IS NULL OR public_address IS NULL;
