-- Product baseline is a configurable reconciliation target, NOT a provider quote.
-- Existing plans/provider IDs are left untouched until authorized live inventory.
CREATE TABLE public.clinicx_pricing_requirements (
 plan_id text PRIMARY KEY REFERENCES public.plans(id),
 required_monthly_inr integer NOT NULL CHECK(required_monthly_inr>0),
 preferred_yearly_inr integer NOT NULL CHECK(preferred_yearly_inr>0),
 currency text NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 is_popular boolean NOT NULL DEFAULT false,
 policy_version text NOT NULL DEFAULT 'clinicx-owner-v1'
);
INSERT INTO public.clinicx_pricing_requirements(plan_id,required_monthly_inr,preferred_yearly_inr,is_popular) VALUES
 ('starter',999,9990,false),('growth',2999,29990,true),('professional',8599,85990,false),('enterprise',19999,199990,false);
ALTER TABLE public.clinicx_pricing_requirements ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.clinicx_pricing_requirements TO authenticated,anon;
GRANT ALL ON public.clinicx_pricing_requirements TO service_role;
CREATE POLICY clinicx_requirements_read ON public.clinicx_pricing_requirements FOR SELECT USING(true);
CREATE FUNCTION public.clinicx_pricing_preflight() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('requires_live_provider_reconciliation',true,'automatically_rewrites_prices',false,
   'plans',coalesce(jsonb_agg(jsonb_build_object('plan_id',r.plan_id,
     'required_monthly_inr',r.required_monthly_inr,'preferred_yearly_inr',r.preferred_yearly_inr,
     'configured_monthly_inr',p.monthly_price,'configured_yearly_inr',p.yearly_price,
     'configured_currency',p.currency,'monthly_matches',p.monthly_price=r.required_monthly_inr AND p.currency=r.currency,
     'yearly_matches_preference',p.yearly_price=r.preferred_yearly_inr AND p.currency=r.currency,
     'is_popular_required',r.is_popular,'policy_version',r.policy_version) ORDER BY p.sort_order),'[]'))
 FROM public.clinicx_pricing_requirements r JOIN public.plans p ON p.id=r.plan_id
$$;
REVOKE ALL ON FUNCTION public.clinicx_pricing_preflight() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_pricing_preflight() TO service_role;
NOTIFY pgrst, 'reload schema';
