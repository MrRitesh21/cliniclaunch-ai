-- Reuse the existing billing reminder UI/store, with event-level idempotency.
ALTER TABLE public.subscription_reminders ADD COLUMN IF NOT EXISTS subscription_event_id uuid UNIQUE REFERENCES public.subscription_events(id) ON DELETE RESTRICT;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.subscription_reminders FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.clinicx_billing_reminders(p_org uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.clinicx_billing_current(p_org);
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM (SELECT id,kind,severity,title,body,created_at FROM public.subscription_reminders
  WHERE organization_id=p_org AND dismissed_at IS NULL ORDER BY created_at DESC LIMIT 100) r),'[]');
END $$;
CREATE FUNCTION public.clinicx_dismiss_billing_reminder(p_org uuid,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.clinicx_billing_current(p_org);
 UPDATE public.subscription_reminders SET dismissed_at=now() WHERE id=p_id AND organization_id=p_org;
 RETURN jsonb_build_object('ok',FOUND);
END $$;
CREATE FUNCTION public.clinicx_billing_reminder_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.subscriptions;
BEGIN
 SELECT * INTO s FROM public.subscriptions WHERE id=NEW.subscription_id;
 IF NEW.kind='payment_success' AND s.status='active' THEN
  UPDATE public.subscription_reminders SET dismissed_at=now() WHERE organization_id=NEW.organization_id AND dismissed_at IS NULL
    AND kind IN ('payment_failed','renewal_pending','autopay_halted');
 ELSIF (NEW.kind='subscription_cancelled' AND s.gateway_subscription_id=NEW.details->>'subscription_id') OR
  (NEW.kind='payment_failed' AND ((s.gateway_subscription_id=NEW.details->>'subscription_id' AND s.status='past_due') OR
   EXISTS(SELECT 1 FROM public.clinicx_checkout_attempts a WHERE a.organization_id=NEW.organization_id AND a.provider_subscription_id=NEW.details->>'subscription_id' AND a.state='pending'))) THEN
  INSERT INTO public.subscription_reminders(organization_id,kind,severity,title,body,subscription_event_id)
   VALUES(NEW.organization_id,NEW.kind,'warning',CASE WHEN NEW.kind='payment_failed' THEN 'Payment could not be confirmed' ELSE 'Subscription cancelled' END,
    CASE WHEN NEW.kind='payment_failed' THEN 'Update your payment method or retry. Your clinic data is safe.' ELSE 'Renewal is stopped. Access remains available until the paid-through date.' END,NEW.id)
   ON CONFLICT(subscription_event_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER clinicx_billing_reminder AFTER INSERT ON public.subscription_events FOR EACH ROW EXECUTE FUNCTION public.clinicx_billing_reminder_event();
REVOKE ALL ON FUNCTION public.clinicx_billing_reminders(uuid),public.clinicx_dismiss_billing_reminder(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clinicx_billing_reminders(uuid),public.clinicx_dismiss_billing_reminder(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.clinicx_billing_reminder_event() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
