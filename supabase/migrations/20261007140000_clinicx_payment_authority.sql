-- Forward-only authority. Historical amounts/IDs are NOT rescaled, deduplicated or trusted.
-- Requires subscription authority 130000..130500. Run pricing/provider inventory preflight before release.
CREATE TABLE IF NOT EXISTS public.clinicx_provider_prices (
 plan_id text NOT NULL REFERENCES public.plans(id), billing_cycle public.billing_cycle NOT NULL,
 provider_plan_id text NOT NULL UNIQUE CHECK(provider_plan_id ~ '^plan_[A-Za-z0-9]{1,64}$'),
 amount_paise bigint NOT NULL CHECK(amount_paise>0 AND amount_paise<=2147483647),
 reviewed_at timestamptz NOT NULL, PRIMARY KEY(plan_id,billing_cycle)
);
CREATE TABLE IF NOT EXISTS public.clinicx_checkout_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id), plan_id text NOT NULL REFERENCES public.plans(id),
 billing_cycle public.billing_cycle NOT NULL, provider_plan_id text NOT NULL,
 amount_paise bigint NOT NULL CHECK(amount_paise>0), provider_subscription_id text UNIQUE,
 state text NOT NULL DEFAULT 'creating' CHECK(state IN ('creating','pending','settled','failed','needs_reconciliation')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS clinicx_one_checkout ON public.clinicx_checkout_attempts(organization_id) WHERE state IN ('creating','pending','needs_reconciliation');
ALTER TABLE public.transactions
 ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
 ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE RESTRICT,
 ADD COLUMN IF NOT EXISTS checkout_attempt_id uuid REFERENCES public.clinicx_checkout_attempts(id) ON DELETE RESTRICT,
 ADD COLUMN IF NOT EXISTS canonical_amount_paise bigint CHECK(canonical_amount_paise>0),
 ADD COLUMN IF NOT EXISTS authority_version text,
 ADD COLUMN IF NOT EXISTS provider_invoice_id text;
CREATE UNIQUE INDEX IF NOT EXISTS clinicx_payment_once ON public.transactions(gateway,gateway_payment_id) WHERE authority_version='clinicx-v1';
ALTER TABLE public.invoices
 ADD COLUMN IF NOT EXISTS canonical_payment_id text,
 ADD COLUMN IF NOT EXISTS canonical_amount_paise bigint CHECK(canonical_amount_paise>0),
 ADD COLUMN IF NOT EXISTS authority_version text;
CREATE UNIQUE INDEX IF NOT EXISTS clinicx_invoice_payment_once ON public.invoices(canonical_payment_id) WHERE authority_version='clinicx-v1';
CREATE UNIQUE INDEX IF NOT EXISTS clinicx_provider_invoice_once ON public.invoices(razorpay_invoice_id) WHERE authority_version='clinicx-v1';
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS completed_at timestamptz, ADD COLUMN IF NOT EXISTS authority_version text;
ALTER TABLE public.clinicx_provider_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinicx_checkout_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinicx_provider_prices,public.clinicx_checkout_attempts,public.webhook_events FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.transactions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.clinicx_provider_prices,public.clinicx_checkout_attempts,public.transactions,public.invoices,public.webhook_events TO service_role;

-- Caller-token RPC establishes verified membership, serializes checkout and freezes canonical quote.
CREATE FUNCTION public.clinicx_begin_checkout(p_org uuid,p_plan text,p_cycle text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_price public.clinicx_provider_prices; v_plan public.plans; v_attempt public.clinicx_checkout_attempts;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_org_role(p_org,auth.uid(),ARRAY['owner','admin']::public.org_role[]) THEN
  RAISE EXCEPTION 'Billing owner/admin required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-billing:'||p_org,0));
 IF p_cycle NOT IN ('monthly','yearly') THEN RAISE EXCEPTION 'Invalid billing cycle' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_plan FROM public.plans WHERE id=p_plan;
 SELECT * INTO v_price FROM public.clinicx_provider_prices WHERE plan_id=p_plan AND billing_cycle=p_cycle::public.billing_cycle;
 IF v_price.plan_id IS NULL OR v_plan.currency<>'INR' OR
  (CASE WHEN p_cycle='monthly' THEN v_plan.monthly_price ELSE v_plan.yearly_price END)::bigint*100<>v_price.amount_paise OR
  NOT EXISTS(SELECT 1 FROM public.clinicx_pricing_requirements WHERE plan_id=p_plan AND required_monthly_inr=v_plan.monthly_price) THEN
  RAISE EXCEPTION 'Pricing/provider mapping requires reconciliation' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.subscriptions WHERE organization_id=p_org) THEN
  RAISE EXCEPTION 'Subscription authority missing' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_attempt FROM public.clinicx_checkout_attempts WHERE organization_id=p_org AND state IN ('creating','pending','needs_reconciliation');
 IF v_attempt.id IS NOT NULL THEN
  IF v_attempt.actor_id<>auth.uid() OR v_attempt.plan_id<>p_plan OR v_attempt.billing_cycle::text<>p_cycle OR
    v_attempt.state<>'pending' THEN RAISE EXCEPTION 'Checkout already reserved; reconcile before retry' USING ERRCODE='55000'; END IF;
  RETURN to_jsonb(v_attempt); END IF;
 IF EXISTS(SELECT 1 FROM public.subscriptions WHERE organization_id=p_org AND access_source='verified_payment'
   AND gateway_subscription_id IS NOT NULL AND status IN ('active','past_due') AND cancel_at_period_end IS NOT TRUE) THEN
  RAISE EXCEPTION 'Cancel the existing mandate at cycle end before replacing it; paid-through access is retained' USING ERRCODE='55000'; END IF;
 INSERT INTO public.clinicx_checkout_attempts(organization_id,actor_id,plan_id,billing_cycle,provider_plan_id,amount_paise)
 VALUES(p_org,auth.uid(),p_plan,p_cycle::public.billing_cycle,v_price.provider_plan_id,v_price.amount_paise) RETURNING * INTO v_attempt;
 RETURN to_jsonb(v_attempt);
