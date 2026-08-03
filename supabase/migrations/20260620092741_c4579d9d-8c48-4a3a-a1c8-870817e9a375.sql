ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS theme_color text NOT NULL DEFAULT '#2563eb',
  ADD COLUMN IF NOT EXISTS hero_headline text,
  ADD COLUMN IF NOT EXISTS hero_subheadline text,
  ADD COLUMN IF NOT EXISTS about_text text,
  ADD COLUMN IF NOT EXISTS custom_domain text;

CREATE UNIQUE INDEX IF NOT EXISTS clinics_custom_domain_key ON public.clinics (lower(custom_domain)) WHERE custom_domain IS NOT NULL;