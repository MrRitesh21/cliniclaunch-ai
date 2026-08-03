-- ============================================================
-- MODULE: Queue / Token management
--
-- Live OPD token numbers for walk-in-heavy Indian clinics:
-- issue a token, call the next patient, track wait times, and
-- show a "now serving" board in the waiting room.
-- ============================================================

CREATE TABLE public.queue_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  -- Tokens restart at 1 each day, so the day is part of the identity.
  queue_date date NOT NULL DEFAULT CURRENT_DATE,
  token_number int NOT NULL DEFAULT 0,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name text NOT NULL,
  patient_phone text,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','serving','done','skipped')),
  -- Elderly / emergency cases jump the line without renumbering.
  priority boolean NOT NULL DEFAULT false,
  note text,
  called_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.queue_tokens TO authenticated;
GRANT ALL ON public.queue_tokens TO service_role;
ALTER TABLE public.queue_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage queue_tokens" ON public.queue_tokens
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- One token number per org per day.
CREATE UNIQUE INDEX queue_tokens_number_idx
  ON public.queue_tokens(organization_id, queue_date, token_number);
CREATE INDEX queue_tokens_board_idx
  ON public.queue_tokens(organization_id, queue_date, status);

CREATE TRIGGER queue_tokens_updated_at BEFORE UPDATE ON public.queue_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- Token allocation.
--
-- Two receptionists issuing a token at the same instant would
-- otherwise both read the same MAX() and collide on the unique
-- index. The advisory lock is scoped to (org, date) so clinics
-- never block each other, and is released at transaction end.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_queue_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.token_number IS NULL OR NEW.token_number = 0 THEN
    PERFORM pg_advisory_xact_lock(
      hashtext(NEW.organization_id::text || ':' || NEW.queue_date::text)
    );
    SELECT COALESCE(MAX(token_number), 0) + 1
      INTO NEW.token_number
      FROM public.queue_tokens
     WHERE organization_id = NEW.organization_id
       AND queue_date = NEW.queue_date;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER queue_tokens_assign_number BEFORE INSERT ON public.queue_tokens
  FOR EACH ROW EXECUTE FUNCTION public.assign_queue_token();

-- ------------------------------------------------------------
-- Catalog + plan wiring
-- ------------------------------------------------------------
INSERT INTO public.modules (id, name, description, category, icon, is_core, is_available, min_plan, sort_order)
VALUES ('queue', 'Queue & Tokens', 'Live OPD token numbers, wait times and a now-serving board.', 'Operations', 'ListOrdered', false, true, 'starter', 25)
ON CONFLICT (id) DO NOTHING;

UPDATE public.plans
SET module_ids = array_append(module_ids, 'queue')
WHERE id IN ('starter', 'growth', 'professional', 'enterprise')
  AND NOT ('queue' = ANY(module_ids));

-- WhatsApp nudge when a patient is close to being called. Mirrors the
-- per-org seeding used by the walk-in templates in 20260630061634.
INSERT INTO public.whatsapp_templates (organization_id, template_key, name, body, is_active)
SELECT o.id, 'queue_turn_near', 'Queue turn approaching',
       'Hi {patient_name}, you are next at {clinic_name}. Your token is {token_number}. Please reach the clinic now.',
       true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.whatsapp_templates t
  WHERE t.organization_id = o.id AND t.template_key = 'queue_turn_near'
);
