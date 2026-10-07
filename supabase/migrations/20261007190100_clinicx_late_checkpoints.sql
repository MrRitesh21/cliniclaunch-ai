-- Durable factual checkpoints are independent of reminder freshness.
CREATE OR REPLACE FUNCTION public.clinicx_run_trial_jobs(p_now timestamptz DEFAULT now()) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public SET timezone='UTC' AS $$
DECLARE s public.subscriptions; v_day integer; v_events integer:=0; v_now timestamptz:=clock_timestamp(); BEGIN
 -- Compatibility argument is intentionally ignored. A service caller cannot move the lifecycle clock.
 FOR s IN SELECT * FROM public.subscriptions WHERE access_source='free_trial'
 AND status::text IN ('trialing','trial_expired','grace_period','suspended') ORDER BY id FOR UPDATE SKIP LOCKED LOOP
  FOREACH v_day IN ARRAY ARRAY[0,7,15,21,25,28] LOOP
   IF v_now>=s.trial_started_at+v_day*interval '24 hours' THEN
    v_events:=v_events+public.clinicx_record_trial_event(s,'trial_day_'||v_day,s.trial_started_at+v_day*interval '24 hours',
     jsonb_build_object('trial_ends_at',s.trial_ends_at));
   END IF;
  END LOOP;
  IF v_now>=s.trial_ends_at THEN
   v_events:=v_events+public.clinicx_record_trial_event(s,'trial_expired',s.trial_ends_at);
   v_events:=v_events+public.clinicx_record_trial_event(s,'grace_period',s.trial_ends_at,jsonb_build_object('grace_ends_at',s.grace_ends_at));
   IF v_now>=s.grace_ends_at THEN
    v_events:=v_events+public.clinicx_record_trial_event(s,'suspended',s.grace_ends_at);
    UPDATE public.subscriptions SET status='suspended' WHERE id=s.id AND status::text<>'suspended';
   ELSE
    UPDATE public.subscriptions SET status='grace_period' WHERE id=s.id AND status::text<>'grace_period';
   END IF;
  END IF;
 END LOOP;
 RETURN v_events;
END $$;
CREATE OR REPLACE FUNCTION public.clinicx_record_trial_event(p_sub public.subscriptions,p_key text,p_at timestamptz,p_payload jsonb DEFAULT '{}')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_event uuid; v_payload jsonb:=p_payload; BEGIN
 IF p_key LIKE 'trial_day_%' THEN
  v_payload:=v_payload||jsonb_build_object('usage',public.clinicx_trial_usage(p_sub.organization_id,p_at),'snapshot_at',p_at,
   'snapshot_semantics','records created in trial window, using current stored status/totals; not a historical state reconstruction');
 END IF;
 INSERT INTO public.subscription_events(organization_id,subscription_id,event_key,kind,effective_at,details)
 VALUES(p_sub.organization_id,p_sub.id,p_key,p_key,p_at,v_payload) ON CONFLICT(subscription_id,event_key) DO NOTHING RETURNING id INTO v_event;
 IF v_event IS NULL THEN RETURN 0; END IF;
 -- Day zero analytics exists, but trial_started already owns the welcome notice.
 IF p_key<>'trial_day_0' THEN
  INSERT INTO public.subscription_outbox(organization_id,event_id,kind,payload,available_at) VALUES(p_sub.organization_id,v_event,p_key,v_payload,p_at);
 END IF;
 RETURN 1;
END $$;
CREATE OR REPLACE FUNCTION public.clinicx_notification_is_current(p_outbox uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE
 WHEN o.kind='trial_started' OR o.kind LIKE 'trial_day_%' THEN public.clinicx_effective_state(o.organization_id)='trialing'
  AND s.access_source='free_trial' AND e.effective_at<=now()
  AND CASE WHEN o.kind='trial_started' THEN 0 ELSE substring(o.kind from 'trial_day_([0-9]+)')::integer END =
   (SELECT coalesce(max(day),0) FROM unnest(ARRAY[0,7,15,21,25,28]) day WHERE now()>=s.trial_started_at+day*interval '24 hours')
 WHEN o.kind='trial_expired' THEN public.clinicx_effective_state(o.organization_id)='grace_period'
 WHEN o.kind='suspended' THEN public.clinicx_effective_state(o.organization_id)='suspended'
 WHEN o.kind='payment_failed' THEN s.status::text='past_due'
 WHEN o.kind='payment_success' THEN public.clinicx_effective_state(o.organization_id)='active'
 ELSE false END
 FROM public.subscription_outbox o JOIN public.subscription_events e ON e.id=o.event_id JOIN public.subscriptions s ON s.id=e.subscription_id WHERE o.id=p_outbox
$$;
NOTIFY pgrst,'reload schema';
