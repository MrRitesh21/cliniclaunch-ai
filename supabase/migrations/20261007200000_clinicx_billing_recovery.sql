-- Forward-only, read-only provider recovery. No provider monetary request is replayed.
CREATE FUNCTION public.clinicx_recovery_context(p_subscription text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.clinicx_recurring_commands;
BEGIN
 SELECT * INTO c FROM public.clinicx_recurring_commands WHERE provider_subscription_id=p_subscription AND state IN ('reserved','uncertain') ORDER BY created_at,id LIMIT 1;
 RETURN CASE WHEN c.id IS NULL THEN jsonb_build_object('command',NULL) ELSE jsonb_build_object('command',to_jsonb(c)) END;
END $$;

-- Verify canonical GET evidence again at the SQL authority boundary. The caller must
-- fetch these entities independently (never webhook payloads, notes or POST replies).
CREATE FUNCTION public.clinicx_validate_recovery(p_command uuid,p_snapshot jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.clinicx_recurring_commands;a public.clinicx_checkout_attempts;previous public.clinicx_recurring_commands;
 r jsonb:=p_snapshot->'subscription';p jsonb:=p_snapshot->'payment';i jsonb:=p_snapshot->'invoice';v jsonb:=p_snapshot->'plan';v_start timestamptz;v_end timestamptz;
BEGIN
 SELECT * INTO c FROM public.clinicx_recurring_commands WHERE id=p_command;
 SELECT * INTO a FROM public.clinicx_checkout_attempts WHERE provider_subscription_id=c.provider_subscription_id;
 IF c.id IS NULL OR c.kind<>'change' OR c.state NOT IN ('reserved','uncertain','scheduled','applied') OR a.organization_id IS DISTINCT FROM c.organization_id OR
  p_snapshot->>'command_id' IS DISTINCT FROM c.id::text OR p_snapshot->>'actor_id' IS DISTINCT FROM c.actor_id::text OR p_snapshot->>'organization_id' IS DISTINCT FROM c.organization_id::text THEN RAISE EXCEPTION 'Recovery frozen command/tenant/actor binding mismatch'; END IF;
 IF r->>'id' IS DISTINCT FROM c.provider_subscription_id OR r->>'plan_id' IS DISTINCT FROM c.provider_plan_id OR r->>'status' IS DISTINCT FROM 'active' OR
  r->>'quantity' IS DISTINCT FROM '1' OR r->>'has_scheduled_changes' IS DISTINCT FROM 'false' OR r->>'offer_id' IS NOT NULL THEN RAISE EXCEPTION 'Recovery requires canonical applied subscription'; END IF;
 IF v->>'id' IS DISTINCT FROM c.provider_plan_id OR v->>'period' IS DISTINCT FROM c.billing_cycle::text OR v->>'interval' IS DISTINCT FROM '1' OR
  v->'item'->>'amount' IS DISTINCT FROM c.amount_paise::text OR v->'item'->>'currency' IS DISTINCT FROM 'INR' THEN RAISE EXCEPTION 'Recovery provider plan/quote mismatch'; END IF;
 IF p IS NULL OR i IS NULL OR p->>'id' !~ '^pay_[A-Za-z0-9]{1,64}$' OR i->>'id' !~ '^inv_[A-Za-z0-9]{1,64}$' OR
  p->>'status' IS DISTINCT FROM 'captured' OR (p ? 'captured' AND p->>'captured' IS DISTINCT FROM 'true') OR
  (p ? 'amount_refunded' AND p->>'amount_refunded' IS DISTINCT FROM '0') OR p->>'currency' IS DISTINCT FROM 'INR' OR p->>'amount' IS DISTINCT FROM c.amount_paise::text OR
  p->>'invoice_id' IS DISTINCT FROM i->>'id' OR (p->>'subscription_id' IS NOT NULL AND p->>'subscription_id' IS DISTINCT FROM c.provider_subscription_id) OR
  i->>'subscription_id' IS DISTINCT FROM c.provider_subscription_id OR i->>'payment_id' IS DISTINCT FROM p->>'id' OR i->>'status' IS DISTINCT FROM 'paid' OR
  i->>'amount' IS DISTINCT FROM c.amount_paise::text OR i->>'currency' IS DISTINCT FROM 'INR' OR
  coalesce(i->>'billing_start','') !~ '^[0-9]{1,11}$' OR coalesce(i->>'billing_end','') !~ '^[0-9]{1,11}$' THEN RAISE EXCEPTION 'Recovery canonical invoice/payment relation mismatch'; END IF;
 v_start:=to_timestamp((i->>'billing_start')::bigint);v_end:=to_timestamp((i->>'billing_end')::bigint);
 IF v_start<c.paid_through OR v_start>now() OR v_end<=v_start OR v_end>now()+interval '400 days' THEN RAISE EXCEPTION 'Recovery invoice period/boundary mismatch'; END IF;
 SELECT * INTO previous FROM public.clinicx_recurring_commands WHERE provider_subscription_id=c.provider_subscription_id AND kind='change' AND state IN ('scheduled','applied','superseded') AND id<>c.id AND effective_at<=v_start ORDER BY effective_at DESC,id DESC LIMIT 1;
 RETURN jsonb_build_object('equal_price',c.amount_paise=coalesce(previous.amount_paise,a.amount_paise),'period_start',v_start);
END $$;
CREATE FUNCTION public.clinicx_recover_and_settle(p_event text,p_command uuid,p_snapshot jsonb,p_evidence jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.clinicx_recurring_commands;s public.subscriptions;validation jsonb;v_event uuid;result jsonb;
BEGIN
 SELECT * INTO c FROM public.clinicx_recurring_commands WHERE id=p_command;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Unknown recovery command'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-billing:'||c.organization_id,0));
 SELECT * INTO c FROM public.clinicx_recurring_commands WHERE id=p_command FOR UPDATE;
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=c.organization_id FOR UPDATE;
 IF s.gateway_subscription_id IS DISTINCT FROM c.provider_subscription_id THEN RAISE EXCEPTION 'Recovery current mandate mismatch'; END IF;
 validation:=public.clinicx_validate_recovery(c.id,p_snapshot);
 IF (validation->>'equal_price')::boolean THEN RAISE EXCEPTION 'Equal-price applied recovery requires approved operator invoice review'; END IF;
 IF p_evidence IS NULL OR p_evidence->>'payment_id' IS DISTINCT FROM p_snapshot->'payment'->>'id' OR p_evidence->>'invoice_id' IS DISTINCT FROM p_snapshot->'invoice'->>'id' OR
  p_evidence->>'subscription_id' IS DISTINCT FROM c.provider_subscription_id OR p_evidence->>'provider_plan_id' IS DISTINCT FROM c.provider_plan_id OR
  p_evidence->>'amount_paise' IS DISTINCT FROM c.amount_paise::text OR p_evidence->>'period_start' IS DISTINCT FROM p_snapshot->'invoice'->>'billing_start' OR p_evidence->>'period_end' IS DISTINCT FROM p_snapshot->'invoice'->>'billing_end' THEN RAISE EXCEPTION 'Recovery settlement snapshot mismatch'; END IF;
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
REVOKE ALL ON FUNCTION public.clinicx_recovery_context(text),public.clinicx_validate_recovery(uuid,jsonb),public.clinicx_recover_and_settle(text,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_recovery_context(text),public.clinicx_recover_and_settle(text,uuid,jsonb,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
