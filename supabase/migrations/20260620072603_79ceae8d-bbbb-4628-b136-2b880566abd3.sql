ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS appointment_type text NOT NULL DEFAULT 'offline'
  CHECK (appointment_type IN ('online', 'offline'));