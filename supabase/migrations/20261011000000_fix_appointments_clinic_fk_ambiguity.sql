-- Fix: PostgREST error
--   "Could not embed because more than one relationship was found for 'appointments' and 'clinics'"
--
-- Root cause: the live database has MORE THAN ONE foreign key from public.appointments
-- to public.clinics. PostgREST cannot decide which FK the bare clinics(...) embed should
-- use, so every confirm/status-change on appointments (updateAppointmentStatus,
-- getConsultAppointment) fails.
--
-- This migration:
--   1) Ensures the canonical FK (appointments_clinic_id_fkey ON clinic_id) exists.
--   2) Drops TRUE duplicates: other FK constraints on the SAME column (clinic_id)
--      pointing to clinics(id) under a different constraint name.
--      FKs on *different* columns are deliberately KEPT (data integrity) — the app
--      now disambiguates via the explicit hint clinics!appointments_clinic_id_fkey.
--   3) Reloads the PostgREST schema cache.
--
-- Safe + idempotent: can be re-run any time.

-- ---------------------------------------------------------------------------
-- STEP 0 (informational): list every FK from appointments -> clinics.
-- Expected healthy result: exactly ONE row -> appointments_clinic_id_fkey / clinic_id
-- ---------------------------------------------------------------------------
SELECT
  con.conname  AS constraint_name,
  a.attname    AS column_name
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
JOIN pg_class ref ON ref.oid = con.confrelid
WHERE con.contype = 'f'
  AND rel.relname = 'appointments'
  AND ref.relname = 'clinics'
ORDER BY con.conname;

-- ---------------------------------------------------------------------------
-- STEP 1: ensure canonical FK exists, drop true duplicates (same column).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  dup RECORD;
  canonical_exists BOOLEAN;
  clinic_id_nullable BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointments_clinic_id_fkey'
      AND conrelid = 'public.appointments'::regclass
      AND contype = 'f'
  ) INTO canonical_exists;

  IF NOT canonical_exists THEN
    SELECT NOT attnotnull INTO clinic_id_nullable
    FROM pg_attribute
    WHERE attrelid = 'public.appointments'::regclass AND attname = 'clinic_id';

    IF clinic_id_nullable THEN
      EXECUTE 'ALTER TABLE public.appointments
               ADD CONSTRAINT appointments_clinic_id_fkey
               FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE SET NULL';
    ELSE
      EXECUTE 'ALTER TABLE public.appointments
               ADD CONSTRAINT appointments_clinic_id_fkey
               FOREIGN KEY (clinic_id) REFERENCES public.clinics(id) ON DELETE CASCADE';
    END IF;
    RAISE NOTICE 'Added canonical FK appointments_clinic_id_fkey';
  ELSE
    RAISE NOTICE 'Canonical FK appointments_clinic_id_fkey already present';
  END IF;

  FOR dup IN
    SELECT DISTINCT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
    JOIN pg_class ref ON ref.oid = con.confrelid
    WHERE con.contype = 'f'
      AND rel.relname = 'appointments'
      AND ref.relname = 'clinics'
      AND con.conname <> 'appointments_clinic_id_fkey'
      AND a.attname = 'clinic_id'
  LOOP
    EXECUTE format('ALTER TABLE public.appointments DROP CONSTRAINT %I', dup.conname);
    RAISE NOTICE 'Dropped duplicate FK on clinic_id -> clinics: %', dup.conname;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- STEP 2: make PostgREST pick up the corrected schema immediately.
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
