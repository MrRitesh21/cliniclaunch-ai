-- Reuse subscription_outbox, existing notification inbox and Resend transport.
ALTER TABLE public.subscription_outbox ADD COLUMN prepared_at timestamptz;
ALTER TABLE public.notifications ADD COLUMN clinicx_event_id uuid REFERENCES public.subscription_events(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX clinicx_notification_event_user ON public.notifications(clinicx_event_id,user_id) WHERE clinicx_event_id IS NOT NULL;
-- Inbox clients may mark read, not alter event/tenant/recipient authority.
REVOKE UPDATE ON public.notifications FROM authenticated;
GRANT UPDATE(read_at) ON public.notifications TO authenticated;
CREATE TABLE public.clinicx_engagement_preferences (
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 email_enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,user_id)
);
CREATE TABLE public.clinicx_notification_delivery (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 outbox_id uuid NOT NULL REFERENCES public.subscription_outbox(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 channel text NOT NULL DEFAULT 'email' CHECK(channel='email'),
 recipient_email text NOT NULL,
 copy jsonb NOT NULL,
 available_at timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 0,
 first_attempt_at timestamptz,
 lease_token uuid, leased_until timestamptz,
 completed_at timestamptz, needs_review boolean NOT NULL DEFAULT false,
 last_error text,
 UNIQUE(outbox_id,user_id,channel)
);
CREATE INDEX clinicx_delivery_pending ON public.clinicx_notification_delivery(available_at) WHERE completed_at IS NULL AND NOT needs_review;
ALTER TABLE public.clinicx_engagement_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinicx_notification_delivery ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinicx_engagement_preferences,public.clinicx_notification_delivery FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.clinicx_engagement_preferences,public.clinicx_notification_delivery TO service_role;
CREATE FUNCTION public.clinicx_set_engagement_email(p_org uuid,p_enabled boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL OR NOT public.has_org_role(p_org,auth.uid(),ARRAY['owner']::public.org_role[]) THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
 IF p_enabled IS NULL THEN RAISE EXCEPTION 'Consent required' USING ERRCODE='22023'; END IF;
 INSERT INTO public.clinicx_engagement_preferences(organization_id,user_id,email_enabled) VALUES(p_org,auth.uid(),p_enabled)
 ON CONFLICT(organization_id,user_id) DO UPDATE SET email_enabled=EXCLUDED.email_enabled,updated_at=now();
 RETURN jsonb_build_object('email_enabled',p_enabled);
END $$;
CREATE FUNCTION public.clinicx_notification_copy(p_kind text,p_ends timestamptz) RETURNS jsonb
LANGUAGE sql STABLE SET timezone='UTC' AS $$ SELECT jsonb_build_object('title',CASE p_kind
 WHEN 'trial_started' THEN 'Welcome to ClinicX' WHEN 'trial_day_7' THEN 'Your first week with ClinicX'
 WHEN 'trial_day_15' THEN 'Your halfway trial checkpoint' WHEN 'trial_day_21' THEN 'Review your ClinicX trial activity'
 WHEN 'trial_day_25' THEN 'Your trial is nearing its end' WHEN 'trial_day_28' THEN 'Continue ClinicX when you are ready'
 WHEN 'trial_expired' THEN 'Your free trial has ended' WHEN 'suspended' THEN 'Clinic operations are paused'
 WHEN 'payment_success' THEN 'Your ClinicX subscription is active' WHEN 'payment_failed' THEN 'Payment could not be confirmed'
 ELSE 'Your ClinicX subscription' END,
 'body',CASE WHEN p_kind IN ('trial_expired','suspended') THEN 'Your clinic data is safe. Billing, account management, authorized export and support remain available.'
 WHEN p_kind='payment_failed' THEN 'Review Billing to retry or update payment details. Your clinic data is safe.'
 WHEN p_kind='payment_success' THEN 'Your verified payment is recorded. Review Billing for your paid-through date.'
 ELSE 'Explore your actual clinic activity in Your ClinicX Journey. Trial ends '||to_char(p_ends AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI')||' UTC. Compare all plans without interrupting clinical work.' END) $$;
CREATE FUNCTION public.clinicx_notification_is_current(p_outbox uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE
 WHEN o.kind='trial_started' OR o.kind LIKE 'trial_day_%' THEN public.clinicx_effective_state(o.organization_id)='trialing'
   AND NOT EXISTS(SELECT 1 FROM public.subscription_outbox newer JOIN public.subscription_events ne ON ne.id=newer.event_id
     WHERE newer.organization_id=o.organization_id AND newer.kind LIKE 'trial_day_%' AND ne.effective_at>e.effective_at AND ne.effective_at<=now())
 WHEN o.kind IN ('trial_expired','suspended') THEN public.clinicx_effective_state(o.organization_id) IN ('grace_period','suspended')
 WHEN o.kind='payment_failed' THEN s.status::text='past_due'
 WHEN o.kind='payment_success' THEN public.clinicx_effective_state(o.organization_id)='active'
 ELSE false END
 FROM public.subscription_outbox o JOIN public.subscription_events e ON e.id=o.event_id JOIN public.subscriptions s ON s.id=e.subscription_id WHERE o.id=p_outbox
$$;
CREATE FUNCTION public.clinicx_prepare_notification_delivery(p_limit integer DEFAULT 50) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.subscription_outbox; r record; s public.subscriptions; v_copy jsonb; n integer:=0; BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid batch' USING ERRCODE='22023'; END IF;
 FOR o IN SELECT * FROM public.subscription_outbox WHERE prepared_at IS NULL AND delivered_at IS NULL AND available_at<=now() ORDER BY available_at,id LIMIT p_limit FOR UPDATE SKIP LOCKED LOOP
   IF public.clinicx_notification_is_current(o.id) IS DISTINCT FROM true THEN
     UPDATE public.subscription_outbox SET prepared_at=now(),delivered_at=now() WHERE id=o.id;
     CONTINUE;
   END IF;
   SELECT sub.* INTO s FROM public.subscriptions sub JOIN public.subscription_events e ON e.subscription_id=sub.id WHERE e.id=o.event_id;
   v_copy:=public.clinicx_notification_copy(o.kind,s.trial_ends_at);
   FOR r IN SELECT m.user_id,u.email,u.email_confirmed_at,coalesce(p.email_enabled,false) email_enabled
     FROM public.organization_members m JOIN auth.users u ON u.id=m.user_id
     LEFT JOIN public.clinicx_engagement_preferences p ON p.organization_id=m.organization_id AND p.user_id=m.user_id
     WHERE m.organization_id=o.organization_id AND m.role='owner' LOOP
     INSERT INTO public.notifications(user_id,organization_id,category,title,body,url,meta,clinicx_event_id)
     VALUES(r.user_id,o.organization_id,'billing',v_copy->>'title',v_copy->>'body','/dashboard/billing',jsonb_build_object('kind',o.kind),o.event_id)
     ON CONFLICT(clinicx_event_id,user_id) WHERE clinicx_event_id IS NOT NULL DO NOTHING;
     IF r.email_enabled AND r.email_confirmed_at IS NOT NULL AND nullif(r.email,'') IS NOT NULL THEN
       INSERT INTO public.clinicx_notification_delivery(outbox_id,user_id,recipient_email,copy) VALUES(o.id,r.user_id,r.email,v_copy) ON CONFLICT DO NOTHING;
     END IF;
   END LOOP;
   -- Do not silently lose messages for a workspace without a current owner.
   IF NOT EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id=o.organization_id AND role='owner') THEN CONTINUE; END IF;
   UPDATE public.subscription_outbox SET prepared_at=now(),delivered_at=CASE WHEN EXISTS(SELECT 1 FROM public.clinicx_notification_delivery WHERE outbox_id=o.id) THEN NULL ELSE now() END WHERE id=o.id;
   n:=n+1;
 END LOOP;
 RETURN n;
END $$;
CREATE FUNCTION public.clinicx_claim_notification_delivery(p_limit integer DEFAULT 10) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_result jsonb; BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid batch' USING ERRCODE='22023'; END IF;
 -- Resend idempotency is time-limited; never blindly resend uncertain delivery after 23h.
 UPDATE public.clinicx_notification_delivery SET needs_review=true,last_error='retry_window_exhausted'
 WHERE completed_at IS NULL AND NOT needs_review AND (leased_until IS NULL OR leased_until<=now())
 AND (attempts>=20 OR first_attempt_at<now()-interval '23 hours');
 UPDATE public.clinicx_notification_delivery d SET completed_at=now(),last_error='recipient_or_event_no_longer_eligible',lease_token=NULL,leased_until=NULL
 WHERE d.completed_at IS NULL AND NOT d.needs_review AND (d.leased_until IS NULL OR d.leased_until<=now())
 AND (public.clinicx_notification_is_current(d.outbox_id) IS DISTINCT FROM true OR NOT EXISTS(
   SELECT 1 FROM public.subscription_outbox o JOIN public.organization_members m ON m.organization_id=o.organization_id AND m.user_id=d.user_id AND m.role='owner'
   JOIN auth.users u ON u.id=m.user_id AND u.email_confirmed_at IS NOT NULL AND u.email=d.recipient_email
   JOIN public.clinicx_engagement_preferences p ON p.organization_id=m.organization_id AND p.user_id=m.user_id AND p.email_enabled WHERE o.id=d.outbox_id));
 UPDATE public.subscription_outbox o SET delivered_at=now() WHERE o.prepared_at IS NOT NULL AND o.delivered_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM public.clinicx_notification_delivery d WHERE d.outbox_id=o.id AND d.completed_at IS NULL);
 WITH ready AS (SELECT id FROM public.clinicx_notification_delivery WHERE completed_at IS NULL AND NOT needs_review AND available_at<=now()
 AND (leased_until IS NULL OR leased_until<=now()) ORDER BY available_at,id LIMIT p_limit FOR UPDATE SKIP LOCKED),
 claimed AS (UPDATE public.clinicx_notification_delivery d SET attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),lease_token=gen_random_uuid(),leased_until=now()+interval '15 minutes' FROM ready WHERE d.id=ready.id RETURNING d.*)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.id,'lease_token',d.lease_token,'idempotency_key','clinicx-email-'||d.id,'to',d.recipient_email,'copy',d.copy)), '[]') INTO v_result
 FROM claimed d JOIN auth.users u ON u.id=d.user_id JOIN public.subscription_outbox o ON o.id=d.outbox_id
 JOIN public.subscription_events e ON e.id=o.event_id JOIN public.subscriptions s ON s.id=e.subscription_id;
 RETURN v_result;
