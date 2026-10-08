-- Existing documented_override provenance is made explicit and atomic, not a
-- fake payment or a second/extended trial. Historical rows are not rewritten.
CREATE TABLE public.clinicx_admin_overrides (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
 subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE RESTRICT,
 plan_id text NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 500),
 starts_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 CHECK(expires_at>starts_at AND expires_at<=starts_at+interval '720 hours')
);
ALTER TABLE public.clinicx_admin_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinicx_admin_overrides FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS documented_override_id uuid REFERENCES public.clinicx_admin_overrides(id) ON DELETE RESTRICT;

CREATE FUNCTION public.clinicx_admin_documented_override(p_org uuid,p_plan text,p_expires timestamptz,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public SET timezone='UTC' AS $$
DECLARE s public.subscriptions; v_id uuid; v_actor uuid:=auth.uid(); v_start timestamptz:=now();
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=v_actor AND role::text='super_admin') THEN
  RAISE EXCEPTION 'Super Admin documented authority required' USING ERRCODE='42501'; END IF;
 IF p_org IS NULL OR p_plan IS NULL OR p_plan NOT IN ('starter','growth','professional','enterprise') OR
   p_expires IS NULL OR p_expires<=v_start OR p_expires>v_start+interval '720 hours' OR
   p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 10 AND 500 THEN
  RAISE EXCEPTION 'Documented reason and expiry within 30 days required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-billing:'||p_org,0));
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=p_org FOR UPDATE;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Existing subscription required' USING ERRCODE='P0002'; END IF;
 -- Do not disguise a paid period, live mandate or uncertain provider operation.
 IF (s.access_source='verified_payment' AND s.current_period_end>v_start) OR
 EXISTS(SELECT 1 FROM public.clinicx_checkout_attempts WHERE organization_id=p_org
  AND (state IN ('creating','pending','needs_reconciliation') OR
    (provider_subscription_id IS NOT NULL AND provider_terminal_at IS NULL AND state='settled'))) OR
 EXISTS(SELECT 1 FROM public.clinicx_recurring_commands WHERE organization_id=p_org AND state IN ('reserved','uncertain','scheduled')) THEN
  RAISE EXCEPTION 'Resolve existing provider authority before a documented exception' USING ERRCODE='55000'; END IF;
 INSERT INTO public.clinicx_admin_overrides(organization_id,subscription_id,plan_id,actor_id,reason,starts_at,expires_at)
 VALUES(p_org,s.id,p_plan,v_actor,trim(p_reason),v_start,p_expires) RETURNING id INTO v_id;
 INSERT INTO public.subscription_events(organization_id,subscription_id,event_key,kind,actor_id,effective_at,details)
 VALUES(p_org,s.id,'override:'||v_id,'documented_override',v_actor,v_start,
  jsonb_build_object('override_id',v_id,'reason',trim(p_reason),'plan_id',p_plan,'expires_at',p_expires,'not_a_payment',true));
 UPDATE public.subscriptions SET access_source='documented_override',documented_override_id=v_id,
 plan_id=p_plan,status='active',current_period_start=v_start,current_period_end=p_expires,
 recovery_ends_at=NULL WHERE id=s.id;
 RETURN jsonb_build_object('success',true,'override_id',v_id,'expires_at',p_expires);
