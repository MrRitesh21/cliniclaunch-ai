CREATE TABLE public.clinicx_billing_policy (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), recovery_hours integer NOT NULL CHECK(recovery_hours BETWEEN 1 AND 744)
);
INSERT INTO public.clinicx_billing_policy VALUES(true,168);
ALTER TABLE public.clinicx_billing_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinicx_billing_policy FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.clinicx_billing_policy TO service_role;

-- Fresh canonical provider status can restrict access, but can NEVER create a paid period.
CREATE FUNCTION public.clinicx_billing_lifecycle(p_event text,p_subscription text,p_status text,p_period_start bigint,p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.clinicx_checkout_attempts; s public.subscriptions; v_key text; v_event uuid; v_kind text; v_payload jsonb; v_recovery integer;
BEGIN
 SELECT * INTO a FROM public.clinicx_checkout_attempts WHERE provider_subscription_id=p_subscription;
 IF a.id IS NULL THEN RAISE EXCEPTION 'Unbound provider subscription' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-billing:'||a.organization_id,0));
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=a.organization_id FOR UPDATE;
 IF p_event IS NULL OR length(p_event) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid event ID'; END IF;
 v_payload:=jsonb_build_object('subscription_id',p_subscription,'status',p_status,'period_start',p_period_start);
 IF EXISTS(SELECT 1 FROM public.webhook_events WHERE id=p_event AND authority_version='clinicx-v1') THEN
  IF EXISTS(SELECT 1 FROM public.webhook_events WHERE id=p_event AND payload IS DISTINCT FROM v_payload) THEN RAISE EXCEPTION 'Event evidence conflict'; END IF;
  RETURN jsonb_build_object('ok',true,'deduped',true); END IF;
 v_kind:=CASE WHEN p_status IN ('pending','halted') THEN 'payment_failed' WHEN p_status IN ('cancelled','completed','cancel_scheduled') THEN 'subscription_cancelled' ELSE 'mandate_observed' END;
 IF s.gateway_subscription_id=p_subscription AND s.access_source='verified_payment' THEN
  IF p_status IN ('pending','halted') AND p_period_start IS NOT NULL AND to_timestamp(p_period_start)>=s.current_period_end THEN
   SELECT recovery_hours INTO v_recovery FROM public.clinicx_billing_policy WHERE singleton;
   -- Retries don't restart or extend recovery. Anchor it to the paid-through date.
   UPDATE public.subscriptions SET status='past_due',recovery_ends_at=coalesce(recovery_ends_at,current_period_end+make_interval(hours=>v_recovery)) WHERE id=s.id;
  ELSIF p_status IN ('cancelled','completed','cancel_scheduled') THEN
   UPDATE public.subscriptions SET cancel_at_period_end=true,
     status=CASE WHEN p_status='cancel_scheduled' THEN status ELSE 'cancelled'::public.subscription_status END WHERE id=s.id;
  END IF;
 END IF;
 v_key:=CASE WHEN v_kind='payment_failed' THEN 'failure:'||p_subscription||':'||coalesce(p_period_start::text,'unknown') WHEN v_kind='subscription_cancelled' THEN 'cancel:'||p_subscription ELSE 'provider:'||p_event END;
 INSERT INTO public.subscription_events(organization_id,subscription_id,event_key,kind,actor_id,effective_at,details)
 VALUES(a.organization_id,s.id,v_key,v_kind,p_actor,now(),v_payload) ON CONFLICT(subscription_id,event_key) DO NOTHING RETURNING id INTO v_event;
 IF v_event IS NOT NULL AND v_kind<>'mandate_observed' THEN
  INSERT INTO public.subscription_outbox(organization_id,event_id,kind,payload) VALUES(a.organization_id,v_event,v_kind,v_payload) ON CONFLICT(event_id) DO NOTHING;
 END IF;
 INSERT INTO public.webhook_events(id,provider,event_type,payload,completed_at,authority_version) VALUES(p_event,'razorpay',v_kind,v_payload,now(),'clinicx-v1')
 ON CONFLICT(id) DO UPDATE SET completed_at=EXCLUDED.completed_at,payload=EXCLUDED.payload,authority_version=EXCLUDED.authority_version,event_type=EXCLUDED.event_type;
 RETURN jsonb_build_object('ok',true,'active',false,'status_changed',s.gateway_subscription_id=p_subscription);
END $$;
CREATE FUNCTION public.clinicx_enqueue_payment_notice() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.kind='payment_success' THEN
  INSERT INTO public.subscription_outbox(organization_id,event_id,kind,payload) VALUES(NEW.organization_id,NEW.id,NEW.kind,NEW.details) ON CONFLICT(event_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER clinicx_payment_notice AFTER INSERT ON public.subscription_events FOR EACH ROW EXECUTE FUNCTION public.clinicx_enqueue_payment_notice();
REVOKE ALL ON FUNCTION public.clinicx_billing_lifecycle(text,text,text,bigint,uuid),public.clinicx_enqueue_payment_notice() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_billing_lifecycle(text,text,text,bigint,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
