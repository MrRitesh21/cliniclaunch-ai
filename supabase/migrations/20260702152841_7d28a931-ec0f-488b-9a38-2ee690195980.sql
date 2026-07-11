ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- Grandfather existing clinics (created more than a minute ago) as already published
UPDATE public.clinics
SET is_published = true,
    published_at = COALESCE(published_at, now())
WHERE is_published = false
  AND created_at < now() - interval '1 minute';