-- Forward reporting fix: bind each actual completed settlement to its own immutable
-- invoice quote, NOT the initial checkout amount/plan or current price catalog.
-- No identifier, period, money, legacy provenance or historical row is rewritten.
CREATE OR REPLACE VIEW public.clinicx_admin_canonical_payments AS
SELECT t.id,t.organization_id,t.subscription_id,t.created_at,t.gateway_payment_id,
 t.provider_invoice_id,t.canonical_amount_paise,
 coalesce(i.canonical_plan_id,a.plan_id) AS plan_id,
 coalesce(i.canonical_billing_cycle,a.billing_cycle::text)::public.billing_cycle AS billing_cycle,
 a.provider_subscription_id,
 to_timestamp((w.payload->>'period_start')::bigint) AS period_start,
 to_timestamp((w.payload->>'period_end')::bigint) AS period_end
FROM public.transactions t
JOIN public.clinicx_checkout_attempts a ON a.id=t.checkout_attempt_id
 AND a.organization_id=t.organization_id
JOIN public.subscriptions s ON s.id=t.subscription_id AND s.organization_id=t.organization_id
JOIN public.invoices i ON i.canonical_payment_id=t.gateway_payment_id
 AND i.razorpay_invoice_id=t.provider_invoice_id AND i.subscription_id=t.subscription_id
 AND i.organization_id=t.organization_id AND i.authority_version='clinicx-v1'
 AND i.status::text='paid' AND i.currency='INR'
 AND i.canonical_amount_paise=t.canonical_amount_paise AND i.amount=t.canonical_amount_paise
JOIN LATERAL (
 SELECT e.payload FROM public.webhook_events e
 WHERE e.authority_version='clinicx-v1' AND e.provider='razorpay' AND e.completed_at IS NOT NULL
 AND e.payload->>'payment_id'=t.gateway_payment_id
 AND e.payload->>'invoice_id'=t.provider_invoice_id
 AND e.payload->>'subscription_id'=a.provider_subscription_id
 AND e.payload->>'status'='captured' AND e.payload->>'currency'='INR'
 AND e.payload->>'amount_paise'=t.canonical_amount_paise::text
 AND e.payload->>'provider_plan_id'=coalesce(i.canonical_provider_plan_id,a.provider_plan_id)
 AND e.payload->>'period_start' ~ '^[0-9]{1,11}$'
 AND e.payload->>'period_end' ~ '^[0-9]{1,11}$'
 ORDER BY e.completed_at,e.id LIMIT 1
) w ON true
WHERE t.authority_version='clinicx-v1' AND t.status='captured' AND t.gateway='razorpay'
 AND t.currency='INR' AND t.canonical_amount_paise>0 AND t.amount=t.canonical_amount_paise
 AND t.plan=coalesce(i.canonical_plan_id,a.plan_id)
 AND t.billing_cycle=coalesce(i.canonical_billing_cycle,a.billing_cycle::text)
 AND coalesce(i.canonical_billing_cycle,a.billing_cycle::text) IN ('monthly','yearly')
 AND (CASE WHEN w.payload->>'period_start' ~ '^[0-9]{1,11}$' AND w.payload->>'period_end' ~ '^[0-9]{1,11}$'
   THEN (w.payload->>'period_end')::bigint>(w.payload->>'period_start')::bigint ELSE false END)
 AND (
 -- Pre-recurring authority has no quote-history columns. Accept ONLY an exact
 -- original checkout quote with completed settlement AND its canonical invoice.
 (i.canonical_plan_id IS NULL AND i.canonical_billing_cycle IS NULL
  AND i.canonical_provider_plan_id IS NULL AND i.canonical_period_start IS NULL AND i.canonical_period_end IS NULL
  AND t.canonical_provider_plan_id IS NULL AND t.canonical_period_start IS NULL AND t.canonical_period_end IS NULL
  AND a.amount_paise=t.canonical_amount_paise)
 OR
 -- All new recurring charges require matching per-charge snapshots. Never
 -- fall back to checkout when a snapshot is partial or contradictory.
 (i.canonical_plan_id IS NOT NULL AND i.canonical_billing_cycle IS NOT NULL
  AND i.canonical_provider_plan_id=t.canonical_provider_plan_id
  AND i.canonical_period_start=t.canonical_period_start AND i.canonical_period_end=t.canonical_period_end
  AND i.canonical_period_start=to_timestamp((w.payload->>'period_start')::bigint)
  AND i.canonical_period_end=to_timestamp((w.payload->>'period_end')::bigint))
 );
REVOKE ALL ON public.clinicx_admin_canonical_payments FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
