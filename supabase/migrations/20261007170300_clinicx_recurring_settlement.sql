-- Invoice-authoritative quote history; the original checkout quote is never mutated by a schedule.
ALTER TABLE public.transactions ADD COLUMN canonical_period_start timestamptz,ADD COLUMN canonical_period_end timestamptz,ADD COLUMN canonical_provider_plan_id text;
ALTER TABLE public.invoices ADD COLUMN canonical_period_start timestamptz,ADD COLUMN canonical_period_end timestamptz,ADD COLUMN canonical_provider_plan_id text,ADD COLUMN canonical_plan_id text,ADD COLUMN canonical_billing_cycle text;
CREATE FUNCTION public.clinicx_charge_quote(p_subscription text,p_start bigint,p_amount bigint) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.clinicx_checkout_attempts;c public.clinicx_recurring_commands;previous public.clinicx_recurring_commands;q jsonb;
BEGIN
 SELECT * INTO a FROM public.clinicx_checkout_attempts WHERE provider_subscription_id=p_subscription;
 IF a.id IS NULL OR p_start IS NULL OR p_start<=0 OR p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'Invalid bound charge quote'; END IF;
 -- Provider documents the boundary update as going live AFTER a charge: at the boundary
 -- accept old OR new full price (never proration), but equal prices are ambiguous and fail closed.
 SELECT * INTO c FROM public.clinicx_recurring_commands WHERE provider_subscription_id=p_subscription AND kind='change' AND state IN ('scheduled','applied','superseded')
  AND effective_at<=to_timestamp(p_start) ORDER BY effective_at DESC,id DESC LIMIT 1;
 IF c.id IS NOT NULL AND c.effective_at=to_timestamp(p_start) THEN
  SELECT * INTO previous FROM public.clinicx_recurring_commands WHERE provider_subscription_id=p_subscription AND kind='change' AND state IN ('scheduled','applied','superseded')
   AND effective_at<to_timestamp(p_start) ORDER BY effective_at DESC,id DESC LIMIT 1;
  IF c.amount_paise=p_amount AND coalesce(previous.amount_paise,a.amount_paise)=p_amount THEN
   RAISE EXCEPTION 'Equal-price boundary invoice quote is ambiguous; explicit provider reconciliation required'; END IF;
  IF c.amount_paise<>p_amount THEN c:=previous; END IF;
 END IF;
 IF c.id IS NOT NULL THEN
  q:=jsonb_build_object('plan_id',c.plan_id,'billing_cycle',c.billing_cycle,'provider_plan_id',c.provider_plan_id,'amount_paise',c.amount_paise,'command_id',c.id);
 ELSE q:=jsonb_build_object('plan_id',a.plan_id,'billing_cycle',a.billing_cycle,'provider_plan_id',a.provider_plan_id,'amount_paise',a.amount_paise,'command_id',NULL); END IF;
 IF (q->>'amount_paise')::bigint IS DISTINCT FROM p_amount THEN RAISE EXCEPTION 'Charge quote mismatch; proration/discount/tax requires explicit reconciliation'; END IF;
 RETURN q;