END $$;
REVOKE ALL ON FUNCTION public.clinicx_admin_documented_override(uuid,text,timestamptz,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.clinicx_admin_documented_override(uuid,text,timestamptz,text) TO authenticated;

-- Deferred because legitimate atomic provisioning writes the trial claim AFTER
-- subscription insertion, and settlement writes the completed receipt AFTER its
-- effective subscription update. No GUC/client-supplied flag is an authority.
CREATE FUNCTION public.clinicx_subscription_provenance_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.subscriptions; o public.clinicx_admin_overrides; v_recovery integer;
BEGIN
 SELECT * INTO s FROM public.subscriptions WHERE id=NEW.id;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Subscription history cannot be deleted' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' AND s.access_source='legacy_unverified' THEN
  IF OLD.access_source IS DISTINCT FROM s.access_source OR
   ROW(s.plan_id,s.billing_cycle,s.current_period_start,s.current_period_end,s.recovery_ends_at,s.gateway,s.gateway_subscription_id,s.razorpay_subscription_id)
   IS DISTINCT FROM ROW(OLD.plan_id,OLD.billing_cycle,OLD.current_period_start,OLD.current_period_end,OLD.recovery_ends_at,OLD.gateway,OLD.gateway_subscription_id,OLD.razorpay_subscription_id) OR
   (s.status IS DISTINCT FROM OLD.status AND s.status::text NOT IN ('expired','suspended')) THEN
   RAISE EXCEPTION 'Legacy access cannot acquire new financial authority' USING ERRCODE='42501'; END IF;
  RETURN NULL;
 END IF;
 IF s.access_source='free_trial' THEN
  IF s.trial_started_at IS NULL OR s.trial_ends_at IS NULL OR s.grace_ends_at IS NULL OR
   s.trial_ends_at IS DISTINCT FROM s.trial_started_at+interval '720 hours' OR
   s.grace_ends_at IS DISTINCT FROM s.trial_ends_at+interval '168 hours' OR
   s.current_period_start IS DISTINCT FROM s.trial_started_at OR s.current_period_end IS DISTINCT FROM s.trial_ends_at OR
   s.plan_id IS DISTINCT FROM 'growth' OR s.status::text NOT IN ('trialing','trial_expired','grace_period','suspended') OR
   s.recovery_ends_at IS NOT NULL OR s.gateway_subscription_id IS NOT NULL OR s.razorpay_subscription_id IS NOT NULL OR
   NOT EXISTS(SELECT 1 FROM public.clinicx_trial_claims c JOIN public.organization_members m ON m.organization_id=c.organization_id AND m.user_id=c.owner_id AND m.role='owner'
    WHERE c.organization_id=s.organization_id) THEN
   RAISE EXCEPTION 'Invalid immutable free trial provenance/state/period' USING ERRCODE='42501'; END IF;
 ELSIF s.access_source='verified_payment' THEN
  IF s.status::text NOT IN ('active','past_due','cancelled','expired','suspended') OR s.gateway IS DISTINCT FROM 'razorpay' OR
   s.razorpay_subscription_id IS DISTINCT FROM s.gateway_subscription_id OR
   NOT EXISTS(SELECT 1 FROM public.clinicx_admin_canonical_payments p WHERE p.subscription_id=s.id AND p.organization_id=s.organization_id
    AND p.plan_id=s.plan_id AND p.billing_cycle=s.billing_cycle AND p.provider_subscription_id=s.gateway_subscription_id
    AND p.period_start=s.current_period_start AND p.period_end=s.current_period_end) THEN
   RAISE EXCEPTION 'Paid authority requires matching completed canonical settlement' USING ERRCODE='42501'; END IF;
  SELECT recovery_hours INTO v_recovery FROM public.clinicx_billing_policy WHERE singleton;
  IF s.recovery_ends_at IS NOT NULL AND (s.recovery_ends_at>s.current_period_end+make_interval(hours=>v_recovery) OR s.recovery_ends_at<=s.current_period_end OR s.status::text NOT IN ('past_due','cancelled','expired','suspended')) THEN
   RAISE EXCEPTION 'Invalid payment recovery authority' USING ERRCODE='42501'; END IF;
 ELSIF s.access_source='documented_override' THEN
  SELECT * INTO o FROM public.clinicx_admin_overrides WHERE id=s.documented_override_id;
  IF o.id IS NULL OR o.organization_id IS DISTINCT FROM s.organization_id OR o.subscription_id IS DISTINCT FROM s.id OR
    o.plan_id IS DISTINCT FROM s.plan_id OR o.starts_at IS DISTINCT FROM s.current_period_start OR o.expires_at IS DISTINCT FROM s.current_period_end OR
    s.status::text NOT IN ('active','expired','suspended') OR s.recovery_ends_at IS NOT NULL OR
    NOT EXISTS(SELECT 1 FROM public.subscription_events e WHERE e.subscription_id=s.id AND e.event_key='override:'||o.id
      AND e.kind='documented_override' AND e.actor_id=o.actor_id AND e.details->>'reason'=o.reason) THEN
   RAISE EXCEPTION 'Explicit audited expiring override authority required' USING ERRCODE='42501'; END IF;
 ELSE RAISE EXCEPTION 'New subscription authority cannot be legacy or unknown' USING ERRCODE='42501';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER clinicx_subscription_provenance AFTER INSERT OR UPDATE ON public.subscriptions
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.clinicx_subscription_provenance_guard();
REVOKE ALL ON FUNCTION public.clinicx_subscription_provenance_guard() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.clinicx_immutable_override() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Documented authority audit is immutable' USING ERRCODE='42501'; END $$;
CREATE TRIGGER clinicx_immutable_override BEFORE UPDATE OR DELETE ON public.clinicx_admin_overrides
 FOR EACH ROW EXECUTE FUNCTION public.clinicx_immutable_override();
CREATE FUNCTION public.clinicx_protect_documented_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.kind='documented_override' OR (TG_OP='UPDATE' AND NEW.kind='documented_override') THEN
  RAISE EXCEPTION 'Documented authority audit is immutable' USING ERRCODE='42501'; END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER clinicx_protect_documented_event BEFORE UPDATE OR DELETE ON public.subscription_events
 FOR EACH ROW EXECUTE FUNCTION public.clinicx_protect_documented_event();
REVOKE ALL ON FUNCTION public.clinicx_immutable_override(),public.clinicx_protect_documented_event() FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
