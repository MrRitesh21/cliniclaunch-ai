-- Forward-only read authority. No historical payment/trial provenance is invented.
-- Requires 2026100713* subscription and 2026100714* canonical billing authority.
CREATE TABLE public.clinicx_analytics_cohorts (
 organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE RESTRICT,
 cohort text NOT NULL CHECK(cohort IN ('production','test','internal','fraud')),
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 500),
 reviewed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clinicx_analytics_cohorts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinicx_analytics_cohorts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.clinicx_analytics_cohorts TO service_role;
-- No inferred email/domain exclusions. Missing reviewed cohort means production.
CREATE INDEX clinicx_admin_clinics_page ON public.clinics(created_at DESC,id);
CREATE INDEX clinicx_admin_events_page ON public.subscription_events(organization_id,recorded_at DESC,id);
CREATE INDEX clinicx_admin_receipt_payment ON public.webhook_events((payload->>'payment_id')) WHERE authority_version='clinicx-v1' AND completed_at IS NOT NULL;

CREATE FUNCTION public.clinicx_admin_assert() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
  RAISE EXCEPTION 'Verified platform admin required' USING ERRCODE='42501';
 END IF;
END $$;

-- Private, canonical SaaS payments only. Completed settlement evidence supplies
-- each captured invoice's own period, not the latest subscription period.
CREATE VIEW public.clinicx_admin_canonical_payments AS
SELECT t.id,t.organization_id,t.subscription_id,t.created_at,t.gateway_payment_id,
 t.provider_invoice_id,t.canonical_amount_paise,a.plan_id,a.billing_cycle,
 a.provider_subscription_id,
 to_timestamp((w.payload->>'period_start')::bigint) AS period_start,
 to_timestamp((w.payload->>'period_end')::bigint) AS period_end
FROM public.transactions t JOIN public.clinicx_checkout_attempts a ON a.id=t.checkout_attempt_id
 AND a.organization_id=t.organization_id AND a.amount_paise=t.canonical_amount_paise
JOIN LATERAL (
 SELECT e.payload FROM public.webhook_events e
 WHERE e.authority_version='clinicx-v1' AND e.completed_at IS NOT NULL
 AND e.payload->>'payment_id'=t.gateway_payment_id
 AND e.payload->>'invoice_id'=t.provider_invoice_id
 AND e.payload->>'subscription_id'=a.provider_subscription_id
 AND e.payload->>'status'='captured' AND e.payload->>'currency'='INR'
 AND e.payload->>'amount_paise'=t.canonical_amount_paise::text
 AND e.payload->>'period_start' ~ '^[0-9]{1,11}$' AND e.payload->>'period_end' ~ '^[0-9]{1,11}$'
 ORDER BY e.completed_at,e.id LIMIT 1
) w ON true
WHERE t.authority_version='clinicx-v1' AND t.status='captured' AND t.gateway='razorpay'
 AND t.currency='INR' AND t.canonical_amount_paise>0;
REVOKE ALL ON public.clinicx_admin_canonical_payments FROM PUBLIC,anon,authenticated;

