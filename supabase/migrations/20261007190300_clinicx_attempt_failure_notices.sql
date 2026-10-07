-- Failed initial checkout does not turn a valid free trial into paid arrears.
CREATE OR REPLACE FUNCTION public.clinicx_notification_is_current(p_outbox uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE
 WHEN o.kind='trial_started' OR o.kind LIKE 'trial_day_%' THEN public.clinicx_effective_state(o.organization_id)='trialing'
  AND s.access_source='free_trial' AND e.effective_at<=now()
  AND CASE WHEN o.kind='trial_started' THEN 0 ELSE substring(o.kind from 'trial_day_([0-9]+)')::integer END =
   (SELECT coalesce(max(day),0) FROM unnest(ARRAY[0,7,15,21,25,28]) day WHERE now()>=s.trial_started_at+day*interval '24 hours')
 WHEN o.kind='trial_expired' THEN public.clinicx_effective_state(o.organization_id)='grace_period'
 WHEN o.kind='suspended' THEN public.clinicx_effective_state(o.organization_id)='suspended'
 WHEN o.kind='payment_failed' THEN e.details->>'status' IN ('pending','halted')
  AND EXISTS(SELECT 1 FROM public.webhook_events w WHERE w.authority_version='clinicx-v1' AND w.completed_at IS NOT NULL
   AND w.event_type='payment_failed' AND w.payload=e.details)
  AND EXISTS(SELECT 1 FROM public.clinicx_checkout_attempts a WHERE a.organization_id=o.organization_id
   AND a.provider_subscription_id=e.details->>'subscription_id'
   AND ((a.state='pending' AND s.access_source='free_trial') OR
    (s.status::text='past_due' AND s.gateway_subscription_id=a.provider_subscription_id
     AND to_timestamp((e.details->>'period_start')::bigint)>=s.current_period_end)))
 WHEN o.kind='payment_success' THEN public.clinicx_effective_state(o.organization_id)='active'
 ELSE false END
 FROM public.subscription_outbox o JOIN public.subscription_events e ON e.id=o.event_id JOIN public.subscriptions s ON s.id=e.subscription_id WHERE o.id=p_outbox
$$;
NOTIFY pgrst,'reload schema';
