-- Four-eyes operator approval for same-price invoice attribution, never a generic bypass.
CREATE TABLE IF NOT EXISTS public.clinicx_recurring_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),command_id uuid NOT NULL REFERENCES public.clinicx_recurring_commands(id),
 payment_id text NOT NULL UNIQUE,invoice_id text NOT NULL UNIQUE,snapshot jsonb NOT NULL,
 old_quote jsonb NOT NULL,target_quote jsonb NOT NULL,quote jsonb,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved')),
 reviewer_id uuid REFERENCES auth.users(id),reason text,evidence_reference text,
 created_at timestamptz NOT NULL DEFAULT now(),approved_at timestamptz,
 CHECK((state='pending' AND reviewer_id IS NULL AND quote IS NULL) OR
       (state='approved' AND reviewer_id IS NOT NULL AND quote IS NOT NULL AND approved_at IS NOT NULL AND length(btrim(reason))>=10 AND length(btrim(evidence_reference))>=5))
);
ALTER TABLE public.clinicx_recurring_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinicx_recurring_reviews FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.clinicx_recovery_fingerprint(p jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,extensions AS $$
 SELECT encode(extensions.digest(jsonb_build_object('command_id',p->'command_id','actor_id',p->'actor_id','organization_id',p->'organization_id',
 'subscription',jsonb_build_object('id',p->'subscription'->'id','plan_id',p->'subscription'->'plan_id','status',p->'subscription'->'status','quantity',p->'subscription'->'quantity','has_scheduled_changes',p->'subscription'->'has_scheduled_changes','offer_id',p->'subscription'->'offer_id'),
 'payment',jsonb_build_object('id',p->'payment'->'id','status',p->'payment'->'status','amount',p->'payment'->'amount','currency',p->'payment'->'currency','invoice_id',p->'payment'->'invoice_id','subscription_id',p->'payment'->'subscription_id'),
 'invoice',jsonb_build_object('id',p->'invoice'->'id','payment_id',p->'invoice'->'payment_id','subscription_id',p->'invoice'->'subscription_id','status',p->'invoice'->'status','amount',p->'invoice'->'amount','currency',p->'invoice'->'currency','billing_start',p->'invoice'->'billing_start','billing_end',p->'invoice'->'billing_end'),
 'plan',p->'plan')::text,'sha256'),'hex');
$$;
CREATE FUNCTION public.clinicx_stage_recurring_review(p_command uuid,p_snapshot jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.clinicx_recurring_commands;a public.clinicx_checkout_attempts;previous public.clinicx_recurring_commands;v jsonb;r public.clinicx_recurring_reviews;
BEGIN
 SELECT * INTO c FROM public.clinicx_recurring_commands WHERE id=p_command;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Unknown command review'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-billing:'||c.organization_id,0));
 v:=public.clinicx_validate_recovery(c.id,p_snapshot);
 IF NOT (v->>'equal_price')::boolean THEN RETURN jsonb_build_object('requires_review',false); END IF;
 SELECT * INTO a FROM public.clinicx_checkout_attempts WHERE provider_subscription_id=c.provider_subscription_id;
 SELECT * INTO previous FROM public.clinicx_recurring_commands WHERE provider_subscription_id=c.provider_subscription_id AND kind='change' AND state IN ('scheduled','applied','superseded') AND id<>c.id AND effective_at<=to_timestamp((p_snapshot->'invoice'->>'billing_start')::bigint) ORDER BY effective_at DESC,id DESC LIMIT 1;
 SELECT * INTO r FROM public.clinicx_recurring_reviews WHERE payment_id=p_snapshot->'payment'->>'id' OR invoice_id=p_snapshot->'invoice'->>'id';
 IF r.id IS NOT NULL THEN
  IF r.command_id<>c.id OR public.clinicx_recovery_fingerprint(r.snapshot) IS DISTINCT FROM public.clinicx_recovery_fingerprint(p_snapshot) THEN RAISE EXCEPTION 'Review evidence conflict'; END IF;
 ELSE
  INSERT INTO public.clinicx_recurring_reviews(command_id,payment_id,invoice_id,snapshot,old_quote,target_quote)
  VALUES(c.id,p_snapshot->'payment'->>'id',p_snapshot->'invoice'->>'id',p_snapshot,
    jsonb_build_object('plan_id',coalesce(previous.plan_id,a.plan_id),'billing_cycle',coalesce(previous.billing_cycle,a.billing_cycle),'provider_plan_id',coalesce(previous.provider_plan_id,a.provider_plan_id),'amount_paise',coalesce(previous.amount_paise,a.amount_paise),'command_id',previous.id),
    jsonb_build_object('plan_id',c.plan_id,'billing_cycle',c.billing_cycle,'provider_plan_id',c.provider_plan_id,'amount_paise',c.amount_paise,'command_id',c.id)) RETURNING * INTO r;
 END IF;
 RETURN jsonb_build_object('requires_review',true,'review_id',r.id,'approved',r.state='approved','selected_quote',r.quote);
