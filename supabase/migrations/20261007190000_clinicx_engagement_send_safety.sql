-- Forward-only: service-fenced immediate send authority and ambiguous-send retention.
ALTER TABLE public.clinicx_notification_delivery ADD COLUMN send_started_at timestamptz;
-- Existing attempts might already have reached the provider; do not relabel them unsent.
UPDATE public.clinicx_notification_delivery SET send_started_at=first_attempt_at WHERE attempts>0;
CREATE FUNCTION public.clinicx_delivery_is_eligible(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.clinicx_notification_is_current(d.outbox_id) IS TRUE AND EXISTS(
  SELECT 1 FROM public.organization_members m JOIN auth.users u ON u.id=m.user_id
  JOIN public.clinicx_engagement_preferences p ON p.organization_id=m.organization_id AND p.user_id=m.user_id
  WHERE m.organization_id=o.organization_id AND m.user_id=d.user_id AND m.role='owner'
  AND p.email_enabled AND u.email_confirmed_at IS NOT NULL AND u.email=d.recipient_email AND nullif(u.email,'') IS NOT NULL)
 FROM public.clinicx_notification_delivery d JOIN public.subscription_outbox o ON o.id=d.outbox_id WHERE d.id=p_id
$$;
CREATE FUNCTION public.clinicx_preflight_notification_delivery(p_id uuid,p_token uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.clinicx_notification_delivery; v_review boolean; BEGIN
 SELECT * INTO d FROM public.clinicx_notification_delivery WHERE id=p_id FOR UPDATE;
 IF d.id IS NULL OR d.lease_token IS DISTINCT FROM p_token OR p_token IS NULL OR d.leased_until<=clock_timestamp()
 OR d.completed_at IS NOT NULL OR d.needs_review THEN RETURN 'lease_lost'; END IF;
 v_review:=d.first_attempt_at<=clock_timestamp()-interval '23 hours' OR d.attempts>20;
 IF public.clinicx_delivery_is_eligible(d.id) IS DISTINCT FROM true OR v_review THEN
  v_review:=v_review OR d.send_started_at IS NOT NULL;
  UPDATE public.clinicx_notification_delivery SET completed_at=CASE WHEN v_review THEN NULL ELSE clock_timestamp() END,
   needs_review=v_review,lease_token=NULL,leased_until=NULL,
   last_error=CASE WHEN v_review THEN 'delivery_requires_reconciliation' ELSE 'recipient_or_event_no_longer_eligible' END WHERE id=d.id;
  UPDATE public.subscription_outbox o SET delivered_at=clock_timestamp() WHERE o.id=d.outbox_id AND o.prepared_at IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM public.clinicx_notification_delivery x WHERE x.outbox_id=o.id AND x.completed_at IS NULL);
  RETURN CASE WHEN v_review THEN 'review' ELSE 'suppressed' END;
 END IF;
 UPDATE public.clinicx_notification_delivery SET send_started_at=coalesce(send_started_at,clock_timestamp()) WHERE id=d.id;
 RETURN 'send';
END $$;
CREATE OR REPLACE FUNCTION public.clinicx_claim_notification_delivery(p_limit integer DEFAULT 10) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_result jsonb; BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid batch' USING ERRCODE='22023'; END IF;
 UPDATE public.clinicx_notification_delivery SET needs_review=true,last_error='retry_window_exhausted',lease_token=NULL,leased_until=NULL
 WHERE completed_at IS NULL AND NOT needs_review AND (leased_until IS NULL OR leased_until<=clock_timestamp())
 AND (attempts>=20 OR first_attempt_at<=clock_timestamp()-interval '23 hours');
 UPDATE public.clinicx_notification_delivery d SET completed_at=CASE WHEN send_started_at IS NULL THEN clock_timestamp() ELSE NULL END,
 needs_review=send_started_at IS NOT NULL,last_error=CASE WHEN send_started_at IS NULL THEN 'recipient_or_event_no_longer_eligible' ELSE 'delivery_requires_reconciliation' END,
 lease_token=NULL,leased_until=NULL WHERE d.completed_at IS NULL AND NOT d.needs_review
 AND (d.leased_until IS NULL OR d.leased_until<=clock_timestamp()) AND public.clinicx_delivery_is_eligible(d.id) IS DISTINCT FROM true;
 UPDATE public.subscription_outbox o SET delivered_at=clock_timestamp() WHERE o.prepared_at IS NOT NULL AND o.delivered_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM public.clinicx_notification_delivery d WHERE d.outbox_id=o.id AND d.completed_at IS NULL);
 WITH ready AS (SELECT id FROM public.clinicx_notification_delivery WHERE completed_at IS NULL AND NOT needs_review AND available_at<=clock_timestamp()
 AND (leased_until IS NULL OR leased_until<=clock_timestamp()) ORDER BY available_at,id LIMIT p_limit FOR UPDATE SKIP LOCKED),
 claimed AS (UPDATE public.clinicx_notification_delivery d SET attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),
 lease_token=gen_random_uuid(),leased_until=clock_timestamp()+interval '15 minutes' FROM ready WHERE d.id=ready.id RETURNING d.*)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.id,'lease_token',d.lease_token,'idempotency_key','clinicx-email-'||d.id,'to',d.recipient_email,'copy',d.copy)), '[]') INTO v_result FROM claimed d;
 RETURN v_result;
END $$;
CREATE OR REPLACE FUNCTION public.clinicx_finish_notification_delivery(p_id uuid,p_token uuid,p_success boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE d public.clinicx_notification_delivery; v_review boolean; BEGIN
 IF p_success IS NULL THEN RAISE EXCEPTION 'Result required' USING ERRCODE='22023'; END IF;
 SELECT * INTO d FROM public.clinicx_notification_delivery WHERE id=p_id FOR UPDATE;
 IF d.id IS NULL OR p_token IS NULL OR d.lease_token IS DISTINCT FROM p_token OR d.leased_until<=clock_timestamp()
 OR d.completed_at IS NOT NULL OR d.needs_review THEN RETURN false; END IF;
 -- Confirmed success closes even an in-flight revocation; an uncertain failure must not resend under revoked authority.
 v_review:=NOT p_success AND (public.clinicx_delivery_is_eligible(d.id) IS DISTINCT FROM true
 OR d.first_attempt_at<=clock_timestamp()-interval '23 hours' OR d.attempts>=20);
 UPDATE public.clinicx_notification_delivery SET completed_at=CASE WHEN p_success THEN clock_timestamp() ELSE NULL END,
 available_at=CASE WHEN p_success OR v_review THEN available_at ELSE clock_timestamp()+least(3600,30*power(2,least(attempts,7)))*interval '1 second' END,
 needs_review=v_review,lease_token=NULL,leased_until=NULL,
 last_error=CASE WHEN p_success THEN NULL WHEN v_review THEN 'delivery_requires_reconciliation' ELSE 'delivery_failed' END WHERE id=d.id;
 UPDATE public.subscription_outbox o SET delivered_at=clock_timestamp() WHERE o.id=d.outbox_id AND o.prepared_at IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM public.clinicx_notification_delivery x WHERE x.outbox_id=o.id AND x.completed_at IS NULL);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.clinicx_delivery_is_eligible(uuid),public.clinicx_preflight_notification_delivery(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_preflight_notification_delivery(uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
