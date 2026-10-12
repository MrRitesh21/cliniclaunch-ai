-- Migration: Allow DELETE operations through operational write guard
-- Data cleanup, GDPR erasures, and account deletions must never be blocked by subscription expiry or suspension.

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
  IF TG_TABLE_NAME='organization_members' AND TG_OP='INSERT' AND (to_jsonb(NEW)->>'role')='owner'
    AND (to_jsonb(NEW)->>'user_id')::uuid=auth.uid() AND NOT EXISTS(SELECT 1 FROM public.subscriptions WHERE organization_id=v_org) THEN
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
