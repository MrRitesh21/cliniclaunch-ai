CREATE FUNCTION public.clinicx_finish_recurring(p_command uuid,p_actor uuid,p_remote jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.clinicx_recurring_commands;s public.subscriptions;v_at timestamptz;v_kind text;v_event uuid;
BEGIN
 SELECT * INTO c FROM public.clinicx_recurring_commands WHERE id=p_command AND actor_id=p_actor;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Command binding required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-billing:'||c.organization_id,0));
 SELECT * INTO c FROM public.clinicx_recurring_commands WHERE id=p_command FOR UPDATE;
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=c.organization_id FOR UPDATE;
 IF p_remote IS NULL OR p_remote->>'id' IS DISTINCT FROM c.provider_subscription_id OR s.gateway_subscription_id IS DISTINCT FROM c.provider_subscription_id THEN RAISE EXCEPTION 'Provider readback binding mismatch'; END IF;
 IF c.state IN ('confirmed','scheduled') THEN
  IF c.provider_evidence IS DISTINCT FROM p_remote THEN RAISE EXCEPTION 'Command readback conflict'; END IF;
  RETURN to_jsonb(c);
 END IF;
 IF c.state NOT IN ('reserved','uncertain') THEN RAISE EXCEPTION 'Command cannot complete'; END IF;
 IF c.kind='change' THEN
  IF p_remote->>'plan_id' IS DISTINCT FROM c.provider_plan_id OR p_remote->>'status' IS DISTINCT FROM 'active' OR
   p_remote->>'has_scheduled_changes' IS DISTINCT FROM 'true' OR p_remote->>'quantity' IS DISTINCT FROM '1' OR
   (p_remote->>'offer_id') IS NOT NULL OR (p_remote->>'change_scheduled_at') IS NULL THEN RAISE EXCEPTION 'Canonical schedule mismatch'; END IF;
  v_at:=to_timestamp((p_remote->>'change_scheduled_at')::bigint);
  IF v_at<c.paid_through OR v_at<=now() THEN RAISE EXCEPTION 'Schedule cannot silently prorate or apply retroactively'; END IF;
  UPDATE public.clinicx_recurring_commands SET state='scheduled',effective_at=v_at,provider_evidence=p_remote,updated_at=now() WHERE id=c.id RETURNING * INTO c;
  v_kind:='subscription_change_scheduled';
 ELSE
  IF (c.kind='resume' AND p_remote->>'plan_id' IS DISTINCT FROM c.previous_provider_plan_id) OR
   (c.kind='cancel' AND NOT public.clinicx_known_provider_plan(c.provider_subscription_id,p_remote->>'plan_id')) OR
   (c.kind='cancel' AND p_remote->>'status' IS DISTINCT FROM 'cancelled') OR
   (c.kind='resume' AND p_remote->>'status' IS DISTINCT FROM 'active') THEN RAISE EXCEPTION 'Canonical lifecycle command mismatch'; END IF;
  UPDATE public.clinicx_recurring_commands SET state='confirmed',effective_at=now(),provider_evidence=p_remote,updated_at=now() WHERE id=c.id RETURNING * INTO c;
  IF c.kind='cancel' THEN
   UPDATE public.subscriptions SET cancel_at_period_end=true,status='cancelled' WHERE id=s.id;
   UPDATE public.clinicx_checkout_attempts SET provider_terminal_at=now() WHERE provider_subscription_id=c.provider_subscription_id;
   UPDATE public.clinicx_recurring_commands SET state='superseded',updated_at=now() WHERE provider_subscription_id=c.provider_subscription_id AND kind='change' AND state='scheduled';
   v_kind:='subscription_cancelled';
  ELSE
   -- Resume does not manufacture paid time or restore elapsed clinical access.
   UPDATE public.subscriptions SET cancel_at_period_end=false WHERE id=s.id;
   UPDATE public.clinicx_checkout_attempts SET provider_terminal_at=NULL WHERE provider_subscription_id=c.provider_subscription_id;
   v_kind:='subscription_resumed';
  END IF;
 END IF;
 INSERT INTO public.subscription_events(organization_id,subscription_id,event_key,kind,actor_id,effective_at,details)
 VALUES(c.organization_id,s.id,'command-confirmed:'||c.id,v_kind,p_actor,coalesce(c.effective_at,now()),
  jsonb_build_object('command_id',c.id,'plan_id',c.plan_id,'billing_cycle',c.billing_cycle,'amount_paise',c.amount_paise,'reason',c.reason,'paid_through',c.paid_through))
 RETURNING id INTO v_event;
 INSERT INTO public.subscription_outbox(organization_id,event_id,kind,payload) VALUES(c.organization_id,v_event,v_kind,jsonb_build_object('command_id',c.id,'paid_through',c.paid_through)) ON CONFLICT(event_id) DO NOTHING;
 RETURN to_jsonb(c);
END $$;
REVOKE ALL ON FUNCTION public.clinicx_finish_recurring(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_finish_recurring(uuid,uuid,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
