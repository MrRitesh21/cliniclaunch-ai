-- Make settled invoice quote/period/money history immutable even for a trusted
-- handler's raw service-role parameters. This does not alter any existing row.
CREATE FUNCTION public.clinicx_immutable_settled_charge() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF OLD.authority_version='clinicx-v1' THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Canonical settled charge is immutable' USING ERRCODE='42501'; END IF;
  IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
   RAISE EXCEPTION 'Canonical settled charge quote/money/history is immutable' USING ERRCODE='42501'; END IF;
 ELSIF TG_OP='UPDATE' AND NEW.authority_version='clinicx-v1' THEN
  RAISE EXCEPTION 'Legacy money cannot acquire canonical provenance by update' USING ERRCODE='42501';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER clinicx_immutable_settled_charge BEFORE UPDATE OR DELETE ON public.transactions
 FOR EACH ROW EXECUTE FUNCTION public.clinicx_immutable_settled_charge();
CREATE TRIGGER clinicx_immutable_settled_charge BEFORE UPDATE OR DELETE ON public.invoices
 FOR EACH ROW EXECUTE FUNCTION public.clinicx_immutable_settled_charge();

CREATE FUNCTION public.clinicx_completed_charge_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p record; q jsonb; v_payment text;
BEGIN
 IF NEW.authority_version IS DISTINCT FROM 'clinicx-v1' THEN RETURN NULL; END IF;
 v_payment:=CASE WHEN TG_TABLE_NAME='transactions' THEN to_jsonb(NEW)->>'gateway_payment_id' ELSE to_jsonb(NEW)->>'canonical_payment_id' END;
 SELECT * INTO p FROM public.clinicx_admin_canonical_payments WHERE gateway_payment_id=v_payment;
 IF p.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.subscription_events e WHERE e.subscription_id=p.subscription_id
   AND e.organization_id=p.organization_id AND e.event_key='payment:'||v_payment AND e.kind='payment_success'
   AND e.details->>'payment_id'=v_payment AND e.details->>'invoice_id'=p.provider_invoice_id
   AND e.details->>'amount_paise'=p.canonical_amount_paise::text) THEN
  RAISE EXCEPTION 'Canonical money requires atomic completed settlement/invoice/audit' USING ERRCODE='42501'; END IF;
 q:=public.clinicx_charge_quote(p.provider_subscription_id,extract(epoch from p.period_start)::bigint,p.canonical_amount_paise);
 IF q->>'plan_id' IS DISTINCT FROM p.plan_id OR q->>'billing_cycle' IS DISTINCT FROM p.billing_cycle::text THEN
  RAISE EXCEPTION 'Canonical money requires the authorized per-charge quote' USING ERRCODE='42501'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER clinicx_completed_charge AFTER INSERT ON public.transactions
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.clinicx_completed_charge_guard();
CREATE CONSTRAINT TRIGGER clinicx_completed_charge AFTER INSERT ON public.invoices
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.clinicx_completed_charge_guard();

CREATE FUNCTION public.clinicx_immutable_completed_receipt() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.authority_version='clinicx-v1' AND OLD.completed_at IS NOT NULL THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Completed settlement receipt is immutable' USING ERRCODE='42501'; END IF;
  IF ROW(NEW.id,NEW.provider,NEW.event_type,NEW.payload,NEW.authority_version) IS DISTINCT FROM ROW(OLD.id,OLD.provider,OLD.event_type,OLD.payload,OLD.authority_version) OR NEW.completed_at IS NULL THEN
   RAISE EXCEPTION 'Completed settlement receipt evidence is immutable' USING ERRCODE='42501'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER clinicx_immutable_completed_receipt BEFORE UPDATE OR DELETE ON public.webhook_events
 FOR EACH ROW EXECUTE FUNCTION public.clinicx_immutable_completed_receipt();
REVOKE ALL ON FUNCTION public.clinicx_immutable_settled_charge(),public.clinicx_completed_charge_guard(),public.clinicx_immutable_completed_receipt() FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