END $$;
CREATE FUNCTION public.clinicx_get_recurring_review(p_review uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.clinicx_recurring_reviews;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Platform admin review required' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.clinicx_recurring_reviews WHERE id=p_review;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Unknown review'; END IF;
 RETURN to_jsonb(r);
END $$;
CREATE FUNCTION public.clinicx_approve_recurring_review(p_review uuid,p_provider_plan text,p_reason text,p_evidence_reference text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.clinicx_recurring_reviews;c public.clinicx_recurring_commands;s public.subscriptions;q jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Platform admin review required' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.clinicx_recurring_reviews WHERE id=p_review;
 SELECT * INTO c FROM public.clinicx_recurring_commands WHERE id=r.command_id;
 IF r.id IS NULL OR c.actor_id=auth.uid() THEN RAISE EXCEPTION 'Distinct platform admin reviewer required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-billing:'||c.organization_id,0));
 SELECT * INTO r FROM public.clinicx_recurring_reviews WHERE id=p_review FOR UPDATE;
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=c.organization_id;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 10 AND 500 OR p_evidence_reference IS NULL OR length(btrim(p_evidence_reference)) NOT BETWEEN 5 AND 200 THEN RAISE EXCEPTION 'Independent provider evidence reference and review reason required'; END IF;
 q:=CASE WHEN p_provider_plan=r.target_quote->>'provider_plan_id' THEN r.target_quote WHEN p_provider_plan=r.old_quote->>'provider_plan_id' THEN r.old_quote END;
 IF q IS NULL THEN RAISE EXCEPTION 'Review must select one frozen command invoice quote'; END IF;
 IF r.state='approved' THEN
  IF r.quote IS DISTINCT FROM q THEN RAISE EXCEPTION 'Approved invoice quote is immutable'; END IF;
  RETURN to_jsonb(r);
 END IF;
 UPDATE public.clinicx_recurring_reviews SET state='approved',quote=q,reviewer_id=auth.uid(),reason=btrim(p_reason),evidence_reference=btrim(p_evidence_reference),approved_at=now() WHERE id=r.id RETURNING * INTO r;
 INSERT INTO public.subscription_events(organization_id,subscription_id,event_key,kind,actor_id,effective_at,details)
 VALUES(c.organization_id,s.id,'recurring-review:'||r.id,'recurring_invoice_review_approved',auth.uid(),now(),jsonb_build_object('review_id',r.id,'command_id',c.id,'payment_id',r.payment_id,'invoice_id',r.invoice_id,'quote',q,'reason',r.reason,'evidence_reference',r.evidence_reference));
 RETURN to_jsonb(r);
END $$;
CREATE FUNCTION public.clinicx_capture_quote(p_subscription text,p_payment text,p_invoice text,p_start bigint,p_end bigint,p_amount bigint) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.clinicx_recurring_reviews;
BEGIN
 SELECT r0.* INTO r FROM public.clinicx_recurring_reviews r0 JOIN public.clinicx_recurring_commands c ON c.id=r0.command_id
 WHERE r0.state='approved' AND c.provider_subscription_id=p_subscription AND r0.payment_id=p_payment AND r0.invoice_id=p_invoice;
 IF r.id IS NOT NULL THEN
  IF r.snapshot->'invoice'->>'billing_start' IS DISTINCT FROM p_start::text OR r.snapshot->'invoice'->>'billing_end' IS DISTINCT FROM p_end::text OR r.quote->>'amount_paise' IS DISTINCT FROM p_amount::text THEN RAISE EXCEPTION 'Approved invoice evidence mismatch'; END IF;
  RETURN r.quote;
 END IF;
 RETURN public.clinicx_charge_quote(p_subscription,p_start,p_amount);
