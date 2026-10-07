-- Read-only financial DTOs. Never run reconciliation or provider monetary writes from a GET.
CREATE FUNCTION public.clinicx_renewal_context(p_org uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.subscriptions;a public.clinicx_checkout_attempts;c public.clinicx_recurring_commands;pending public.clinicx_recurring_commands;v_reason text;v_state text;
BEGIN
 PERFORM public.clinicx_billing_current(p_org);
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=p_org;
 SELECT * INTO a FROM public.clinicx_checkout_attempts WHERE provider_subscription_id=s.gateway_subscription_id;
 IF a.id IS NULL OR s.access_source IS DISTINCT FROM 'verified_payment' THEN RETURN jsonb_build_object('provider_subscription_id',NULL); END IF;
 SELECT * INTO c FROM public.clinicx_recurring_commands WHERE provider_subscription_id=a.provider_subscription_id AND kind='change' AND state='applied' ORDER BY effective_at DESC,id DESC LIMIT 1;
 SELECT * INTO pending FROM public.clinicx_recurring_commands WHERE organization_id=p_org AND kind='change' AND state='scheduled' ORDER BY effective_at DESC,id DESC LIMIT 1;
 SELECT state INTO v_state FROM public.clinicx_recurring_commands WHERE organization_id=p_org AND state IN ('reserved','uncertain','scheduled') ORDER BY created_at DESC,id DESC LIMIT 1;
 SELECT reason INTO v_reason FROM public.clinicx_recurring_commands WHERE organization_id=p_org AND kind='cancel' AND state='confirmed' ORDER BY created_at DESC,id DESC LIMIT 1;
 RETURN jsonb_build_object('provider_subscription_id',a.provider_subscription_id,'provider_plan_id',coalesce(c.provider_plan_id,a.provider_plan_id),
  'plan_id',coalesce(c.plan_id,a.plan_id),'billing_cycle',coalesce(c.billing_cycle,a.billing_cycle),'amount_paise',coalesce(c.amount_paise,a.amount_paise),
  'cancel_at_period_end',s.cancel_at_period_end,'command_state',v_state,'reason',v_reason,
  'pending_change',CASE WHEN pending.id IS NULL THEN NULL ELSE jsonb_build_object('id',pending.id,'plan_id',pending.plan_id,'billing_cycle',pending.billing_cycle,'provider_plan_id',pending.provider_plan_id,'amount_paise',pending.amount_paise,'effective_at',pending.effective_at) END);
END $$;
CREATE FUNCTION public.clinicx_billing_history_page(p_org uuid,p_kind text,p_before_time timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL,p_limit integer DEFAULT 50) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE rows jsonb;v_more boolean;v_entries jsonb;v_last jsonb;
BEGIN
 PERFORM public.clinicx_billing_current(p_org);
 IF p_kind IS NULL OR p_kind NOT IN ('payments','invoices','legacy_invoices') OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR (p_before_time IS NULL)<>(p_before_id IS NULL) THEN RAISE EXCEPTION 'Invalid billing page/cursor'; END IF;
 IF p_kind='payments' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC,r.id DESC),'[]') INTO rows FROM
  (SELECT id,gateway_payment_id AS payment_id,provider_invoice_id,canonical_amount_paise AS amount_paise,status,created_at,
   canonical_period_start AS period_start,canonical_period_end AS period_end,canonical_provider_plan_id AS provider_plan_id,plan AS plan_id,billing_cycle
   FROM public.transactions WHERE organization_id=p_org AND authority_version='clinicx-v1' AND (p_before_time IS NULL OR (created_at,id)<(p_before_time,p_before_id)) ORDER BY created_at DESC,id DESC LIMIT p_limit+1) r;
 ELSE
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC,r.id DESC),'[]') INTO rows FROM
  (SELECT id,invoice_number,canonical_payment_id,razorpay_invoice_id AS provider_invoice_id,canonical_amount_paise AS amount_paise,
   CASE WHEN authority_version IS DISTINCT FROM 'clinicx-v1' THEN amount ELSE NULL END AS historical_amount,status,paid_at,created_at,
   canonical_period_start AS period_start,canonical_period_end AS period_end,canonical_provider_plan_id AS provider_plan_id,
   canonical_plan_id AS plan_id,canonical_billing_cycle AS billing_cycle
   FROM public.invoices WHERE organization_id=p_org AND (CASE WHEN p_kind='invoices' THEN authority_version='clinicx-v1' ELSE authority_version IS DISTINCT FROM 'clinicx-v1' END)
    AND (p_before_time IS NULL OR (created_at,id)<(p_before_time,p_before_id)) ORDER BY created_at DESC,id DESC LIMIT p_limit+1) r;
 END IF;
 v_more:=jsonb_array_length(rows)>p_limit;
 SELECT coalesce(jsonb_agg(value ORDER BY ordinality),'[]') INTO v_entries FROM jsonb_array_elements(rows) WITH ORDINALITY WHERE ordinality<=p_limit;
 v_last:=v_entries->(jsonb_array_length(v_entries)-1);
 RETURN jsonb_build_object('kind',p_kind,'currency','INR','amount_unit',CASE WHEN p_kind='legacy_invoices' THEN 'unclassified' ELSE 'paise' END,
  'entries',v_entries,'has_more',v_more,'next_cursor',CASE WHEN v_more THEN jsonb_build_object('created_at',v_last->>'created_at','id',v_last->>'id') ELSE NULL END);
END $$;
CREATE FUNCTION public.clinicx_invoice_detail(p_org uuid,p_invoice uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 PERFORM public.clinicx_billing_current(p_org);
 SELECT jsonb_build_object('id',i.id,'organization_id',i.organization_id,'invoice_number',i.invoice_number,
  'payment_id',i.canonical_payment_id,'provider_invoice_id',i.razorpay_invoice_id,'provider_subscription_id',a.provider_subscription_id,
  'amount_paise',i.canonical_amount_paise,'currency',i.currency,'amount_unit','paise','status',i.status,'paid_at',i.paid_at,
  'period_start',i.canonical_period_start,'period_end',i.canonical_period_end,'provider_plan_id',i.canonical_provider_plan_id,
  'plan_id',i.canonical_plan_id,'billing_cycle',i.canonical_billing_cycle,'authority_version',i.authority_version)
 INTO result FROM public.invoices i JOIN public.transactions t ON t.organization_id=i.organization_id AND t.gateway_payment_id=i.canonical_payment_id AND t.authority_version='clinicx-v1'
 JOIN public.clinicx_checkout_attempts a ON a.id=t.checkout_attempt_id AND a.organization_id=i.organization_id
 WHERE i.id=p_invoice AND i.organization_id=p_org AND i.authority_version='clinicx-v1';
 IF result IS NULL THEN RAISE EXCEPTION 'Canonical tenant invoice not found' USING ERRCODE='42501'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.clinicx_renewal_context(uuid),public.clinicx_billing_history_page(uuid,text,timestamptz,uuid,integer),public.clinicx_invoice_detail(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clinicx_renewal_context(uuid),public.clinicx_billing_history_page(uuid,text,timestamptz,uuid,integer),public.clinicx_invoice_detail(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
