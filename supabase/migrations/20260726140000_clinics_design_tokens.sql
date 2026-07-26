-- Per-clinic design-token overrides layered on top of the chosen template.
-- Same relationship that section_variants has to a template's variants:
-- empty object = use the template's defaults verbatim.
--
-- theme_color stays authoritative for palette.primary while design_tokens is
-- empty, so every already-published site keeps rendering exactly as before.

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS design_tokens jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.clinics.design_tokens IS
  'Partial SiteTokens override (see src/components/site/tokens.ts). Merged over the template preset at render time.';
