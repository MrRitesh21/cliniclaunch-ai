ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS section_order jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS section_hidden jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS section_content jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS seo_config jsonb DEFAULT '{}'::jsonb;