
CREATE TABLE IF NOT EXISTS public.subscription_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_reminders_org ON public.subscription_reminders(organization_id, dismissed_at, created_at DESC);

GRANT SELECT, UPDATE ON public.subscription_reminders TO authenticated;
GRANT ALL ON public.subscription_reminders TO service_role;

ALTER TABLE public.subscription_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their reminders"
  ON public.subscription_reminders FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Org owners/admins can dismiss reminders"
  ON public.subscription_reminders FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));
