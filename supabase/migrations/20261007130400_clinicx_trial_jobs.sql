-- Transactional checkpoint/lifecycle outbox. No external delivery or deletion.
CREATE TABLE public.subscription_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
 event_id uuid NOT NULL UNIQUE REFERENCES public.subscription_events(id) ON DELETE RESTRICT,
 kind text NOT NULL,
 payload jsonb NOT NULL DEFAULT '{}',
 available_at timestamptz NOT NULL DEFAULT now(),
 delivered_at timestamptz,
 attempts integer NOT NULL DEFAULT 0,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clinicx_outbox_pending ON public.subscription_outbox(available_at) WHERE delivered_at IS NULL;
ALTER TABLE public.subscription_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_outbox FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.subscription_outbox TO service_role;

CREATE FUNCTION public.clinicx_enqueue_trial_start() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.kind='trial_started' THEN
   INSERT INTO public.subscription_outbox(organization_id,event_id,kind,payload)
     VALUES(NEW.organization_id,NEW.id,NEW.kind,jsonb_build_object('trial_ends_at',
       (SELECT trial_ends_at FROM public.subscriptions WHERE id=NEW.subscription_id))) ON CONFLICT(event_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER clinicx_trial_start_outbox AFTER INSERT ON public.subscription_events
 FOR EACH ROW EXECUTE FUNCTION public.clinicx_enqueue_trial_start();
REVOKE ALL ON FUNCTION public.clinicx_enqueue_trial_start() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.clinicx_record_trial_event(p_sub public.subscriptions,p_key text,p_at timestamptz,p_payload jsonb DEFAULT '{}')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_event uuid;
BEGIN
 INSERT INTO public.subscription_events(organization_id,subscription_id,event_key,kind,effective_at,details)
   VALUES(p_sub.organization_id,p_sub.id,p_key,p_key,p_at,p_payload)
   ON CONFLICT(subscription_id,event_key) DO NOTHING RETURNING id INTO v_event;
 IF v_event IS NULL THEN RETURN 0; END IF;
 INSERT INTO public.subscription_outbox(organization_id,event_id,kind,payload,available_at)
   VALUES(p_sub.organization_id,v_event,p_key,p_payload,p_at);
 RETURN 1;
END $$;
CREATE FUNCTION public.clinicx_run_trial_jobs(p_now timestamptz DEFAULT now()) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public SET timezone='UTC' AS $$
DECLARE s public.subscriptions; v_day integer; v_events integer:=0; v_usage jsonb;
BEGIN
 FOR s IN SELECT * FROM public.subscriptions WHERE access_source='free_trial'
   AND status::text IN ('trialing','trial_expired','grace_period') ORDER BY id FOR UPDATE SKIP LOCKED LOOP
   -- Never deliver stale conversion reminders after trial expiry. A late run
   -- catches all lifecycle boundaries in chronological order, independently of reminders.
   IF p_now<s.trial_ends_at THEN
     v_usage:=public.clinicx_usage(s.organization_id);
     FOREACH v_day IN ARRAY ARRAY[7,15,21,25,28] LOOP
       IF p_now>=s.trial_started_at+(v_day*interval '24 hours') THEN
         v_events:=v_events+public.clinicx_record_trial_event(s,'trial_day_'||v_day,s.trial_started_at+(v_day*interval '24 hours'),
           jsonb_build_object('usage',v_usage,'recommendation',public.clinicx_recommend_plan(s.organization_id,v_usage),'trial_ends_at',s.trial_ends_at));
       END IF;
     END LOOP;
   END IF;
   IF p_now>=s.trial_ends_at THEN
     v_events:=v_events+public.clinicx_record_trial_event(s,'trial_expired',s.trial_ends_at);
     v_events:=v_events+public.clinicx_record_trial_event(s,'grace_period',s.trial_ends_at,jsonb_build_object('grace_ends_at',s.grace_ends_at));
     IF p_now>=s.grace_ends_at THEN
       v_events:=v_events+public.clinicx_record_trial_event(s,'suspended',s.grace_ends_at);
       UPDATE public.subscriptions SET status='suspended' WHERE id=s.id AND status::text<>'suspended';
     ELSE
       UPDATE public.subscriptions SET status='grace_period' WHERE id=s.id AND status::text<>'grace_period';
     END IF;
   END IF;
 END LOOP;
 RETURN v_events;
END $$;
-- Existing cron name/function is reused; its old immediate-expiry UPDATE is removed.
CREATE OR REPLACE FUNCTION public.expire_lapsed_subscriptions() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_events integer; s public.subscriptions;
BEGIN
 v_events:=public.clinicx_run_trial_jobs();
 FOR s IN SELECT * FROM public.subscriptions WHERE access_source<>'free_trial'
   AND status::text IN ('active','past_due','cancelled') AND current_period_end<=now()
   AND (recovery_ends_at IS NULL OR recovery_ends_at<=now()) FOR UPDATE SKIP LOCKED LOOP
   UPDATE public.subscriptions SET status='expired' WHERE id=s.id;
   v_events:=v_events+1;
 END LOOP;
 RETURN v_events;
END $$;
REVOKE ALL ON FUNCTION public.clinicx_record_trial_event(public.subscriptions,text,timestamptz,jsonb),public.clinicx_run_trial_jobs(timestamptz),public.expire_lapsed_subscriptions() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_run_trial_jobs(timestamptz),public.expire_lapsed_subscriptions() TO service_role;
NOTIFY pgrst, 'reload schema';