-- One customer = one organization with at least one clinic. Clinic count and
-- customer/subscription count are deliberately different units.
CREATE FUNCTION public.clinicx_admin_paid_at(p_at timestamptz) RETURNS TABLE(
 organization_id uuid,subscription_id uuid,plan_id text,billing_cycle text,amount_paise bigint,mrr_inr numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT s.organization_id,s.id,p.plan_id,p.billing_cycle::text,p.canonical_amount_paise,
 p.canonical_amount_paise::numeric/100/CASE WHEN p.billing_cycle::text='yearly' THEN 12 ELSE 1 END
 FROM public.subscriptions s
 JOIN LATERAL (SELECT cp.* FROM public.clinicx_admin_canonical_payments cp
  WHERE cp.subscription_id=s.id AND cp.period_start<=p_at AND p_at<cp.period_end
  ORDER BY cp.period_start DESC,cp.created_at DESC,cp.id DESC LIMIT 1) p ON true
 WHERE EXISTS(SELECT 1 FROM public.clinics c WHERE c.organization_id=s.organization_id)
 AND NOT EXISTS(SELECT 1 FROM public.clinicx_analytics_cohorts x WHERE x.organization_id=s.organization_id AND x.cohort<>'production')
 -- For present-state MRR require effective verified paid-through authority.
 -- Historical opening cohort is captured coverage; current status cannot rewrite history.
 AND (p_at<now() OR (s.access_source='verified_payment'
  AND s.status::text IN ('active','past_due','cancelled')
  AND s.current_period_start<=p_at AND p_at<s.current_period_end
  AND s.gateway_subscription_id=p.provider_subscription_id
  AND s.plan_id=p.plan_id AND s.billing_cycle=p.billing_cycle
  AND s.current_period_start=p.period_start AND s.current_period_end=p.period_end));
$$;
REVOKE ALL ON FUNCTION public.clinicx_admin_paid_at(timestamptz) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.clinicx_admin_billing_stats() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public SET timezone='UTC' AS $$
DECLARE v jsonb;
BEGIN
 PERFORM public.clinicx_admin_assert();
 WITH eligible AS (
  SELECT c.* FROM public.clinics c WHERE NOT EXISTS(SELECT 1 FROM public.clinicx_analytics_cohorts x WHERE x.organization_id=c.organization_id AND x.cohort<>'production')
 ), subs AS (
  SELECT s.*,public.clinicx_effective_state(s.organization_id) AS effective_state FROM public.subscriptions s
  WHERE EXISTS(SELECT 1 FROM eligible c WHERE c.organization_id=s.organization_id)
 ), paid AS (SELECT * FROM public.clinicx_admin_paid_at(now())),
 opening AS (SELECT * FROM public.clinicx_admin_paid_at(now()-interval '30 days')),
 matured AS (SELECT * FROM subs WHERE trial_started_at IS NOT NULL AND trial_ends_at<=now()-interval '7 days'),
 converted AS (SELECT s.id FROM matured s WHERE EXISTS(SELECT 1 FROM public.clinicx_admin_canonical_payments p
  WHERE p.subscription_id=s.id AND p.created_at>=s.trial_started_at AND p.created_at<=s.trial_ends_at+interval '7 days')),
 lost AS (SELECT o.organization_id FROM opening o WHERE NOT EXISTS(SELECT 1 FROM paid p WHERE p.organization_id=o.organization_id)),
 failures AS (SELECT e.* FROM public.subscription_events e JOIN subs s ON s.id=e.subscription_id
  WHERE e.kind='payment_failed' AND e.recorded_at>now()-interval '30 days'),
 dist AS (SELECT plan_id,count(*) AS customers FROM paid GROUP BY plan_id),
 states AS (SELECT effective_state,count(*) AS customers FROM subs GROUP BY effective_state),
 daily AS (SELECT d::date AS date,(SELECT count(*) FROM eligible c WHERE c.created_at>=d AND c.created_at<d+interval '1 day') AS count
  FROM generate_series(date_trunc('day',now())-interval '29 days',date_trunc('day',now()),interval '1 day') d)
 SELECT jsonb_build_object(
 'asOf',now(),'timezone','UTC','totalClinics',(SELECT count(*) FROM eligible),
 'totalDoctors',(SELECT count(*) FROM eligible),'totalCustomers',(SELECT count(DISTINCT organization_id) FROM eligible),
 'excludedClinics',(SELECT count(*) FROM public.clinics)-(SELECT count(*) FROM eligible),
 'newThisWeek',(SELECT count(*) FROM eligible WHERE created_at>=now()-interval '7 days'),
 'newSignupsToday',(SELECT count(*) FROM eligible WHERE created_at>=date_trunc('day',now())),
 'paidCustomers',(SELECT count(*) FROM paid),'activeSubs',(SELECT count(*) FROM paid),
 'trialSubs',(SELECT count(*) FROM subs WHERE effective_state='trialing'),
 'trialsEndingSoon',(SELECT count(*) FROM subs WHERE effective_state='trialing' AND trial_ends_at<=now()+interval '7 days'),
 'expiredTrials',(SELECT count(*) FROM subs s WHERE trial_started_at IS NOT NULL AND trial_ends_at<=now() AND NOT EXISTS(SELECT 1 FROM public.clinicx_admin_canonical_payments p WHERE p.subscription_id=s.id)),
 'mrr',round((SELECT coalesce(sum(mrr_inr),0) FROM paid),2),
 'arr',round((SELECT coalesce(sum(mrr_inr),0)*12 FROM paid),2),
 'averageRevenuePerClinic',round((SELECT coalesce(sum(mrr_inr),0) FROM paid)/nullif((SELECT count(*) FROM paid),0),2),
 'eligibleCompletedTrials',(SELECT count(*) FROM matured),'convertedTrials',(SELECT count(*) FROM converted),
 'conversionRate',round((SELECT count(*) FROM converted)*100.0/nullif((SELECT count(*) FROM matured),0),2),
 'openingPaidCustomers',(SELECT count(*) FROM opening),'churnedCustomers',(SELECT count(*) FROM lost),
 'expiredThisMonth',(SELECT count(*) FROM lost),
 'churnRate',round((SELECT count(*) FROM lost)*100.0/nullif((SELECT count(*) FROM opening),0),2),
 'failedPayments',(SELECT count(*) FROM failures),'failedPaymentCustomers',(SELECT count(DISTINCT organization_id) FROM failures),
 'legacyUnverifiedSubscriptions',(SELECT count(*) FROM subs WHERE access_source='legacy_unverified'),
 'planDistribution',coalesce((SELECT jsonb_agg(jsonb_build_object('planId',plan_id,'customers',customers) ORDER BY plan_id) FROM dist),'[]'),
 'statusDistribution',coalesce((SELECT jsonb_agg(jsonb_build_object('status',effective_state,'customers',customers) ORDER BY effective_state) FROM states),'[]'),
 'recentClinics',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM (SELECT id,clinic_name,doctor_name,specialization,address,created_at,slug FROM eligible ORDER BY created_at DESC,id LIMIT 5) r),'[]'),
 'expiringSubs',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM (SELECT id,organization_id,effective_state AS status,trial_ends_at,current_period_end,plan_id FROM subs WHERE effective_state='trialing' AND trial_ends_at<=now()+interval '7 days' ORDER BY trial_ends_at,id LIMIT 5) r),'[]'),
 'signupsDaily',(SELECT jsonb_agg(to_jsonb(daily) ORDER BY date) FROM daily),
 'recentTransactions',coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM (SELECT p.id,p.plan_id AS plan,p.billing_cycle,p.canonical_amount_paise::numeric/100 AS amount,p.created_at FROM public.clinicx_admin_canonical_payments p JOIN subs s ON s.id=p.subscription_id ORDER BY p.created_at DESC,p.id LIMIT 5) r),'[]')
 ) INTO v;
 RETURN v;
