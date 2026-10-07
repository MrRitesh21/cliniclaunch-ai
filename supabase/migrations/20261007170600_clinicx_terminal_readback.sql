-- Retain prior audited lifecycle authority; attach canonical terminal evidence only after it succeeds.
ALTER FUNCTION public.clinicx_billing_lifecycle(text,text,text,bigint,uuid) RENAME TO clinicx_billing_lifecycle_v1;
CREATE FUNCTION public.clinicx_billing_lifecycle(p_event text,p_subscription text,p_status text,p_period_start bigint,p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF p_status IS NULL OR p_status NOT IN ('created','authenticated','active','pending','halted','paused','cancelled','completed','expired','cancel_scheduled') THEN RAISE EXCEPTION 'Invalid canonical lifecycle status'; END IF;
 result:=public.clinicx_billing_lifecycle_v1(p_event,p_subscription,p_status,p_period_start,p_actor);
 IF p_status IN ('cancelled','completed','expired') THEN
  UPDATE public.clinicx_checkout_attempts SET provider_terminal_at=coalesce(provider_terminal_at,now()),
   state=CASE WHEN state IN ('creating','pending','needs_reconciliation') THEN 'failed' ELSE state END,updated_at=now()
   WHERE provider_subscription_id=p_subscription;
  UPDATE public.clinicx_recurring_commands SET state='superseded',updated_at=now()
   WHERE provider_subscription_id=p_subscription AND kind='change' AND state='scheduled';
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.clinicx_billing_lifecycle(text,text,text,bigint,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_billing_lifecycle(text,text,text,bigint,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
