-- Serialized provider commands: reservation is durable, uncertain outcomes never auto-replay.
CREATE TABLE public.clinicx_recurring_commands (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id), provider_subscription_id text NOT NULL REFERENCES public.clinicx_checkout_attempts(provider_subscription_id),
 kind text NOT NULL CHECK(kind IN ('change','cancel','resume')),
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','uncertain','scheduled','applied','confirmed','aborted','superseded')),
 plan_id text NOT NULL REFERENCES public.plans(id),billing_cycle public.billing_cycle NOT NULL,
 provider_plan_id text NOT NULL,previous_provider_plan_id text NOT NULL,amount_paise bigint NOT NULL CHECK(amount_paise>0),
 paid_through timestamptz NOT NULL,effective_at timestamptz,reason text CHECK(reason IS NULL OR length(reason)<=500),
 provider_evidence jsonb,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX clinicx_one_recurring_command ON public.clinicx_recurring_commands(organization_id) WHERE state IN ('reserved','uncertain');
CREATE UNIQUE INDEX clinicx_one_scheduled_change ON public.clinicx_recurring_commands(organization_id) WHERE state='scheduled';
ALTER TABLE public.clinicx_recurring_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinicx_recurring_commands FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.clinicx_recurring_commands TO service_role;
CREATE FUNCTION public.clinicx_reserve_recurring(p_org uuid,p_kind text,p_plan text DEFAULT NULL,p_cycle text DEFAULT NULL,p_reason text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.subscriptions; a public.clinicx_checkout_attempts; q public.clinicx_provider_prices; c public.clinicx_recurring_commands; v_plan public.plans; v_previous text;
BEGIN
 PERFORM public.clinicx_billing_current(p_org);
 IF p_kind IS NULL OR p_kind NOT IN ('change','cancel','resume') OR (p_reason IS NOT NULL AND length(p_reason)>500) THEN RAISE EXCEPTION 'Invalid recurring command'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-billing:'||p_org,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-admission:'||p_org,0));
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=p_org FOR UPDATE;
 SELECT * INTO a FROM public.clinicx_checkout_attempts WHERE provider_subscription_id=s.gateway_subscription_id;
 IF a.id IS NULL OR s.access_source IS DISTINCT FROM 'verified_payment' OR s.current_period_end IS NULL THEN RAISE EXCEPTION 'Verified recurring subscription required'; END IF;
 IF EXISTS(SELECT 1 FROM public.clinicx_checkout_attempts WHERE organization_id=p_org AND state IN ('creating','pending','needs_reconciliation')) OR
 EXISTS(SELECT 1 FROM public.clinicx_recurring_commands WHERE organization_id=p_org AND (state IN ('reserved','uncertain') OR (state='scheduled' AND p_kind<>'cancel'))) THEN
  RAISE EXCEPTION 'Recurring operation pending; read-only reconciliation required before another command' USING ERRCODE='55000'; END IF;
 SELECT provider_plan_id INTO v_previous FROM public.clinicx_recurring_commands WHERE provider_subscription_id=a.provider_subscription_id AND kind='change' AND state='applied' ORDER BY effective_at DESC LIMIT 1;
 v_previous:=coalesce(v_previous,a.provider_plan_id);
 IF p_kind='change' THEN
  IF s.cancel_at_period_end IS TRUE OR s.status<>'active' OR s.current_period_end<=now() THEN RAISE EXCEPTION 'Only a current uncancelled paid subscription can change plan'; END IF;
  IF p_plan IS NULL OR p_cycle IS NULL OR p_cycle NOT IN ('monthly','yearly') OR (p_plan=s.plan_id AND p_cycle=s.billing_cycle::text) THEN RAISE EXCEPTION 'Invalid or unchanged target'; END IF;
  IF NOT (public.clinicx_plan_capacity(p_org,p_plan)->>'allowed')::boolean THEN RAISE EXCEPTION 'Target plan over capacity; resolve usage before scheduling; no data deleted' USING ERRCODE='23514'; END IF;
  SELECT * INTO q FROM public.clinicx_provider_prices WHERE plan_id=p_plan AND billing_cycle::text=p_cycle;
  SELECT * INTO v_plan FROM public.plans WHERE id=p_plan;
  IF q.plan_id IS NULL OR v_plan.currency IS DISTINCT FROM 'INR' OR (CASE WHEN p_cycle='monthly' THEN v_plan.monthly_price ELSE v_plan.yearly_price END)::bigint*100 IS DISTINCT FROM q.amount_paise OR
   NOT EXISTS(SELECT 1 FROM public.clinicx_pricing_requirements WHERE plan_id=p_plan AND required_monthly_inr=v_plan.monthly_price) THEN RAISE EXCEPTION 'Pricing/provider mapping requires reconciliation'; END IF;
 ELSE
  SELECT * INTO c FROM public.clinicx_recurring_commands WHERE provider_subscription_id=a.provider_subscription_id AND kind='change' AND state='applied' ORDER BY effective_at DESC LIMIT 1;
  q.plan_id:=coalesce(c.plan_id,a.plan_id);q.billing_cycle:=coalesce(c.billing_cycle,a.billing_cycle);
  q.provider_plan_id:=coalesce(c.provider_plan_id,a.provider_plan_id);q.amount_paise:=coalesce(c.amount_paise,a.amount_paise);
 END IF;
 INSERT INTO public.clinicx_recurring_commands(organization_id,actor_id,provider_subscription_id,kind,plan_id,billing_cycle,provider_plan_id,previous_provider_plan_id,amount_paise,paid_through,reason)
 VALUES(p_org,auth.uid(),a.provider_subscription_id,p_kind,q.plan_id,q.billing_cycle,q.provider_plan_id,v_previous,q.amount_paise,s.current_period_end,nullif(btrim(p_reason),'')) RETURNING * INTO c;
 INSERT INTO public.subscription_events(organization_id,subscription_id,event_key,kind,actor_id,effective_at,details)
 VALUES(p_org,s.id,'command-reserved:'||c.id,'recurring_command_reserved',auth.uid(),now(),jsonb_build_object('command_id',c.id,'kind',p_kind,'plan_id',c.plan_id,'billing_cycle',c.billing_cycle,'amount_paise',c.amount_paise));
 RETURN to_jsonb(c);
