ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS wa_status text NOT NULL DEFAULT 'disconnected',
  ADD COLUMN IF NOT EXISTS wa_phone text,
  ADD COLUMN IF NOT EXISTS wa_connected_at timestamptz;