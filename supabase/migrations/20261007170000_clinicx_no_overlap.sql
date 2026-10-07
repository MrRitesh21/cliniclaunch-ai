-- Forward-only: a local cancellation flag is NOT proof the previous mandate stopped.
ALTER TABLE public.clinicx_checkout_attempts ADD COLUMN provider_terminal_at timestamptz;
CREATE FUNCTION public.clinicx_no_overlap_checkout() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.subscriptions;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-billing:'||NEW.organization_id,0));
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=NEW.organization_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.clinicx_recurring_commands WHERE organization_id=NEW.organization_id AND state IN ('reserved','uncertain','scheduled')) THEN
  RAISE EXCEPTION 'Recurring command must be reconciled before checkout' USING ERRCODE='55000'; END IF;
 IF s.gateway_subscription_id IS NOT NULL AND (s.access_source IS DISTINCT FROM 'verified_payment' OR
   s.current_period_end IS NULL OR s.current_period_end>now() OR NOT EXISTS(
   SELECT 1 FROM public.clinicx_checkout_attempts WHERE provider_subscription_id=s.gateway_subscription_id AND provider_terminal_at IS NOT NULL)) THEN
  RAISE EXCEPTION 'Existing mandate must be canonically terminal and paid-through access must end before replacement; use an in-place schedule where supported' USING ERRCODE='55000';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER clinicx_no_overlap BEFORE INSERT ON public.clinicx_checkout_attempts FOR EACH ROW EXECUTE FUNCTION public.clinicx_no_overlap_checkout();
REVOKE ALL ON FUNCTION public.clinicx_no_overlap_checkout() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
