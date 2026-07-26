-- CLIAA-34: PostgREST upserts emit ON CONFLICT (clinic_id, phone) with no WHERE
-- predicate, so Postgres cannot infer the partial index uniq_patients_clinic_phone
-- and every booking-flow patients upsert fails with 42P10 (silently swallowed).
-- Replace it with a non-partial unique index; default NULLS DISTINCT preserves
-- current behavior for NULL clinic_id/phone rows.

-- Defensive dedupe: keep the newest row per (clinic_id, phone) so the index can build.
DELETE FROM public.patients p
USING public.patients newer
WHERE p.clinic_id = newer.clinic_id
  AND p.phone = newer.phone
  AND p.clinic_id IS NOT NULL
  AND p.phone IS NOT NULL
  AND (newer.created_at, newer.id) > (p.created_at, p.id);

DROP INDEX IF EXISTS public.uniq_patients_clinic_phone;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_patients_clinic_phone
  ON public.patients(clinic_id, phone);
