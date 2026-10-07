CREATE FUNCTION public.clinicx_plan_capacity(p_org uuid,p_plan text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_usage jsonb; v_limits jsonb; v_violations jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.plans WHERE id=p_plan) THEN RAISE EXCEPTION 'Unknown plan'; END IF;
 v_usage:=public.clinicx_usage(p_org);
 SELECT jsonb_object_agg(limit_name,limit_value) INTO v_limits FROM public.plan_limits WHERE plan_id=p_plan;
 IF v_limits IS NULL OR NOT (v_limits ?& ARRAY['patients','staff','doctors']) THEN RAISE EXCEPTION 'Plan limits require reconciliation'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('limit',l.limit_name,'used',
  CASE WHEN l.limit_name='staff' THEN (v_usage->>'staff')::bigint+(v_usage->>'pending_staff_invites')::bigint ELSE (v_usage->>l.limit_name)::bigint END,'maximum',l.limit_value)),'[]')
 INTO v_violations FROM public.plan_limits l WHERE l.plan_id=p_plan AND l.limit_value IS NOT NULL AND
  CASE WHEN l.limit_name='staff' THEN (v_usage->>'staff')::bigint+(v_usage->>'pending_staff_invites')::bigint ELSE (v_usage->>l.limit_name)::bigint END>l.limit_value;
 RETURN jsonb_build_object('allowed',jsonb_array_length(v_violations)=0,'usage',v_usage,'violations',v_violations);
END $$;
CREATE FUNCTION public.clinicx_downgrade_check(p_org uuid,p_plan text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.clinicx_billing_current(p_org);
 RETURN public.clinicx_plan_capacity(p_org,p_plan);
END $$;
-- Serialize all plan changes with the subscription authority's admission lock.
CREATE FUNCTION public.clinicx_checkout_capacity_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-admission:'||NEW.organization_id,0));
 IF NOT (public.clinicx_plan_capacity(NEW.organization_id,NEW.plan_id)->>'allowed')::boolean THEN
  RAISE EXCEPTION 'Target plan is over capacity; resolve staff/patient/doctor limits before checkout' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER clinicx_checkout_capacity BEFORE INSERT ON public.clinicx_checkout_attempts FOR EACH ROW EXECUTE FUNCTION public.clinicx_checkout_capacity_guard();
CREATE FUNCTION public.clinicx_paid_capacity_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.access_source='verified_payment' AND (NEW.plan_id IS DISTINCT FROM OLD.plan_id OR OLD.access_source<>'verified_payment') THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-admission:'||NEW.organization_id,0));
  IF NOT (public.clinicx_plan_capacity(NEW.organization_id,NEW.plan_id)->>'allowed')::boolean THEN
   RAISE EXCEPTION 'Captured checkout requires capacity resolution; no records were deleted' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER clinicx_paid_capacity BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.clinicx_paid_capacity_guard();
REVOKE ALL ON FUNCTION public.clinicx_downgrade_check(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clinicx_downgrade_check(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.clinicx_plan_capacity(uuid,text),public.clinicx_checkout_capacity_guard(),public.clinicx_paid_capacity_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_plan_capacity(uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';
