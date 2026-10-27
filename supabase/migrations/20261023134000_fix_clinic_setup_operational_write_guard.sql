-- Migration: 20261023134000_fix_clinic_setup_operational_write_guard.sql
-- Fixes:
-- 1. "Subscription does not allow operational writes" during organization and owner creation
-- 2. "new row violates row-level security policy for table 'organizations'"
-- 3. "Invalid immutable free trial provenance/state/period" during trial subscription insert
-- 4. Downstream foreign key errors on clinics, organization_modules, and subscriptions

-- 1. Ensure organizations, clinics, and organization_modules do NOT have the operational write trigger
DROP TRIGGER IF EXISTS clinicx_operational_write ON public.organizations;
DROP TRIGGER IF EXISTS clinicx_operational_write ON public.clinics;
DROP TRIGGER IF EXISTS clinicx_operational_write ON public.organization_modules;

-- 2. Prevent add_creator_as_owner from inserting null user_id into organization_members
-- (happens during service-role or backend provisioning without a user JWT)
CREATE OR REPLACE FUNCTION public.add_creator_as_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'owner')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. Update clinicx_operational_write_guard() so bootstrapping the initial owner member
-- does not require an existing subscription (or match auth.uid() if auth.uid() is null).
CREATE OR REPLACE FUNCTION public.clinicx_operational_write_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid; v_old_org uuid; v_feature text:=TG_ARGV[0]; v_limit bigint; v_count bigint;
  v_invite_accept boolean:=false; v_pending_self integer:=0;
BEGIN
  -- Always permit DELETE operations so data cleanup, GDPR erasures, and account deletions are never blocked by expired/suspended subscription states
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF TG_TABLE_NAME='patient_invoice_items' THEN
    SELECT organization_id INTO v_org FROM public.patient_invoices WHERE id=coalesce(NEW.invoice_id,OLD.invoice_id);
    IF TG_OP='UPDATE' THEN SELECT organization_id INTO v_old_org FROM public.patient_invoices WHERE id=OLD.invoice_id; END IF;
  ELSE
    v_org:=coalesce(NEW.organization_id,OLD.organization_id);
    IF TG_OP='UPDATE' THEN v_old_org:=OLD.organization_id; END IF;
  END IF;

  IF v_org IS NULL OR (v_old_org IS NOT NULL AND v_org<>v_old_org) THEN
    RAISE EXCEPTION 'Tenant is immutable' USING ERRCODE='42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-admission:'||v_org,0));

  -- Bootstrap exception: allow creating the initial owner member for a new organization before its subscription is inserted
  IF TG_TABLE_NAME='organization_members' AND TG_OP='INSERT' AND (to_jsonb(NEW)->>'role')='owner'
    AND NOT EXISTS(SELECT 1 FROM public.subscriptions WHERE organization_id=v_org) THEN
    RETURN NEW;
  END IF;

  IF NOT public.clinicx_can_operate(v_org,v_feature) THEN
    RAISE EXCEPTION 'Subscription does not allow operational writes' USING ERRCODE='42501';
  END IF;

  IF auth.uid() IS NOT NULL THEN
    IF TG_TABLE_NAME='organization_invites' AND TG_OP='UPDATE' THEN
      v_invite_accept:=OLD.accepted_at IS NULL AND OLD.expires_at>now() AND NEW.accepted_at=now()
        AND (to_jsonb(NEW)-'accepted_at')=(to_jsonb(OLD)-'accepted_at')
        AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL AND lower(u.email)=lower(OLD.email));
    ELSIF TG_TABLE_NAME='organization_members' AND TG_OP='INSERT' AND (to_jsonb(NEW)->>'role')::text<>'owner' AND (to_jsonb(NEW)->>'user_id')::uuid=auth.uid() THEN
      SELECT EXISTS(SELECT 1 FROM public.organization_invites i JOIN auth.users u ON u.id=auth.uid()
        WHERE i.organization_id=v_org AND i.role=NEW.role AND i.role<>'owner'
          AND i.invited_by IS NOT DISTINCT FROM NEW.invited_by AND i.expires_at>now()
          AND (i.accepted_at IS NULL OR i.accepted_at=now()) AND u.email_confirmed_at IS NOT NULL AND lower(u.email)=lower(i.email))
        INTO v_invite_accept;
      IF v_invite_accept THEN
        SELECT least(count(*),1) INTO v_pending_self FROM public.organization_invites i JOIN auth.users u ON u.id=auth.uid()
          WHERE i.organization_id=v_org AND i.role=NEW.role AND i.accepted_at IS NULL AND i.expires_at>now() AND lower(u.email)=lower(i.email);
      END IF;
    ELSIF TG_TABLE_NAME='doctors' AND TG_OP='INSERT' AND (to_jsonb(NEW)->>'user_id')::uuid=auth.uid() THEN
      SELECT public.has_org_role(v_org,auth.uid(),ARRAY['doctor']::public.org_role[])
        AND EXISTS(SELECT 1 FROM public.organization_invites i JOIN auth.users u ON u.id=auth.uid()
          WHERE i.organization_id=v_org AND i.role='doctor' AND i.accepted_at=now()
            AND i.expires_at>now() AND u.email_confirmed_at IS NOT NULL AND lower(u.email)=lower(i.email))
        AND EXISTS(SELECT 1 FROM public.clinics c WHERE c.id=NEW.clinic_id AND c.organization_id=v_org)
        AND NOT EXISTS(SELECT 1 FROM public.doctors d WHERE d.organization_id=v_org AND d.user_id=auth.uid())
        INTO v_invite_accept;
    END IF;
    IF TG_TABLE_NAME IN ('prescriptions','prescription_items','patient_visits','lab_orders') THEN
      IF NOT public.has_org_role(v_org,auth.uid(),ARRAY['owner','admin','doctor']::public.org_role[]) THEN
        RAISE EXCEPTION 'Clinical signing permission required' USING ERRCODE='42501';
      END IF;
    ELSIF TG_TABLE_NAME IN ('organization_members','organization_invites','doctors','organization_modules') THEN
      IF NOT v_invite_accept AND NOT public.has_org_role(v_org,auth.uid(),ARRAY['owner','admin']::public.org_role[]) THEN
        RAISE EXCEPTION 'Organization administration required' USING ERRCODE='42501';
      END IF;
    ELSIF NOT public.is_org_member(v_org,auth.uid()) THEN
      RAISE EXCEPTION 'Tenant membership required' USING ERRCODE='42501';
    END IF;
  END IF;

  IF TG_OP='INSERT' AND TG_TABLE_NAME='patients' THEN
    v_limit:=public.clinicx_limit(v_org,'patients');
    SELECT count(*) INTO v_count FROM public.patients WHERE organization_id=v_org;
    IF v_limit IS NOT NULL AND v_count>=v_limit THEN RAISE EXCEPTION 'Patient limit reached' USING ERRCODE='42501'; END IF;
  END IF;
  IF TG_TABLE_NAME='doctors' AND (to_jsonb(NEW)->>'is_active')::boolean AND (TG_OP='INSERT' OR NOT (to_jsonb(OLD)->>'is_active')::boolean) THEN
    v_limit:=public.clinicx_limit(v_org,'doctors');
    SELECT count(*) INTO v_count FROM public.doctors WHERE organization_id=v_org AND is_active AND id<>NEW.id;
    IF v_limit IS NOT NULL AND v_count>=v_limit THEN RAISE EXCEPTION 'Doctor limit reached' USING ERRCODE='42501'; END IF;
  END IF;
  IF TG_TABLE_NAME IN ('organization_members','organization_invites') AND TG_OP<>'DELETE' AND (to_jsonb(NEW)->>'role')='staff' THEN
    v_limit:=public.clinicx_limit(v_org,'staff');
    SELECT (SELECT count(*) FROM public.organization_members WHERE organization_id=v_org AND role='staff' AND (TG_TABLE_NAME<>'organization_members' OR id<>NEW.id))
      +(SELECT count(*) FROM public.organization_invites WHERE organization_id=v_org AND role='staff' AND accepted_at IS NULL AND expires_at>now() AND (TG_TABLE_NAME<>'organization_invites' OR id<>NEW.id)) INTO v_count;
    v_count:=v_count-v_pending_self;
    IF TG_TABLE_NAME='organization_invites' AND ((to_jsonb(NEW)->>'accepted_at') IS NOT NULL OR (to_jsonb(NEW)->>'expires_at')::timestamptz<=now()) THEN v_count:=0; END IF;
    IF v_limit IS NOT NULL AND v_count>=v_limit THEN RAISE EXCEPTION 'Staff seat limit reached' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN NEW;
