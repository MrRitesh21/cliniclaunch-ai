-- Read-only inventory. Deployment must also compare a restored/live schema before applying migrations.
CREATE FUNCTION public.clinicx_payment_preflight() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_inventory jsonb:='[]';
BEGIN
 IF to_regclass('public.subscription_plans') IS NOT NULL THEN
  EXECUTE 'SELECT coalesce(jsonb_agg(jsonb_build_object(''slug'',slug,''monthly_id'',razorpay_plan_id_monthly,''yearly_id'',razorpay_plan_id_yearly,''historical_monthly_amount'',price_monthly,''historical_yearly_amount'',price_yearly)),''[]'') FROM public.subscription_plans' INTO v_inventory;
 END IF;
 RETURN jsonb_build_object('requires_live_provider_reconciliation',true,'automatically_rewrites_history',false,'canonical_amount_unit','paise',
  'historical_unclassified_transactions',(SELECT count(*) FROM public.transactions WHERE authority_version IS DISTINCT FROM 'clinicx-v1'),
  'historical_unclassified_invoices',(SELECT count(*) FROM public.invoices WHERE authority_version IS DISTINCT FROM 'clinicx-v1'),
  'duplicate_legacy_payment_ids',(SELECT count(*) FROM (SELECT payment_id FROM (
    SELECT id,gateway_payment_id AS payment_id FROM public.transactions WHERE gateway_payment_id IS NOT NULL
    UNION SELECT id,razorpay_payment_id FROM public.transactions WHERE razorpay_payment_id IS NOT NULL
   ) ids GROUP BY payment_id HAVING count(*)>1) d),
  'contradictory_legacy_payment_ids',(SELECT count(*) FROM public.transactions WHERE gateway_payment_id IS NOT NULL AND razorpay_payment_id IS NOT NULL AND gateway_payment_id<>razorpay_payment_id),
  'duplicate_provider_invoice_ids',(SELECT count(*) FROM (SELECT razorpay_invoice_id FROM public.invoices WHERE razorpay_invoice_id IS NOT NULL GROUP BY razorpay_invoice_id HAVING count(*)>1) d),
  'duplicate_provider_subscription_ids',(SELECT count(*) FROM (SELECT coalesce(gateway_subscription_id,razorpay_subscription_id) FROM public.subscriptions WHERE coalesce(gateway_subscription_id,razorpay_subscription_id) IS NOT NULL GROUP BY 1 HAVING count(*)>1) d),
  'legacy_receipts_without_verified_completion',(SELECT count(*) FROM public.webhook_events WHERE authority_version IS DISTINCT FROM 'clinicx-v1'),
  'unresolved_checkout_attempts',(SELECT count(*) FROM public.clinicx_checkout_attempts WHERE state IN ('creating','needs_reconciliation')),
  'needs_review_jobs',(SELECT count(*) FROM public.clinicx_billing_jobs WHERE needs_review AND completed_at IS NULL),
  'legacy_provider_inventory',v_inventory,'pricing_baseline',public.clinicx_pricing_preflight(),
  'reviewed_mappings',coalesce((SELECT jsonb_agg(jsonb_build_object('plan_id',m.plan_id,'billing_cycle',m.billing_cycle,'provider_plan_id',m.provider_plan_id,'amount_paise',m.amount_paise,
    'local_price_matches',(CASE WHEN m.billing_cycle='monthly' THEN p.monthly_price ELSE p.yearly_price END)::bigint*100=m.amount_paise))
    FROM public.clinicx_provider_prices m JOIN public.plans p ON p.id=m.plan_id),'[]'));
END $$;
REVOKE ALL ON FUNCTION public.clinicx_payment_preflight() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_payment_preflight() TO service_role;
NOTIFY pgrst,'reload schema';
