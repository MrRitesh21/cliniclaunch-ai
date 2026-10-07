-- Aggregate actual clinical data; financial totals use clinical INR rupees,
-- not SaaS invoices, synthetic savings or inferred appointment-phone patients.
CREATE FUNCTION public.clinicx_usage(p_org uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb; r record; v_count bigint; v_used jsonb:='[]';
BEGIN
 SELECT jsonb_build_object(
   'patients',(SELECT count(*) FROM public.patients WHERE organization_id=p_org),
   'appointments',(SELECT count(*) FROM public.appointments WHERE organization_id=p_org),
   'completed_appointments',(SELECT count(*) FROM public.appointments WHERE organization_id=p_org AND status='completed'),
   'visits',(SELECT count(*) FROM public.patient_visits WHERE organization_id=p_org),
   'prescriptions',(SELECT count(*) FROM public.prescriptions WHERE organization_id=p_org),
   'invoices',(SELECT count(*) FROM public.patient_invoices WHERE organization_id=p_org AND status<>'void'),
   'invoiced_inr',(SELECT coalesce(sum(total),0) FROM public.patient_invoices WHERE organization_id=p_org AND status<>'void'),
   'collected_inr',(SELECT coalesce(sum(p.amount),0) FROM public.patient_payments p JOIN public.patient_invoices i ON i.id=p.invoice_id AND i.organization_id=p.organization_id WHERE p.organization_id=p_org AND i.status<>'void'),
   'staff',(SELECT count(*) FROM public.organization_members WHERE organization_id=p_org AND role='staff'),
   'pending_staff_invites',(SELECT count(*) FROM public.organization_invites WHERE organization_id=p_org AND role='staff' AND accepted_at IS NULL AND expires_at>now()),
   'doctors',(SELECT count(*) FROM public.doctors WHERE organization_id=p_org AND is_active),
   'currency','INR','window','all_time') INTO v_result;
 FOR r IN SELECT * FROM (VALUES
   ('prescriptions','prescriptions'),('patient_invoices','billing'),('inventory_items','inventory'),
   ('lab_orders','lab'),('consultations','video'),('marketing_campaigns','marketing'),
   ('whatsapp_logs','whatsapp'),('reviews','reviews'),('ai_assistant_runs','ai_assistant')
 ) AS mapping(table_name,feature) LOOP
   v_count:=NULL;
   IF to_regclass('public.'||r.table_name) IS NOT NULL THEN
     EXECUTE format('SELECT count(*) FROM public.%I WHERE organization_id=$1',r.table_name) INTO v_count USING p_org;
   END IF;
   v_result:=v_result||jsonb_build_object(r.feature||'_records',v_count);
   IF v_count>0 THEN v_used:=v_used||jsonb_build_array(r.feature); END IF;
 END LOOP;
 RETURN v_result||jsonb_build_object('features_used',v_used);
END $$;
CREATE FUNCTION public.clinicx_recommend_plan(p_org uuid,p_usage jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_plan text; v_business text;
BEGIN
 SELECT business_type::text INTO v_business FROM public.organizations WHERE id=p_org;
 IF v_business IN ('hospital','diagnostic_center') THEN v_plan:='enterprise';
 ELSE
   SELECT p.id INTO v_plan FROM public.plans p
   WHERE p.id IN ('starter','growth','professional','enterprise')
     AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_usage->'features_used') f(feature)
       WHERE NOT EXISTS(SELECT 1 FROM public.plan_features pf WHERE pf.plan_id=p.id AND pf.feature=f.feature))
     AND NOT EXISTS(SELECT 1 FROM public.plan_limits l WHERE l.plan_id=p.id AND l.limit_value IS NOT NULL AND
       CASE l.limit_name WHEN 'patients' THEN (p_usage->>'patients')::bigint
         WHEN 'staff' THEN (p_usage->>'staff')::bigint+(p_usage->>'pending_staff_invites')::bigint
         WHEN 'doctors' THEN (p_usage->>'doctors')::bigint ELSE 0 END > l.limit_value)
   ORDER BY CASE p.id WHEN 'starter' THEN 1 WHEN 'growth' THEN 2 WHEN 'professional' THEN 3 ELSE 4 END LIMIT 1;
 END IF;
 IF (p_usage->>'patients')::bigint=0 AND jsonb_array_length(p_usage->'features_used')=0
   AND (p_usage->>'staff')::bigint=0 AND (p_usage->>'doctors')::bigint<=1 AND v_business NOT IN ('hospital','diagnostic_center') THEN v_plan:='growth'; END IF;
 RETURN jsonb_build_object('plan_id',coalesce(v_plan,'enterprise'),'advisory',true,'basis',jsonb_build_object(
   'patients',p_usage->'patients','staff',p_usage->'staff','pending_staff_invites',p_usage->'pending_staff_invites',
   'doctors',p_usage->'doctors','features_used',p_usage->'features_used','business_type',v_business));
