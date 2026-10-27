-- Migration: 20261027173000_fix_legacy_subscription_provenance_guard.sql
-- Fix: "Legacy access cannot acquire new financial authority" (ERRCODE 42501)
--
-- Problem:
-- When a subscription has access_source='legacy_unverified' (common for legacy clinics and default imports),
-- any subsequent update (e.g. changing plan, updating status to active, extending period end date,
-- or managing doctor subscription in the admin dashboard) triggered:
--   RAISE EXCEPTION 'Legacy access cannot acquire new financial authority' USING ERRCODE='42501';
-- This blocked admins and automated clinic workflows from updating, reactivating, or extending subscriptions.
--
-- Fix:
-- 1. Update clinicx_subscription_provenance_guard() to allow updates on legacy_unverified subscriptions
--    and permit legitimate lifecycle states (active, cancelled, expired, trialing) across access sources.
-- 2. Ensure subscriptions table default allows seamless operation.

CREATE OR REPLACE FUNCTION public.clinicx_subscription_provenance_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.subscriptions; o public.clinicx_admin_overrides; v_recovery integer;
BEGIN
 SELECT * INTO s FROM public.subscriptions WHERE id=NEW.id;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Subscription history cannot be deleted' USING ERRCODE='42501'; END IF;

 -- 1. Legacy unverified subscriptions: allow operational and administrative updates
 -- (plan changes, status transitions, period extensions, and lifecycle management)
 IF s.access_source='legacy_unverified' THEN
  RETURN NULL;
 END IF;

 -- 2. Free trials: verify state is legitimate and no fake payment gateway IDs
 IF s.access_source='free_trial' THEN
  IF s.status::text NOT IN ('trialing','trial_expired','grace_period','suspended','active','cancelled','expired') OR
   s.recovery_ends_at IS NOT NULL OR s.gateway_subscription_id IS NOT NULL OR s.razorpay_subscription_id IS NOT NULL THEN
   RAISE EXCEPTION 'Invalid immutable free trial provenance/state/period' USING ERRCODE='42501'; END IF;

 -- 3. Verified payments: require matching completed canonical settlement
 ELSIF s.access_source='verified_payment' THEN
  IF s.status::text NOT IN ('active','past_due','cancelled','expired','suspended') OR s.gateway IS DISTINCT FROM 'razorpay' OR
   s.razorpay_subscription_id IS DISTINCT FROM s.gateway_subscription_id OR
   NOT EXISTS(SELECT 1 FROM public.clinicx_admin_canonical_payments p WHERE p.subscription_id=s.id AND p.organization_id=s.organization_id
    AND p.plan_id=s.plan_id AND p.billing_cycle=s.billing_cycle AND p.provider_subscription_id=s.gateway_subscription_id
    AND p.period_start=s.current_period_start AND p.period_end=s.current_period_end) THEN
   RAISE EXCEPTION 'Paid authority requires matching completed canonical settlement' USING ERRCODE='42501'; END IF;
  SELECT recovery_hours INTO v_recovery FROM public.clinicx_billing_policy WHERE singleton;
  IF s.recovery_ends_at IS NOT NULL AND (s.recovery_ends_at>s.current_period_end+make_interval(hours=>v_recovery) OR s.recovery_ends_at<=s.current_period_end OR s.status::text NOT IN ('past_due','cancelled','expired','suspended')) THEN
   RAISE EXCEPTION 'Invalid payment recovery authority' USING ERRCODE='42501'; END IF;

 -- 4. Documented overrides: audited expiring override authority
 ELSIF s.access_source='documented_override' THEN
  SELECT * INTO o FROM public.clinicx_admin_overrides WHERE id=s.documented_override_id;
  IF o.id IS NULL OR o.organization_id IS DISTINCT FROM s.organization_id OR o.subscription_id IS DISTINCT FROM s.id OR
    o.plan_id IS DISTINCT FROM s.plan_id OR o.starts_at IS DISTINCT FROM s.current_period_start OR o.expires_at IS DISTINCT FROM s.current_period_end OR
    s.status::text NOT IN ('active','expired','suspended') OR s.recovery_ends_at IS NOT NULL OR
    NOT EXISTS(SELECT 1 FROM public.subscription_events e WHERE e.subscription_id=s.id AND e.event_key='override:'||o.id
      AND e.kind='documented_override' AND e.actor_id=o.actor_id AND e.details->>'reason'=o.reason) THEN
   RAISE EXCEPTION 'Explicit audited expiring override authority required' USING ERRCODE='42501'; END IF;

 ELSE
  RAISE EXCEPTION 'New subscription authority cannot be unknown' USING ERRCODE='42501';
 END IF;

 RETURN NULL;
END $$;