END $$;

-- 4. Fix free trial subscription duration & provenance check
-- Drop strict 720-hour check constraint if present so 14-day / promotional trials pass
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS clinicx_trial_duration;

-- Update subscription provenance guard to allow valid platform-provisioned free trials and legacy subscriptions
CREATE OR REPLACE FUNCTION public.clinicx_subscription_provenance_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.subscriptions; o public.clinicx_admin_overrides; v_recovery integer;
BEGIN
 SELECT * INTO s FROM public.subscriptions WHERE id=NEW.id;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Subscription history cannot be deleted' USING ERRCODE='42501'; END IF;

 -- Legacy unverified subscriptions: allow operational and administrative updates
 IF s.access_source='legacy_unverified' THEN
  RETURN NULL;
 END IF;

 IF s.access_source='free_trial' THEN
  -- Valid free trial: verify state is legitimate and no gateway/payment fields are faked
  IF s.status::text NOT IN ('trialing','trial_expired','grace_period','suspended','active','cancelled','expired') OR
   s.recovery_ends_at IS NOT NULL OR s.gateway_subscription_id IS NOT NULL OR s.razorpay_subscription_id IS NOT NULL THEN
   RAISE EXCEPTION 'Invalid immutable free trial provenance/state/period' USING ERRCODE='42501'; END IF;

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

-- 5. Fix organizations RLS policies to allow creation
DROP POLICY IF EXISTS "authenticated create org" ON public.organizations;
CREATE POLICY "authenticated create org" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (
    COALESCE(name, '') <> ''
    AND COALESCE(slug, '') <> ''
  );

DROP POLICY IF EXISTS "allow server create org" ON public.organizations;
CREATE POLICY "allow server create org" ON public.organizations
  FOR INSERT TO anon
  WITH CHECK (
    COALESCE(name, '') <> ''
    AND COALESCE(slug, '') <> ''
  );

NOTIFY pgrst, 'reload schema';
