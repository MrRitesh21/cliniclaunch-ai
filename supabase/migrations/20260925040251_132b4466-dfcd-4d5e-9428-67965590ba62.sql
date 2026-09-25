CREATE TABLE public.organization_module_overrides (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  reason text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, module_id)
);
GRANT SELECT ON public.organization_module_overrides TO authenticated;
GRANT ALL ON public.organization_module_overrides TO service_role;
ALTER TABLE public.organization_module_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own org module overrides" ON public.organization_module_overrides
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()) OR public.is_admin(auth.uid()));
CREATE TRIGGER trg_omo_updated_at BEFORE UPDATE ON public.organization_module_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();