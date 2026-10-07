-- Canonical terminal GET evidence closes a cancellation intent, without pretending
-- a completed/expired provider entity is cancelled or manufacturing paid time.
CREATE FUNCTION public.clinicx_recover_terminal_command(p_command uuid,p_actor uuid,p_remote jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.clinicx_recurring_commands;s public.subscriptions;v_event uuid;
BEGIN
 SELECT * INTO c FROM public.clinicx_recurring_commands WHERE id=p_command AND actor_id=p_actor;
 IF c.id IS NULL OR c.kind<>'cancel' THEN RAISE EXCEPTION 'Terminal cancellation command binding mismatch'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-billing:'||c.organization_id,0));
 SELECT * INTO c FROM public.clinicx_recurring_commands WHERE id=p_command FOR UPDATE;
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=c.organization_id FOR UPDATE;
 IF p_remote IS NULL OR p_remote->>'id' IS DISTINCT FROM c.provider_subscription_id OR
  coalesce(p_remote->>'status','') NOT IN ('cancelled','completed','expired') OR
  NOT public.clinicx_known_provider_plan(c.provider_subscription_id,p_remote->>'plan_id') THEN RAISE EXCEPTION 'Canonical terminal command mismatch'; END IF;
 IF c.state='confirmed' THEN RETURN to_jsonb(c); END IF;
 IF c.state NOT IN ('reserved','uncertain') THEN RAISE EXCEPTION 'Terminal command cannot complete'; END IF;
 -- An old mandate may terminate after a safe replacement. Never cancel the newer mandate.
 PERFORM public.clinicx_billing_lifecycle('command-terminal:'||c.id,c.provider_subscription_id,p_remote->>'status',NULL,c.actor_id);
 UPDATE public.clinicx_recurring_commands SET state='confirmed',effective_at=now(),provider_evidence=p_remote,updated_at=now() WHERE id=c.id RETURNING * INTO c;
 IF s.gateway_subscription_id=c.provider_subscription_id THEN UPDATE public.subscriptions SET cancel_at_period_end=true WHERE id=s.id; END IF;
 INSERT INTO public.subscription_events(organization_id,subscription_id,event_key,kind,actor_id,effective_at,details)
 VALUES(c.organization_id,s.id,'command-confirmed:'||c.id,'recurring_cancel_terminal_confirmed',c.actor_id,now(),jsonb_build_object('command_id',c.id,'provider_status',p_remote->>'status','paid_through',c.paid_through,'reason',c.reason)) RETURNING id INTO v_event;
 INSERT INTO public.subscription_outbox(organization_id,event_id,kind,payload) VALUES(c.organization_id,v_event,'recurring_cancel_terminal_confirmed',jsonb_build_object('command_id',c.id,'provider_status',p_remote->>'status')) ON CONFLICT(event_id) DO NOTHING;
 RETURN to_jsonb(c);
END $$;
ALTER TABLE public.clinicx_recurring_commands ADD COLUMN recovery_after timestamptz NOT NULL DEFAULT now(),ADD COLUMN recovery_attempts integer NOT NULL DEFAULT 0;
CREATE INDEX clinicx_recurring_recovery_due ON public.clinicx_recurring_commands(recovery_after,id) WHERE state IN ('reserved','uncertain');
CREATE FUNCTION public.clinicx_claim_recurring_recovery(p_limit integer DEFAULT 2) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Invalid recovery batch limit'; END IF;
 WITH due AS (SELECT id FROM public.clinicx_recurring_commands WHERE state IN ('reserved','uncertain') AND recovery_after<=now() AND created_at<=now()-interval '1 minute' ORDER BY recovery_after,id LIMIT p_limit FOR UPDATE SKIP LOCKED),
 claimed AS (UPDATE public.clinicx_recurring_commands c SET recovery_after=now()+interval '5 minutes',recovery_attempts=recovery_attempts+1 FROM due WHERE c.id=due.id RETURNING c.*)
 SELECT coalesce(jsonb_agg(to_jsonb(claimed)),'[]') INTO result FROM claimed;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.clinicx_recover_terminal_command(uuid,uuid,jsonb),public.clinicx_claim_recurring_recovery(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_recover_terminal_command(uuid,uuid,jsonb),public.clinicx_claim_recurring_recovery(integer) TO service_role;
NOTIFY pgrst,'reload schema';
