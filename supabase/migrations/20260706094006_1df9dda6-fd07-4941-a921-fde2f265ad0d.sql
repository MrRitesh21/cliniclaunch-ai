
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.expire_lapsed_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.subscriptions
     SET status = 'expired',
         updated_at = now()
   WHERE status IN ('active','trialing','past_due')
     AND current_period_end IS NOT NULL
     AND current_period_end < now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- Remove any prior schedule with the same name, then (re)schedule hourly.
DO $$
BEGIN
  PERFORM cron.unschedule('expire-lapsed-subscriptions');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'expire-lapsed-subscriptions',
  '5 * * * *',
  $$SELECT public.expire_lapsed_subscriptions();$$
);
