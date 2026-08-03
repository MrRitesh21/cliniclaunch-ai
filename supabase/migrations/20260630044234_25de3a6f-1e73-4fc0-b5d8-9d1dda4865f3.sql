ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS wa_linked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS wa_session_id text;