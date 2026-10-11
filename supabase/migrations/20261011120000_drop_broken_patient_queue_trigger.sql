-- Fix: "relation \"public.patient_queue\" does not exist" on appointment status change
--
-- Root cause: trigger trg_sync_appointment_queue on public.appointments calls
-- sync_appointment_to_queue() which UPDATEs public.patient_queue — a table that
-- has NEVER existed in this schema (the queue module uses queue_tokens).
-- The trigger fired on every status change to 'completed' (the "Done" button)
-- and failed the whole transaction.
--
-- The application already syncs queue_tokens on status changes
-- (src/lib/clinic.functions.ts: updateAppointmentStatus), so this DB trigger
-- is dead code AND broken. Permanent fix: remove both.
--
-- Safe + idempotent.

DROP TRIGGER IF EXISTS trg_sync_appointment_queue ON public.appointments;
DROP FUNCTION IF EXISTS public.sync_appointment_to_queue();

-- Restore tenant-isolation composite FK on appointments -> clinics.
-- (clinicx_tenant_security originally created it; it guarantees an appointment's
-- clinic belongs to the same organization. NOT VALID like the original, so
-- historical rows are not re-validated.)
-- NOTE: run this AFTER the code fix (explicit clinics!appointments_clinic_id_fkey
-- embed hints) is deployed, otherwise the PostgREST embed ambiguity error returns.
CREATE UNIQUE INDEX IF NOT EXISTS clinicx_tenant_key_clinics
  ON public.clinics (organization_id, id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clinicx_tenant_appointments_clinic_id'
      AND conrelid = 'public.appointments'::regclass
      AND contype = 'f'
  ) THEN
    EXECUTE 'ALTER TABLE public.appointments
             ADD CONSTRAINT clinicx_tenant_appointments_clinic_id
             FOREIGN KEY (organization_id, clinic_id)
             REFERENCES public.clinics(organization_id, id)
             NOT VALID';
    RAISE NOTICE 'Restored tenant FK clinicx_tenant_appointments_clinic_id';
  ELSE
    RAISE NOTICE 'Tenant FK clinicx_tenant_appointments_clinic_id already present';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