END $$;
CREATE FUNCTION public.clinicx_finish_notification_delivery(p_id uuid,p_token uuid,p_success boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_outbox uuid; BEGIN
 IF p_success IS NULL THEN RAISE EXCEPTION 'Result required' USING ERRCODE='22023'; END IF;
 UPDATE public.clinicx_notification_delivery SET completed_at=CASE WHEN p_success THEN now() ELSE NULL END,
 available_at=CASE WHEN p_success THEN available_at ELSE now()+least(3600,30*power(2,least(attempts,7))) *interval '1 second' END,
 lease_token=NULL,leased_until=NULL,last_error=CASE WHEN p_success THEN NULL ELSE 'delivery_failed' END
 WHERE id=p_id AND lease_token=p_token AND leased_until>now() AND completed_at IS NULL RETURNING outbox_id INTO v_outbox;
 IF v_outbox IS NULL THEN RETURN false; END IF;
 UPDATE public.subscription_outbox SET delivered_at=now() WHERE id=v_outbox AND prepared_at IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM public.clinicx_notification_delivery WHERE outbox_id=v_outbox AND completed_at IS NULL);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.clinicx_set_engagement_email(uuid,boolean),public.clinicx_notification_copy(text,timestamptz),public.clinicx_notification_is_current(uuid),public.clinicx_prepare_notification_delivery(integer),public.clinicx_claim_notification_delivery(integer),public.clinicx_finish_notification_delivery(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_set_engagement_email(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_prepare_notification_delivery(integer),public.clinicx_claim_notification_delivery(integer),public.clinicx_finish_notification_delivery(uuid,uuid,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
