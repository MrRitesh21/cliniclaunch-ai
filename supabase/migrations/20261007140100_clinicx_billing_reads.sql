-- Separate actor-scoped billing reads from service-only canonical provider lookup.
CREATE FUNCTION public.clinicx_checkout_context(p_subscription text,p_org uuid DEFAULT NULL,p_attempt uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.clinicx_checkout_attempts;
BEGIN
 SELECT * INTO a FROM public.clinicx_checkout_attempts WHERE provider_subscription_id=p_subscription;
 IF a.id IS NULL OR (p_org IS NOT NULL AND a.organization_id<>p_org) OR (p_attempt IS NOT NULL AND a.id<>p_attempt) OR
  auth.uid() IS NULL OR NOT public.has_org_role(a.organization_id,auth.uid(),ARRAY['owner','admin']::public.org_role[]) THEN
  RAISE EXCEPTION 'Billing owner/admin binding required' USING ERRCODE='42501'; END IF;
 RETURN to_jsonb(a);
END $$;
CREATE FUNCTION public.clinicx_provider_context(p_subscription text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.clinicx_checkout_attempts;
BEGIN
 SELECT * INTO a FROM public.clinicx_checkout_attempts WHERE provider_subscription_id=p_subscription;
 IF a.id IS NULL THEN RAISE EXCEPTION 'Unbound subscription' USING ERRCODE='42501'; END IF;
 RETURN to_jsonb(a);
END $$;
CREATE FUNCTION public.clinicx_checkout_uncertain(p_attempt uuid,p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.clinicx_checkout_attempts SET state='needs_reconciliation',updated_at=now() WHERE id=p_attempt AND actor_id=p_actor AND state='creating';
 RETURN jsonb_build_object('requires_reconciliation',true);
END $$;
CREATE FUNCTION public.clinicx_billing_current(p_org uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.subscriptions;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_org_role(p_org,auth.uid(),ARRAY['owner','admin']::public.org_role[]) THEN
  RAISE EXCEPTION 'Billing owner/admin required' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=p_org;
 RETURN jsonb_build_object('active',s.access_source='verified_payment' AND s.current_period_end>now() AND s.status IN ('active','cancelled','past_due'),
  'status',s.status,'current_period_end',s.current_period_end,'provider_subscription_id',CASE WHEN s.access_source='verified_payment' THEN s.gateway_subscription_id ELSE NULL END);
END $$;
CREATE FUNCTION public.clinicx_billing_history(p_org uuid,p_cursor timestamptz DEFAULT NULL,p_limit integer DEFAULT 50) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.clinicx_billing_current(p_org);
 IF p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid page limit'; END IF;
 RETURN jsonb_build_object('currency','INR','amount_unit','paise','payments',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM
  (SELECT id,gateway_payment_id AS payment_id,canonical_amount_paise AS amount_paise,status,created_at FROM public.transactions WHERE organization_id=p_org AND authority_version='clinicx-v1' AND (p_cursor IS NULL OR created_at<p_cursor) ORDER BY created_at DESC,id LIMIT p_limit) t),'[]'),
  'invoices',coalesce((SELECT jsonb_agg(to_jsonb(i)) FROM
  (SELECT id,invoice_number,canonical_payment_id,canonical_amount_paise AS amount_paise,status,paid_at,created_at FROM public.invoices WHERE organization_id=p_org AND authority_version='clinicx-v1' AND (p_cursor IS NULL OR created_at<p_cursor) ORDER BY created_at DESC,id LIMIT p_limit) i),'[]'),
  'legacy_invoices',coalesce((SELECT jsonb_agg(to_jsonb(i)) FROM
  (SELECT id,invoice_number,amount AS historical_amount,authority_version,created_at FROM public.invoices WHERE organization_id=p_org AND authority_version IS DISTINCT FROM 'clinicx-v1' AND (p_cursor IS NULL OR created_at<p_cursor) ORDER BY created_at DESC,id LIMIT p_limit) i),'[]'));
END $$;
REVOKE ALL ON FUNCTION public.clinicx_checkout_context(text,uuid,uuid),public.clinicx_billing_current(uuid),public.clinicx_billing_history(uuid,timestamptz,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clinicx_checkout_context(text,uuid,uuid),public.clinicx_billing_current(uuid),public.clinicx_billing_history(uuid,timestamptz,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.clinicx_provider_context(text),public.clinicx_checkout_uncertain(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_provider_context(text),public.clinicx_checkout_uncertain(uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
