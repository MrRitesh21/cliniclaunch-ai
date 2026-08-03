CREATE TABLE IF NOT EXISTS public.marketing_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL DEFAULT '',
  discount_type text NOT NULL DEFAULT 'flat',
  discount_value integer NOT NULL DEFAULT 0,
  min_spend integer NOT NULL DEFAULT 0,
  valid_until date,
  usage_count integer NOT NULL DEFAULT 0,
  max_usage integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_coupons TO authenticated;
GRANT ALL ON public.marketing_coupons TO service_role;

ALTER TABLE public.marketing_coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members manage marketing coupons" ON public.marketing_coupons;
CREATE POLICY "org members manage marketing coupons"
  ON public.marketing_coupons FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

DROP TRIGGER IF EXISTS marketing_coupons_updated_at ON public.marketing_coupons;
CREATE TRIGGER marketing_coupons_updated_at
  BEFORE UPDATE ON public.marketing_coupons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS marketing_settings jsonb NOT NULL DEFAULT '{}'::jsonb;