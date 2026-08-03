
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS domain_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS domain_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS domain_last_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS domain_last_error text;

CREATE UNIQUE INDEX IF NOT EXISTS clinics_custom_domain_unique
  ON public.clinics (lower(custom_domain))
  WHERE custom_domain IS NOT NULL AND custom_domain <> '';