END $$;
CREATE FUNCTION public.clinicx_recurring_recovery_command(p_command uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.clinicx_recurring_commands;
BEGIN
 SELECT * INTO c FROM public.clinicx_recurring_commands WHERE id=p_command;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Unknown command'; END IF;
 RETURN to_jsonb(c);
END $$;
ALTER FUNCTION public.clinicx_renewal_context(uuid) RENAME TO clinicx_renewal_context_v1;
CREATE FUNCTION public.clinicx_renewal_context(p_org uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE q jsonb;s public.subscriptions;a public.clinicx_checkout_attempts;
BEGIN
 q:=public.clinicx_renewal_context_v1(p_org);
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=p_org;
 SELECT * INTO a FROM public.clinicx_checkout_attempts WHERE provider_subscription_id=s.gateway_subscription_id;
 RETURN q||jsonb_build_object('paid_through',s.current_period_end,'terminal_verified',a.provider_terminal_at IS NOT NULL);
END $$;
-- Late errors/race losers must not downgrade a successfully committed command.
ALTER FUNCTION public.clinicx_recurring_command_state(uuid,uuid,text) RENAME TO clinicx_recurring_command_state_v1;
CREATE FUNCTION public.clinicx_recurring_command_state(p_command uuid,p_actor uuid,p_state text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.clinicx_recurring_commands;
BEGIN
 SELECT * INTO c FROM public.clinicx_recurring_commands WHERE id=p_command AND actor_id=p_actor;
 IF c.id IS NULL OR p_state IS NULL OR p_state NOT IN ('uncertain','aborted') THEN RAISE EXCEPTION 'Invalid command state'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-billing:'||c.organization_id,0));
 SELECT * INTO c FROM public.clinicx_recurring_commands WHERE id=p_command FOR UPDATE;
 IF c.state NOT IN ('reserved','uncertain') THEN RETURN to_jsonb(c); END IF;
 RETURN public.clinicx_recurring_command_state_v1(p_command,p_actor,p_state);
END $$;
REVOKE ALL ON FUNCTION public.clinicx_recovery_fingerprint(jsonb),public.clinicx_stage_recurring_review(uuid,jsonb),public.clinicx_capture_quote(text,text,text,bigint,bigint,bigint),public.clinicx_recurring_recovery_command(uuid),public.clinicx_recurring_command_state(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_stage_recurring_review(uuid,jsonb),public.clinicx_capture_quote(text,text,text,bigint,bigint,bigint),public.clinicx_recurring_recovery_command(uuid),public.clinicx_recurring_command_state(uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.clinicx_get_recurring_review(uuid),public.clinicx_approve_recurring_review(uuid,text,text,text),public.clinicx_renewal_context(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clinicx_get_recurring_review(uuid),public.clinicx_approve_recurring_review(uuid,text,text,text),public.clinicx_renewal_context(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
CREATE OR REPLACE FUNCTION public.clinicx_recover_and_settle(p_event text,p_command uuid,p_snapshot jsonb,p_evidence jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.clinicx_recurring_commands;s public.subscriptions;validation jsonb;v_event uuid;result jsonb;r public.clinicx_recurring_reviews;
BEGIN
 SELECT * INTO c FROM public.clinicx_recurring_commands WHERE id=p_command;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Unknown recovery command'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-billing:'||c.organization_id,0));
 SELECT * INTO c FROM public.clinicx_recurring_commands WHERE id=p_command FOR UPDATE;
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=c.organization_id FOR UPDATE;
 IF s.gateway_subscription_id IS DISTINCT FROM c.provider_subscription_id THEN RAISE EXCEPTION 'Recovery current mandate mismatch'; END IF;
 validation:=public.clinicx_validate_recovery(c.id,p_snapshot);
 SELECT * INTO r FROM public.clinicx_recurring_reviews WHERE command_id=c.id AND payment_id=p_snapshot->'payment'->>'id' AND invoice_id=p_snapshot->'invoice'->>'id' AND state='approved';
 IF (validation->>'equal_price')::boolean AND r.id IS NULL THEN RAISE EXCEPTION 'Equal-price applied recovery requires approved operator invoice review'; END IF;
 IF p_evidence IS NULL OR p_evidence->>'payment_id' IS DISTINCT FROM p_snapshot->'payment'->>'id' OR p_evidence->>'invoice_id' IS DISTINCT FROM p_snapshot->'invoice'->>'id' OR
  p_evidence->>'subscription_id' IS DISTINCT FROM c.provider_subscription_id OR p_evidence->>'provider_plan_id' IS DISTINCT FROM coalesce(r.quote->>'provider_plan_id',c.provider_plan_id) OR
  p_evidence->>'amount_paise' IS DISTINCT FROM coalesce(r.quote->>'amount_paise',c.amount_paise::text) OR p_evidence->>'period_start' IS DISTINCT FROM p_snapshot->'invoice'->>'billing_start' OR p_evidence->>'period_end' IS DISTINCT FROM p_snapshot->'invoice'->>'billing_end' THEN RAISE EXCEPTION 'Recovery settlement snapshot mismatch'; END IF;
 IF c.state IN ('reserved','uncertain') THEN
  -- This is the first independently proven target invoice period, NOT an inferred schedule.
  UPDATE public.clinicx_recurring_commands SET state='scheduled',effective_at=(validation->>'period_start')::timestamptz,provider_evidence=p_snapshot,updated_at=now() WHERE id=c.id RETURNING * INTO c;
  INSERT INTO public.subscription_events(organization_id,subscription_id,event_key,kind,actor_id,effective_at,details)
  VALUES(c.organization_id,s.id,'command-recovered:'||c.id,'recurring_command_recovered',c.actor_id,c.effective_at,jsonb_build_object('command_id',c.id,'evidence_source','independent_provider_get','invoice_id',p_snapshot->'invoice'->>'id','payment_id',p_snapshot->'payment'->>'id','amount_paise',c.amount_paise)) RETURNING id INTO v_event;
  INSERT INTO public.subscription_outbox(organization_id,event_id,kind,payload) VALUES(c.organization_id,v_event,'recurring_command_recovered',jsonb_build_object('command_id',c.id)) ON CONFLICT(event_id) DO NOTHING;
 ELSE
  IF c.provider_evidence IS DISTINCT FROM p_snapshot THEN RAISE EXCEPTION 'Recovery evidence conflict'; END IF;
 END IF;
  result:=public.clinicx_settle_payment(p_event,p_evidence);
  -- First target invoice proves command application even when a later invoice was already settled.
  UPDATE public.clinicx_recurring_commands SET state='applied',updated_at=now() WHERE id=c.id AND state='scheduled';
  RETURN result;
 END $$;

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
  q:=public.clinicx_capture_quote(a.provider_subscription_id,v_payment,v_invoice,(p_evidence->>'period_start')::bigint,(p_evidence->>'period_end')::bigint,(p_evidence->>'amount_paise')::bigint);
  IF p_evidence->>'provider_plan_id' IS DISTINCT FROM q->>'provider_plan_id' THEN RAISE EXCEPTION 'Canonical provider plan mismatch'; END IF;
  SELECT * INTO t FROM public.transactions WHERE gateway='razorpay' AND gateway_payment_id=v_payment AND authority_version='clinicx-v1';
  IF t.id IS NOT NULL THEN
   IF t.organization_id IS DISTINCT FROM a.organization_id OR t.checkout_attempt_id IS DISTINCT FROM a.id OR t.canonical_amount_paise IS DISTINCT FROM (q->>'amount_paise')::bigint OR t.provider_invoice_id IS DISTINCT FROM v_invoice OR
    (t.canonical_period_start IS NOT NULL AND t.canonical_period_start IS DISTINCT FROM v_start) OR (t.canonical_period_end IS NOT NULL AND t.canonical_period_end IS DISTINCT FROM v_end) THEN RAISE EXCEPTION 'Payment already bound to different evidence'; END IF;
  ELSE
   IF EXISTS(SELECT 1 FROM public.transactions WHERE gateway_payment_id=v_payment OR razorpay_payment_id=v_payment) OR EXISTS(SELECT 1 FROM public.invoices WHERE razorpay_invoice_id=v_invoice) THEN RAISE EXCEPTION 'Historical payment/invoice requires reconciliation'; END IF;
   INSERT INTO public.transactions(organization_id,subscription_id,checkout_attempt_id,amount,canonical_amount_paise,currency,status,gateway,gateway_payment_id,razorpay_payment_id,plan,billing_cycle,authority_version,provider_invoice_id,canonical_period_start,canonical_period_end,canonical_provider_plan_id)
   VALUES(a.organization_id,s.id,a.id,(q->>'amount_paise')::bigint,(q->>'amount_paise')::bigint,'INR','captured','razorpay',v_payment,v_payment,q->>'plan_id',(q->>'billing_cycle')::public.billing_cycle,'clinicx-v1',v_invoice,v_start,v_end,q->>'provider_plan_id');
   INSERT INTO public.invoices(organization_id,subscription_id,amount,canonical_amount_paise,currency,status,invoice_number,razorpay_invoice_id,canonical_payment_id,authority_version,paid_at,canonical_period_start,canonical_period_end,canonical_provider_plan_id,canonical_plan_id,canonical_billing_cycle)
   VALUES(a.organization_id,s.id,(q->>'amount_paise')::bigint,(q->>'amount_paise')::bigint,'INR','paid','RZP-'||v_payment,v_invoice,v_payment,'clinicx-v1',now(),v_start,v_end,q->>'provider_plan_id',q->>'plan_id',(q->>'billing_cycle')::public.billing_cycle);
   IF (a.state='pending' AND (s.access_source<>'verified_payment' OR v_start>=s.current_period_start)) OR
     (a.state='settled' AND s.gateway_subscription_id=a.provider_subscription_id AND v_end>coalesce(s.current_period_end,'epoch')) THEN
    UPDATE public.subscriptions SET plan_id=q->>'plan_id',billing_cycle=(q->>'billing_cycle')::public.billing_cycle,status='active',access_source='verified_payment',gateway='razorpay',
     gateway_subscription_id=a.provider_subscription_id,razorpay_subscription_id=a.provider_subscription_id,
     current_period_start=v_start,current_period_end=v_end,recovery_ends_at=NULL,
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