END $$;
CREATE FUNCTION public.clinicx_known_provider_plan(p_subscription text,p_plan text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p_plan IS NOT NULL AND (EXISTS(SELECT 1 FROM public.clinicx_checkout_attempts WHERE provider_subscription_id=p_subscription AND provider_plan_id=p_plan) OR
 EXISTS(SELECT 1 FROM public.clinicx_recurring_commands WHERE provider_subscription_id=p_subscription AND kind='change' AND state IN ('scheduled','applied','superseded') AND provider_plan_id=p_plan))
$$;
CREATE OR REPLACE FUNCTION public.clinicx_settle_payment(p_event text,p_evidence jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public SET timezone='UTC' AS $$
DECLARE a public.clinicx_checkout_attempts;s public.subscriptions;t public.transactions;q jsonb;
 v_payment text:=p_evidence->>'payment_id';v_invoice text:=p_evidence->>'invoice_id';v_start timestamptz;v_end timestamptz;
BEGIN
 IF p_event IS NULL OR length(p_event) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid event ID'; END IF;
 SELECT * INTO a FROM public.clinicx_checkout_attempts WHERE provider_subscription_id=p_evidence->>'subscription_id';
 IF a.id IS NULL THEN RAISE EXCEPTION 'Unbound provider subscription' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-billing:'||a.organization_id,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-payment:'||v_payment,0));
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=a.organization_id FOR UPDATE;
 IF p_evidence IS NULL OR NOT(p_evidence ?& ARRAY['payment_id','subscription_id','provider_plan_id','invoice_id','amount_paise','currency','status','period_start','period_end']) OR
  p_evidence->>'status' IS DISTINCT FROM 'captured' OR p_evidence->>'currency' IS DISTINCT FROM 'INR' OR
  v_payment IS NULL OR v_payment !~ '^pay_[A-Za-z0-9]{1,64}$' OR v_invoice IS NULL OR v_invoice !~ '^inv_[A-Za-z0-9]{1,64}$' THEN RAISE EXCEPTION 'Canonical captured evidence mismatch' USING ERRCODE='22023'; END IF;
 v_start:=to_timestamp((p_evidence->>'period_start')::bigint);v_end:=to_timestamp((p_evidence->>'period_end')::bigint);
 IF v_start IS NULL OR v_end IS NULL OR v_end<=v_start OR v_start>now()+interval '1 day' OR v_end>now()+interval '400 days' THEN RAISE EXCEPTION 'Invalid paid period'; END IF;
 q:=public.clinicx_charge_quote(a.provider_subscription_id,(p_evidence->>'period_start')::bigint,(p_evidence->>'amount_paise')::bigint);
 IF p_evidence->>'provider_plan_id' IS DISTINCT FROM q->>'provider_plan_id' THEN RAISE EXCEPTION 'Canonical provider plan mismatch'; END IF;
 SELECT * INTO t FROM public.transactions WHERE gateway='razorpay' AND gateway_payment_id=v_payment AND authority_version='clinicx-v1';
 IF t.id IS NOT NULL THEN
  IF t.organization_id IS DISTINCT FROM a.organization_id OR t.checkout_attempt_id IS DISTINCT FROM a.id OR t.canonical_amount_paise IS DISTINCT FROM (q->>'amount_paise')::bigint OR t.provider_invoice_id IS DISTINCT FROM v_invoice OR
   (t.canonical_period_start IS NOT NULL AND t.canonical_period_start IS DISTINCT FROM v_start) OR (t.canonical_period_end IS NOT NULL AND t.canonical_period_end IS DISTINCT FROM v_end) THEN RAISE EXCEPTION 'Payment already bound to different evidence'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM public.transactions WHERE gateway_payment_id=v_payment OR razorpay_payment_id=v_payment) OR EXISTS(SELECT 1 FROM public.invoices WHERE razorpay_invoice_id=v_invoice) THEN RAISE EXCEPTION 'Historical payment/invoice requires reconciliation'; END IF;
  INSERT INTO public.transactions(organization_id,subscription_id,checkout_attempt_id,amount,canonical_amount_paise,currency,status,gateway,gateway_payment_id,razorpay_payment_id,plan,billing_cycle,authority_version,provider_invoice_id,canonical_period_start,canonical_period_end,canonical_provider_plan_id)
  VALUES(a.organization_id,s.id,a.id,(q->>'amount_paise')::bigint,(q->>'amount_paise')::bigint,'INR','captured','razorpay',v_payment,v_payment,q->>'plan_id',q->>'billing_cycle','clinicx-v1',v_invoice,v_start,v_end,q->>'provider_plan_id');
  INSERT INTO public.invoices(organization_id,subscription_id,amount,canonical_amount_paise,currency,status,invoice_number,razorpay_invoice_id,canonical_payment_id,authority_version,paid_at,canonical_period_start,canonical_period_end,canonical_provider_plan_id,canonical_plan_id,canonical_billing_cycle)
  VALUES(a.organization_id,s.id,(q->>'amount_paise')::bigint,(q->>'amount_paise')::bigint,'INR','paid','RZP-'||v_payment,v_invoice,v_payment,'clinicx-v1',now(),v_start,v_end,q->>'provider_plan_id',q->>'plan_id',q->>'billing_cycle');
  IF (a.state='pending' AND (s.access_source<>'verified_payment' OR v_start>=s.current_period_start)) OR
   (a.state='settled' AND s.gateway_subscription_id=a.provider_subscription_id AND v_end>coalesce(s.current_period_end,'epoch')) THEN
   UPDATE public.subscriptions SET plan_id=q->>'plan_id',billing_cycle=(q->>'billing_cycle')::public.billing_cycle,status='active',access_source='verified_payment',gateway='razorpay',
    gateway_subscription_id=a.provider_subscription_id,razorpay_subscription_id=a.provider_subscription_id,current_period_start=v_start,current_period_end=v_end,recovery_ends_at=NULL,
    cancel_at_period_end=CASE WHEN s.gateway_subscription_id=a.provider_subscription_id THEN s.cancel_at_period_end ELSE false END WHERE id=s.id;
   IF q->>'command_id' IS NOT NULL THEN UPDATE public.clinicx_recurring_commands SET state='applied',updated_at=now() WHERE id=(q->>'command_id')::uuid AND state='scheduled'; END IF;
  END IF;
  UPDATE public.clinicx_checkout_attempts SET state='settled',updated_at=now() WHERE id=a.id;
  INSERT INTO public.subscription_events(organization_id,subscription_id,event_key,kind,effective_at,details)
  VALUES(a.organization_id,s.id,'payment:'||v_payment,'payment_success',v_start,jsonb_build_object('payment_id',v_payment,'command_id',q->>'command_id','invoice_id',v_invoice,'amount_paise',(q->>'amount_paise')::bigint,'plan_id',q->>'plan_id','period_start',v_start,'period_end',v_end));
 END IF;
 IF EXISTS(SELECT 1 FROM public.webhook_events WHERE id=p_event AND authority_version='clinicx-v1' AND payload IS DISTINCT FROM p_evidence) THEN RAISE EXCEPTION 'Event evidence conflict'; END IF;
 INSERT INTO public.webhook_events(id,provider,event_type,payload,completed_at,authority_version) VALUES(p_event,'razorpay','captured',p_evidence,now(),'clinicx-v1')
 ON CONFLICT(id) DO UPDATE SET completed_at=EXCLUDED.completed_at,payload=EXCLUDED.payload,authority_version=EXCLUDED.authority_version,event_type=EXCLUDED.event_type;
 RETURN jsonb_build_object('success',true,'deduped',t.id IS NOT NULL,'organization_id',a.organization_id);
END $$;
REVOKE ALL ON FUNCTION public.clinicx_charge_quote(text,bigint,bigint),public.clinicx_known_provider_plan(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_charge_quote(text,bigint,bigint),public.clinicx_known_provider_plan(text,text) TO service_role;
NOTIFY pgrst,'reload schema';