END $$;
CREATE FUNCTION public.clinicx_bind_checkout(p_attempt uuid,p_actor uuid,p_subscription text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.clinicx_checkout_attempts;
BEGIN
 IF p_subscription IS NULL OR p_subscription !~ '^sub_[A-Za-z0-9]{1,64}$' THEN RAISE EXCEPTION 'Invalid subscription ID'; END IF;
 SELECT * INTO a FROM public.clinicx_checkout_attempts WHERE id=p_attempt AND actor_id=p_actor FOR UPDATE;
 IF a.id IS NULL OR a.state NOT IN ('creating','pending') OR (a.provider_subscription_id IS NOT NULL AND a.provider_subscription_id<>p_subscription) THEN RAISE EXCEPTION 'Invalid checkout binding'; END IF;
 UPDATE public.clinicx_checkout_attempts SET provider_subscription_id=p_subscription,state='pending',updated_at=now() WHERE id=a.id RETURNING * INTO a;
 RETURN to_jsonb(a);
END $$;

-- Service-only verified-evidence command. Receipt + ledger + invoice + effective authority commit together.
CREATE FUNCTION public.clinicx_settle_payment(p_event text,p_evidence jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public SET timezone='UTC' AS $$
DECLARE a public.clinicx_checkout_attempts; s public.subscriptions; t public.transactions;
 v_payment text:=p_evidence->>'payment_id'; v_invoice text:=p_evidence->>'invoice_id'; v_start timestamptz; v_end timestamptz;
BEGIN
 IF p_event IS NULL OR length(p_event) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid event ID'; END IF;
 SELECT * INTO a FROM public.clinicx_checkout_attempts WHERE provider_subscription_id=p_evidence->>'subscription_id';
 IF a.id IS NULL THEN RAISE EXCEPTION 'Unbound provider subscription' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-billing:'||a.organization_id,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-payment:'||v_payment,0));
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=a.organization_id FOR UPDATE;
 IF p_evidence IS NULL OR NOT (p_evidence ?& ARRAY['payment_id','subscription_id','provider_plan_id','invoice_id','amount_paise','currency','status','period_start','period_end']) OR
  p_evidence->>'status' IS DISTINCT FROM 'captured' OR p_evidence->>'currency' IS DISTINCT FROM 'INR' OR
  p_evidence->>'provider_plan_id' IS DISTINCT FROM a.provider_plan_id OR (p_evidence->>'amount_paise')::bigint IS DISTINCT FROM a.amount_paise OR
  v_payment IS NULL OR v_payment !~ '^pay_[A-Za-z0-9]{1,64}$' OR v_invoice IS NULL OR v_invoice !~ '^inv_[A-Za-z0-9]{1,64}$' THEN
  RAISE EXCEPTION 'Canonical captured evidence mismatch' USING ERRCODE='22023'; END IF;
 v_start:=to_timestamp((p_evidence->>'period_start')::bigint); v_end:=to_timestamp((p_evidence->>'period_end')::bigint);
 IF v_start IS NULL OR v_end IS NULL OR v_end<=v_start OR v_start>now()+interval '1 day' OR v_end>now()+interval '400 days' THEN RAISE EXCEPTION 'Invalid paid period'; END IF;
 SELECT * INTO t FROM public.transactions WHERE gateway='razorpay' AND gateway_payment_id=v_payment AND authority_version='clinicx-v1';
 IF t.id IS NOT NULL THEN
  IF t.organization_id<>a.organization_id OR t.checkout_attempt_id<>a.id OR t.canonical_amount_paise<>a.amount_paise OR t.provider_invoice_id<>v_invoice THEN RAISE EXCEPTION 'Payment already bound elsewhere'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM public.transactions WHERE gateway_payment_id=v_payment OR razorpay_payment_id=v_payment) OR
    EXISTS(SELECT 1 FROM public.invoices WHERE razorpay_invoice_id=v_invoice) THEN RAISE EXCEPTION 'Historical payment/invoice requires reconciliation'; END IF;
  INSERT INTO public.transactions(organization_id,subscription_id,checkout_attempt_id,amount,canonical_amount_paise,currency,status,gateway,gateway_payment_id,razorpay_payment_id,plan,billing_cycle,authority_version,provider_invoice_id)
   VALUES(a.organization_id,s.id,a.id,a.amount_paise,a.amount_paise,'INR','captured','razorpay',v_payment,v_payment,a.plan_id,a.billing_cycle,'clinicx-v1',v_invoice);
  INSERT INTO public.invoices(organization_id,subscription_id,amount,canonical_amount_paise,currency,status,invoice_number,razorpay_invoice_id,canonical_payment_id,authority_version)
   VALUES(a.organization_id,s.id,a.amount_paise,a.amount_paise,'INR','paid','RZP-'||v_payment,v_invoice,v_payment,'clinicx-v1');
  -- Stale historical payments and old replaced mandates cannot overwrite newer entitlements.
  IF (a.state='pending' AND (s.access_source<>'verified_payment' OR v_start>=s.current_period_start)) OR
    (a.state='settled' AND s.gateway_subscription_id=a.provider_subscription_id AND v_end>coalesce(s.current_period_end,'epoch')) THEN
   UPDATE public.subscriptions SET plan_id=a.plan_id,billing_cycle=a.billing_cycle,status='active',access_source='verified_payment',gateway='razorpay',
    gateway_subscription_id=a.provider_subscription_id,razorpay_subscription_id=a.provider_subscription_id,
    current_period_start=v_start,current_period_end=v_end,recovery_ends_at=NULL,
    cancel_at_period_end=CASE WHEN s.gateway_subscription_id=a.provider_subscription_id THEN s.cancel_at_period_end ELSE false END WHERE id=s.id;
  END IF;
  UPDATE public.clinicx_checkout_attempts SET state='settled',updated_at=now() WHERE id=a.id;
  INSERT INTO public.subscription_events(organization_id,subscription_id,event_key,kind,effective_at,details)
   VALUES(a.organization_id,s.id,'payment:'||v_payment,'payment_success',v_start,jsonb_build_object('payment_id',v_payment,'amount_paise',a.amount_paise));
 END IF;
 IF EXISTS(SELECT 1 FROM public.webhook_events WHERE id=p_event AND authority_version='clinicx-v1' AND payload IS DISTINCT FROM p_evidence) THEN RAISE EXCEPTION 'Event evidence conflict'; END IF;
 INSERT INTO public.webhook_events(id,provider,event_type,payload,completed_at,authority_version) VALUES(p_event,'razorpay','captured',p_evidence,now(),'clinicx-v1')
 ON CONFLICT(id) DO UPDATE SET completed_at=EXCLUDED.completed_at,payload=EXCLUDED.payload,authority_version=EXCLUDED.authority_version,event_type=EXCLUDED.event_type;
 RETURN jsonb_build_object('success',true,'deduped',t.id IS NOT NULL,'organization_id',a.organization_id);
END $$;
REVOKE ALL ON FUNCTION public.clinicx_begin_checkout(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clinicx_begin_checkout(uuid,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.clinicx_bind_checkout(uuid,uuid,text),public.clinicx_settle_payment(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_bind_checkout(uuid,uuid,text),public.clinicx_settle_payment(text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
