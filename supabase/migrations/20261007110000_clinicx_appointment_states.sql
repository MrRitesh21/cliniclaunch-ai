-- Forward-only clinical states used by check-in and consultation workflows.
-- Keep enum additions in their own migration/transaction; commit this migration
-- before any later migration or application statement uses the new values.
-- Existing labels, enum identity, appointment rows and defaults are preserved.
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'waiting';
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'serving';