END $$;
CREATE FUNCTION public.clinicx_subscription_snapshot(p_org uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.subscriptions; v_state text; v_usage jsonb; v_features jsonb; v_limits jsonb; v_plan jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_org_member(p_org,auth.uid()) THEN RAISE EXCEPTION 'Tenant membership required' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=p_org;
 v_state:=public.clinicx_effective_state(p_org);
 v_usage:=public.clinicx_usage(p_org);
 SELECT to_jsonb(p) INTO v_plan FROM public.plans p WHERE id=s.plan_id;
 SELECT coalesce(jsonb_agg(feature ORDER BY feature),'[]') INTO v_features
   FROM (SELECT DISTINCT feature FROM public.clinicx_feature_aliases) f
   WHERE public.clinicx_can_operate(p_org,f.feature);
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

-- Dedicated owner/admin export bypasses operational SELECT restrictions only;
-- table selection is allowlisted, cursor/limit bounded, tenant revalidated inside DB.
CREATE FUNCTION public.clinicx_export_page(p_org uuid,p_table text,p_cursor uuid DEFAULT NULL,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_rows jsonb; v_result jsonb; v_sub uuid; v_cursor text; v_more boolean; v_scope text; v_projection text:='to_jsonb(t)';
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_org_role(p_org,auth.uid(),ARRAY['owner','admin']::public.org_role[]) THEN
   RAISE EXCEPTION 'Owner/admin export permission required' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_table IS NULL OR p_limit NOT BETWEEN 1 AND 500 OR p_table NOT IN ('patients','appointments','patient_visits','patient_attachments','prescriptions','prescription_items','patient_invoices','patient_invoice_items','patient_payments','clinics','doctors') THEN
   RAISE EXCEPTION 'Invalid export request' USING ERRCODE='22023'; END IF;
 v_scope:=CASE WHEN p_table='patient_invoice_items' THEN 'EXISTS(SELECT 1 FROM public.patient_invoices i WHERE i.id=t.invoice_id AND i.organization_id=$1)' ELSE 't.organization_id=$1' END;
 -- Settings are an explicit projection, not a backup of provider credentials
 -- or future authority columns. Missing optional historic fields are omitted.
 IF p_table='clinics' THEN
   v_projection:='(SELECT jsonb_object_agg(key,value) FROM jsonb_each(to_jsonb(t)) WHERE key=ANY(ARRAY[''id'',''organization_id'',''slug'',''clinic_name'',''doctor_name'',''specialization'',''qualification'',''experience_years'',''bio'',''hero_headline'',''hero_subheadline'',''about_text'',''consultation_fee'',''avatar_url'',''logo_url'',''services'',''gallery'',''testimonials'',''faqs'',''team'',''working_hours'',''theme_color'',''template'',''section_variants'',''public_phone'',''public_email'',''public_address'',''personal_phone'',''personal_email'',''phone'',''email'',''address'',''seo_title'',''seo_description'',''created_at'',''updated_at'']))';
 END IF;
 EXECUTE format('SELECT coalesce(jsonb_agg(q.row_json ORDER BY q.id),''[]'') FROM (SELECT t.id,%s AS row_json FROM public.%I t WHERE %s AND ($2::uuid IS NULL OR t.id>$2) ORDER BY t.id LIMIT $3) q',v_projection,p_table,v_scope)
   INTO v_rows USING p_org,p_cursor,p_limit+1;
 v_more:=jsonb_array_length(v_rows)>p_limit;
 SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]') INTO v_rows FROM jsonb_array_elements(v_rows) WITH ORDINALITY AS rows(value,ord) WHERE ord<=p_limit;
 v_cursor:=CASE WHEN v_more THEN v_rows->(jsonb_array_length(v_rows)-1)->>'id' ELSE NULL END;
 SELECT id INTO v_sub FROM public.subscriptions WHERE organization_id=p_org;
 IF v_sub IS NOT NULL THEN
   INSERT INTO public.subscription_events(organization_id,subscription_id,event_key,kind,actor_id,effective_at,details)
     VALUES(p_org,v_sub,'export:'||gen_random_uuid(),'clinic_data_exported',auth.uid(),now(),jsonb_build_object('table',p_table,'count',jsonb_array_length(v_rows)));
 END IF;
 v_result:=jsonb_build_object('records',v_rows,'next_cursor',v_cursor,'has_more',v_more,'table',p_table);
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.clinicx_usage(uuid),public.clinicx_recommend_plan(uuid,jsonb),public.clinicx_subscription_snapshot(uuid),public.clinicx_export_page(uuid,text,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_subscription_snapshot(uuid),public.clinicx_export_page(uuid,text,uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_usage(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