END $$;

CREATE FUNCTION public.clinicx_admin_customers(p_page integer DEFAULT 0,p_limit integer DEFAULT 50,p_filter text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public SET timezone='UTC' AS $$
DECLARE v jsonb;
BEGIN
 PERFORM public.clinicx_admin_assert();
 IF p_page IS NULL OR p_page NOT BETWEEN 0 AND 100000 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR
 (p_filter IS NOT NULL AND p_filter NOT IN ('trialing','ending_soon','paid','expired_trial','past_due','excluded')) THEN
 RAISE EXCEPTION 'Invalid customer page/filter' USING ERRCODE='22023'; END IF;
 WITH paid AS (SELECT * FROM public.clinicx_admin_paid_at(now())), rows AS (
 SELECT c.id AS "clinicId",c.id::text AS "id",s.id AS "subscriptionId",s.organization_id AS "organizationId",
 c.clinic_name AS "clinicName",c.doctor_name AS "doctorName",c.created_at AS joined,
 s.plan_id AS "planId",coalesce(p.name,'No Plan') AS plan,s.status::text AS "storedStatus",
 public.clinicx_effective_state(c.organization_id) AS status,s.current_period_start AS start,
 s.current_period_end AS "renewalDate",coalesce(s.current_period_end,s.trial_ends_at) AS "end",
 s.trial_started_at AS "trialStart",s.trial_ends_at AS "trialEnd",s.grace_ends_at AS "graceEnd",
 s.billing_cycle::text AS "billingCycle",s.cancel_at_period_end AS "cancelAtPeriodEnd",
 coalesce(s.gateway_subscription_id,s.razorpay_subscription_id,'—') AS "razorpayId",
 s.access_source AS "accessSource",coalesce(x.cohort,'production') AS cohort,
 pa.organization_id IS NOT NULL AS paid,pa.amount_paise::numeric/100 AS amount,
 pa.mrr_inr AS "monthlyRecurringInr"
 FROM public.clinics c LEFT JOIN public.subscriptions s ON s.organization_id=c.organization_id
 LEFT JOIN public.plans p ON p.id=s.plan_id LEFT JOIN public.clinicx_analytics_cohorts x ON x.organization_id=c.organization_id
 LEFT JOIN paid pa ON pa.organization_id=c.organization_id
 ), filtered AS (SELECT * FROM rows r WHERE p_filter IS NULL OR
  (p_filter='paid' AND r.paid) OR (p_filter='trialing' AND r.status='trialing') OR
  (p_filter='ending_soon' AND r.status='trialing' AND r."trialEnd"<=now()+interval '7 days') OR
  (p_filter='expired_trial' AND r."trialEnd"<=now() AND NOT EXISTS(SELECT 1 FROM public.clinicx_admin_canonical_payments cp WHERE cp.subscription_id=r."subscriptionId")) OR
  (p_filter='past_due' AND r."storedStatus"='past_due') OR (p_filter='excluded' AND r.cohort<>'production'))
 SELECT jsonb_build_object('subscriptions',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.joined DESC,q."clinicId") FROM
 (SELECT * FROM filtered ORDER BY joined DESC,"clinicId" OFFSET p_page*p_limit LIMIT p_limit) q),'[]'),
 'totalCount',(SELECT count(*) FROM filtered),'page',p_page,'pageSize',p_limit,
 'hasMore',(SELECT count(*) FROM filtered)>(p_page+1)*p_limit,
 'asOf',now(),'timezone','UTC') INTO v;
 RETURN v;
