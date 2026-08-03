-- ============================================================
-- MODULE: AI Assistant — route enablement
--
-- `ai_assistant` has been in the catalog since 20260621120020:212
-- but never had a dashboard route, so an enterprise customer could
-- install it and land on nothing. This adds the storage its route
-- needs and opens it to professional as well as enterprise.
-- ============================================================

CREATE TABLE public.ai_assistant_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  kind text NOT NULL
    CHECK (kind IN ('triage','visit_summary','patient_message','content')),
  prompt text NOT NULL,
  output text NOT NULL,
  -- Free-form context echoed back in the UI (e.g. which visit was summarised).
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_assistant_runs TO authenticated;
GRANT ALL ON public.ai_assistant_runs TO service_role;
ALTER TABLE public.ai_assistant_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage ai_assistant_runs" ON public.ai_assistant_runs
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX ai_assistant_runs_org_idx
  ON public.ai_assistant_runs(organization_id, created_at DESC);
-- Supports the per-org daily rate-limit count.
CREATE INDEX ai_assistant_runs_ratelimit_idx
  ON public.ai_assistant_runs(organization_id, created_at);

-- Professional tier and up. The module row already exists, so only widen
-- availability — do not re-insert it.
UPDATE public.modules
SET min_plan = 'professional', is_available = true
WHERE id = 'ai_assistant';

UPDATE public.plans
SET module_ids = array_append(module_ids, 'ai_assistant')
WHERE id IN ('professional', 'enterprise')
  AND NOT ('ai_assistant' = ANY(module_ids));
