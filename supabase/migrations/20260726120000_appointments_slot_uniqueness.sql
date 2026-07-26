-- Close the double-booking TOCTOU race in createBooking (CLIAA-25 / CLIAA-43).
-- The app's slot check and insert are two separate autocommit requests, so
-- under concurrency every racing request sees "slot free" and inserts.
-- Enforce uniqueness where it can actually hold: in the database.
--   1. appointments_slot_uq        — partial unique index for standard bookings
--   2. enforce_walkin_slot_cap()   — advisory-lock trigger for the walk-in cap

-- 0. Pre-flight: refuse to run if double-booked slots already exist.
-- Cancelling a real patient's appointment is a clinic decision, not a
-- migration's — surface the conflicts and abort instead.
DO $$
DECLARE
  conflict record;
  found boolean := false;
BEGIN
  FOR conflict IN
    SELECT clinic_id,
           coalesce(doctor_id, '00000000-0000-0000-0000-000000000000'::uuid) AS doctor_key,
           scheduled_at,
           count(*) AS n
    FROM public.appointments
    WHERE status <> 'cancelled'
      AND coalesce(source, 'booking') <> 'walkin'
      AND clinic_id IS NOT NULL
      AND scheduled_at IS NOT NULL
    GROUP BY 1, 2, 3
    HAVING count(*) > 1
  LOOP
    found := true;
    RAISE WARNING 'double-booked slot: clinic=% doctor=% slot=% (% rows)',
      conflict.clinic_id, conflict.doctor_key, conflict.scheduled_at, conflict.n;
  END LOOP;
  IF found THEN
    RAISE EXCEPTION 'appointments_slot_uniqueness: existing double-booked slots must be resolved by the clinic before this migration can run (see warnings above)';
  END IF;
END $$;

-- 1. Standard bookings: at most one active appointment per (clinic, doctor, slot).
-- coalesce() folds NULL doctor_id (owner/legacy clinics) into a sentinel so those
-- rows are protected too — NULLs never collide in a plain unique index.
-- Walk-ins are excluded: they may share a slot with a standard booking and are
-- capped by the trigger below instead.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_slot_uq
  ON public.appointments (
    clinic_id,
    (coalesce(doctor_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    scheduled_at
  )
  WHERE status <> 'cancelled'
    AND coalesce(source, 'booking') <> 'walkin'
    AND clinic_id IS NOT NULL
    AND scheduled_at IS NOT NULL;

-- 2. Walk-ins: a per-slot cap cannot be expressed as a unique index. Serialize
-- competing inserts for the same slot on an advisory xact lock so the capacity
-- count is taken under exclusive access. Raises with ERRCODE 23505 so the app
-- has a single error path for "slot taken".
CREATE OR REPLACE FUNCTION public.enforce_walkin_slot_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  cap int;
  taken int;
BEGIN
  IF coalesce(NEW.source, 'booking') <> 'walkin'
     OR NEW.clinic_id IS NULL
     OR NEW.scheduled_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT walkin_max_per_slot INTO cap FROM public.clinics WHERE id = NEW.clinic_id;
  cap := coalesce(cap, 3);

  -- One lock per (clinic, doctor, slot) key; released at transaction end.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      NEW.clinic_id::text || '|' ||
      coalesce(NEW.doctor_id::text, '-') || '|' ||
      NEW.scheduled_at::text,
      0
    )
  );

  -- Mirrors the app's capacity query in createBooking: every non-cancelled
  -- appointment in the slot counts against the cap, scoped per doctor when
  -- one is selected and to doctor-less rows otherwise.
  SELECT count(*) INTO taken
  FROM public.appointments
  WHERE clinic_id = NEW.clinic_id
    AND scheduled_at = NEW.scheduled_at
    AND status <> 'cancelled'
    AND (
      (NEW.doctor_id IS NULL AND doctor_id IS NULL)
      OR doctor_id = NEW.doctor_id
    );

  IF taken >= cap THEN
    RAISE EXCEPTION 'walkin_slot_full'
      USING ERRCODE = '23505',
            DETAIL = format('slot %s at clinic %s already has %s appointments (cap %s)',
                            NEW.scheduled_at, NEW.clinic_id, taken, cap);
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_enforce_walkin_slot_cap ON public.appointments;
CREATE TRIGGER trg_enforce_walkin_slot_cap
  BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_walkin_slot_cap();