END $$;

CREATE FUNCTION public.clinicx_admin_customer(p_clinic uuid,p_payment_page integer DEFAULT 0,p_event_page integer DEFAULT 0,p_limit integer DEFAULT 50) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public SET timezone='UTC' AS $$
DECLARE c public.clinics; s public.subscriptions; v_payments jsonb; v_events jsonb; v_payment_count bigint; v_event_count bigint; v_plan jsonb;
BEGIN
 PERFORM public.clinicx_admin_assert();
 IF p_clinic IS NULL OR p_payment_page IS NULL OR p_event_page IS NULL OR p_payment_page NOT BETWEEN 0 AND 100000 OR p_event_page NOT BETWEEN 0 AND 100000 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
 RAISE EXCEPTION 'Invalid detail page' USING ERRCODE='22023'; END IF;
 SELECT * INTO c FROM public.clinics WHERE id=p_clinic;
 IF c.id IS NULL THEN RAISE EXCEPTION 'Clinic not found' USING ERRCODE='P0002'; END IF;
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=c.organization_id;
 SELECT jsonb_build_object('id',id,'name',name,'monthly_price',monthly_price,'yearly_price',yearly_price) INTO v_plan FROM public.plans WHERE id=s.plan_id;
 SELECT count(*) INTO v_payment_count FROM public.clinicx_admin_canonical_payments WHERE organization_id=c.organization_id;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC,q.id),'[]') INTO v_payments FROM (
 SELECT id,gateway_payment_id AS payment_id,provider_invoice_id AS invoice_id,canonical_amount_paise AS amount_paise,
 plan_id,billing_cycle,period_start,period_end,created_at,'captured' AS status,'INR' AS currency
 FROM public.clinicx_admin_canonical_payments WHERE organization_id=c.organization_id
 ORDER BY created_at DESC,id OFFSET p_payment_page*p_limit LIMIT p_limit) q;
 SELECT count(*) INTO v_event_count FROM public.subscription_events WHERE organization_id=c.organization_id;
 -- No raw event details/provider payloads/patient identifiers in billing analytics.
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.recorded_at DESC,q.id),'[]') INTO v_events FROM (
 SELECT id,kind,effective_at,recorded_at FROM public.subscription_events WHERE organization_id=c.organization_id
 ORDER BY recorded_at DESC,id OFFSET p_event_page*p_limit LIMIT p_limit) q;
 RETURN jsonb_build_object('asOf',now(),'timezone','UTC',
 'clinic',jsonb_build_object('id',c.id,'organization_id',c.organization_id,'clinic_name',c.clinic_name,'doctor_name',c.doctor_name,'owner_id',c.owner_id,'email',c.email),
 'owner',jsonb_build_object('id',c.owner_id,'email',(SELECT email FROM auth.users WHERE id=c.owner_id),'name',(SELECT full_name FROM public.profiles WHERE id=c.owner_id)),
 'plan',v_plan,'effectiveState',public.clinicx_effective_state(c.organization_id),
 'cohort',coalesce((SELECT cohort FROM public.clinicx_analytics_cohorts WHERE organization_id=c.organization_id),'production'),
 'subscription',CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('id',s.id,'plan_id',s.plan_id,'status',s.status,'billing_cycle',s.billing_cycle,
 'trial_started_at',s.trial_started_at,'trial_ends_at',s.trial_ends_at,'grace_ends_at',s.grace_ends_at,'current_period_start',s.current_period_start,
 'current_period_end',s.current_period_end,'cancel_at_period_end',s.cancel_at_period_end,'access_source',s.access_source) END,
 'usage',public.clinicx_usage(c.organization_id),
 'payments',jsonb_build_object('records',v_payments,'total',v_payment_count,'page',p_payment_page,'pageSize',p_limit,'hasMore',v_payment_count>(p_payment_page+1)*p_limit),
 'events',jsonb_build_object('records',v_events,'total',v_event_count,'page',p_event_page,'pageSize',p_limit,'hasMore',v_event_count>(p_event_page+1)*p_limit),
 'legacyPaymentsNotVerified',(SELECT count(*) FROM public.transactions WHERE organization_id=c.organization_id AND authority_version IS DISTINCT FROM 'clinicx-v1'));
END $$;
REVOKE ALL ON FUNCTION public.clinicx_admin_assert(),public.clinicx_admin_billing_stats(),public.clinicx_admin_customers(integer,integer,text),public.clinicx_admin_customer(uuid,integer,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_admin_billing_stats(),public.clinicx_admin_customers(integer,integer,text),public.clinicx_admin_customer(uuid,integer,integer,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