END $$;
CREATE FUNCTION public.clinicx_recurring_command_context(p_org uuid,p_command uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.clinicx_recurring_commands;
BEGIN
 PERFORM public.clinicx_billing_current(p_org);
 SELECT * INTO c FROM public.clinicx_recurring_commands WHERE id=p_command AND organization_id=p_org AND actor_id=auth.uid();
 IF c.id IS NULL THEN RAISE EXCEPTION 'Command actor/tenant binding required' USING ERRCODE='42501'; END IF;
 RETURN to_jsonb(c);
END $$;
CREATE FUNCTION public.clinicx_recurring_command_state(p_command uuid,p_actor uuid,p_state text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.clinicx_recurring_commands;s public.subscriptions;
BEGIN
 SELECT * INTO c FROM public.clinicx_recurring_commands WHERE id=p_command AND actor_id=p_actor FOR UPDATE;
 IF c.id IS NULL OR p_state IS NULL OR p_state NOT IN ('aborted','uncertain') OR c.state NOT IN ('reserved','uncertain') THEN RAISE EXCEPTION 'Invalid command state'; END IF;
 UPDATE public.clinicx_recurring_commands SET state=p_state,updated_at=now() WHERE id=c.id RETURNING * INTO c;
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=c.organization_id;
 INSERT INTO public.subscription_events(organization_id,subscription_id,event_key,kind,actor_id,effective_at,details)
 VALUES(c.organization_id,s.id,'command-'||p_state||':'||c.id,'recurring_command_'||p_state,p_actor,now(),jsonb_build_object('command_id',c.id)) ON CONFLICT(subscription_id,event_key) DO NOTHING;
 RETURN to_jsonb(c);
END $$;
REVOKE ALL ON FUNCTION public.clinicx_reserve_recurring(uuid,text,text,text,text),public.clinicx_recurring_command_context(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clinicx_reserve_recurring(uuid,text,text,text,text),public.clinicx_recurring_command_context(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.clinicx_recurring_command_state(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_recurring_command_state(uuid,uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';
