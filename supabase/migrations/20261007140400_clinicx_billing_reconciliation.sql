-- Durable verified-event inbox. Queuing is NOT completed-event deduplication.
CREATE TABLE public.clinicx_billing_jobs (
 event_id text PRIMARY KEY, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 available_at timestamptz NOT NULL DEFAULT now(), leased_until timestamptz, lease_token uuid,
 attempts integer NOT NULL DEFAULT 0, completed_at timestamptz, needs_review boolean NOT NULL DEFAULT false,
 last_error text
);
CREATE INDEX clinicx_billing_jobs_pending ON public.clinicx_billing_jobs(available_at) WHERE completed_at IS NULL AND NOT needs_review;
ALTER TABLE public.clinicx_billing_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinicx_billing_jobs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.clinicx_billing_jobs TO service_role;
CREATE FUNCTION public.clinicx_enqueue_billing_event(p_event text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.clinicx_billing_jobs;
BEGIN
 IF p_event IS NULL OR length(p_event) NOT BETWEEN 1 AND 200 OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'Invalid verified event'; END IF;
 INSERT INTO public.clinicx_billing_jobs(event_id,payload) VALUES(p_event,p_payload) ON CONFLICT(event_id) DO NOTHING;
 SELECT * INTO j FROM public.clinicx_billing_jobs WHERE event_id=p_event FOR UPDATE;
 IF j.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'Verified event payload conflict'; END IF;
 RETURN jsonb_build_object('completed',j.completed_at IS NOT NULL,'needs_review',j.needs_review);
END $$;
CREATE FUNCTION public.clinicx_claim_billing_events(p_limit integer DEFAULT 10) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_jobs jsonb;
BEGIN
 IF p_limit NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Invalid worker limit'; END IF;
 UPDATE public.clinicx_billing_jobs SET needs_review=true WHERE attempts>=20 AND completed_at IS NULL AND (leased_until IS NULL OR leased_until<now());
 WITH claimed AS (SELECT event_id FROM public.clinicx_billing_jobs WHERE completed_at IS NULL AND NOT needs_review AND available_at<=now()
  AND (leased_until IS NULL OR leased_until<now()) ORDER BY available_at,event_id FOR UPDATE SKIP LOCKED LIMIT p_limit),
 changed AS (UPDATE public.clinicx_billing_jobs j SET leased_until=now()+interval '15 minutes',lease_token=gen_random_uuid(),attempts=attempts+1 FROM claimed c WHERE j.event_id=c.event_id RETURNING j.*)
 SELECT coalesce(jsonb_agg(to_jsonb(changed)),'[]') INTO v_jobs FROM changed;
 RETURN v_jobs;
END $$;
CREATE FUNCTION public.clinicx_retry_billing_event(p_event text,p_token uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.clinicx_billing_jobs SET available_at=now()+interval '5 minutes',leased_until=NULL,lease_token=NULL,last_error='Provider/authority reconciliation required',needs_review=attempts>=20
 WHERE event_id=p_event AND lease_token=p_token AND completed_at IS NULL;
 RETURN jsonb_build_object('retry_scheduled',FOUND);
END $$;
CREATE FUNCTION public.clinicx_complete_billing_job() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.authority_version='clinicx-v1' AND NEW.completed_at IS NOT NULL THEN
  UPDATE public.clinicx_billing_jobs SET completed_at=NEW.completed_at,leased_until=NULL,lease_token=NULL,last_error=NULL WHERE event_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER clinicx_complete_job AFTER INSERT OR UPDATE ON public.webhook_events FOR EACH ROW EXECUTE FUNCTION public.clinicx_complete_billing_job();
REVOKE ALL ON FUNCTION public.clinicx_enqueue_billing_event(text,jsonb),public.clinicx_claim_billing_events(integer),public.clinicx_retry_billing_event(text,uuid),public.clinicx_complete_billing_job() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_enqueue_billing_event(text,jsonb),public.clinicx_claim_billing_events(integer),public.clinicx_retry_billing_event(text,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
