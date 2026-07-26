-- Booking slot integrity: move slot uniqueness from the application layer into
-- the database. createBooking previously did a check-then-insert across two
-- round-trips, so concurrent requests could both pass the check and both insert.

-- Abort before changing anything if the table already holds double-booked slots.
-- Cancelling or deleting a patient's existing appointment is a clinic decision,
-- not a migration's, so surface the conflicts and let a human resolve them.
DO $$
DECLARE
  dupes text;
BEGIN
  SELECT string_agg(
           format('clinic=%s doctor=%s slot=%s count=%s', clinic_id, doctor_id, scheduled_at, n),
           E'\n'
         )
    INTO dupes
  FROM (
    SELECT clinic_id,
           coalesce(doctor_id, '00000000-0000-0000-0000-000000000000'::uuid) AS doctor_id,
           scheduled_at,
           count(*) AS n
    FROM public.appointments
    WHERE status <> 'cancelled'
      AND coalesce(source, 'booking') <> 'walkin'
    GROUP BY 1, 2, 3
    HAVING count(*) > 1
  ) d;

  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION E'Cannot add appointments_slot_uq: existing double-booked slots must be resolved first.\n%', dupes;
  END IF;
END $$;

-- doctor_id is nullable (owner-only and legacy clinics), and NULLs never collide
-- in a plain unique index, so collapse NULL to a sentinel.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_slot_uq
  ON public.appointments (
    clinic_id,
    (coalesce(doctor_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    scheduled_at
  )
  WHERE status <> 'cancelled'
    AND coalesce(source, 'booking') <> 'walkin';

-- Walk-ins allow several patients per slot up to clinics.walkin_max_per_slot,
-- which no unique index can express. Serialize inserts competing for the same
-- slot on a transaction-scoped advisory lock so the count is taken under
-- exclusive access; the lock releases on commit.
CREATE OR REPLACE FUNCTION public.enforce_walkin_slot_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  max_per_slot int;
  taken int;
  slot_doctor uuid := coalesce(NEW.doctor_id, '00000000-0000-0000-0000-000000000000'::uuid);
BEGIN
  IF coalesce(NEW.source, 'booking') <> 'walkin' OR NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.clinic_id::text || ':' || slot_doctor::text || ':' || NEW.scheduled_at::text, 0)
  );

  SELECT c.walkin_max_per_slot INTO max_per_slot
  FROM public.clinics c
  WHERE c.id = NEW.clinic_id;
  max_per_slot := coalesce(max_per_slot, 3);

  SELECT count(*) INTO taken
  FROM public.appointments a
  WHERE a.clinic_id = NEW.clinic_id
    AND a.scheduled_at = NEW.scheduled_at
    AND coalesce(a.doctor_id, '00000000-0000-0000-0000-000000000000'::uuid) = slot_doctor
    AND a.status <> 'cancelled';

  IF taken >= max_per_slot THEN
    RAISE EXCEPTION 'walkin_slot_full' USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

-- BEFORE triggers fire in name order, so this runs ahead of
-- fill_appointment_org_from_clinic_trigger and cannot rely on its source
-- defaulting -- hence the coalesce on NEW.source above.
DROP TRIGGER IF EXISTS enforce_walkin_slot_cap_trigger ON public.appointments;
CREATE TRIGGER enforce_walkin_slot_cap_trigger
  BEFORE INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_walkin_slot_cap();
