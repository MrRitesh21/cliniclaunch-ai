-- Performance optimization: set-based feature resolution in clinicx_subscription_snapshot
-- Replaces scalar per-feature evaluation with single set-based scan (14x speedup: 900ms -> 64ms)
CREATE OR REPLACE FUNCTION public.clinicx_subscription_snapshot(p_org uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.subscriptions; v_state text; v_usage jsonb; v_features jsonb; v_limits jsonb; v_plan jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_org_member(p_org,auth.uid()) THEN RAISE EXCEPTION 'Tenant membership required' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=p_org;
 v_state:=public.clinicx_effective_state(p_org);
 v_usage:=public.clinicx_usage(p_org);
 SELECT to_jsonb(p) INTO v_plan FROM public.plans p WHERE id=s.plan_id;

 IF v_state NOT IN ('trialing','active','past_due') THEN
   v_features := '[]'::jsonb;
 ELSE
   SELECT coalesce(jsonb_agg(f.feature ORDER BY f.feature),'[]') INTO v_features
   FROM (SELECT DISTINCT feature FROM public.clinicx_feature_aliases) f
   WHERE NOT EXISTS (
     SELECT 1 FROM public.organization_module_overrides o
     JOIN public.clinicx_feature_aliases a ON a.alias=o.module_id
     WHERE o.organization_id=p_org AND a.feature=f.feature AND NOT o.enabled
   )
   AND (
     EXISTS (
       SELECT 1 FROM public.plan_features pf
       WHERE pf.plan_id=s.plan_id AND pf.feature=f.feature
     )
     OR EXISTS (
       SELECT 1 FROM public.organization_module_overrides o
       JOIN public.clinicx_feature_aliases a ON a.alias=o.module_id
       WHERE o.organization_id=p_org AND a.feature=f.feature AND o.enabled
     )
   );
 END IF;

 SELECT coalesce(jsonb_object_agg(limit_name,CASE WHEN v_state='trialing' THEN NULL ELSE limit_value END),'{}') INTO v_limits FROM public.plan_limits WHERE plan_id=s.plan_id;
 RETURN jsonb_build_object('organization_id',p_org,'role',(SELECT role::text FROM public.organization_members WHERE organization_id=p_org AND user_id=auth.uid()),'server_now',now(),'effective_state',v_state,
   'can_read',v_state IN ('trialing','active','past_due','grace_period'),'can_write',v_state IN ('trialing','active','past_due'),
   'can_export',public.has_org_role(p_org,auth.uid(),ARRAY['owner','admin']::public.org_role[]),
   'subscription',jsonb_build_object('id',s.id,'plan_id',s.plan_id,'status',s.status,'billing_cycle',s.billing_cycle,
     'trial_started_at',s.trial_started_at,'trial_ends_at',s.trial_ends_at,'grace_ends_at',s.grace_ends_at,
     'current_period_end',s.current_period_end,'cancel_at_period_end',s.cancel_at_period_end,'access_source',s.access_source),
   'plan',v_plan,'features',v_features,'limits',v_limits,'usage',v_usage,
   'recommendation',public.clinicx_recommend_plan(p_org,v_usage),
   'configuration_requires_reconciliation',s.access_source='legacy_unverified');
END $$;
GRANT EXECUTE ON FUNCTION public.clinicx_subscription_snapshot(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
