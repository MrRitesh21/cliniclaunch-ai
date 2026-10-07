-- Central entitlement authority. Catalog is additive and does not rewrite prices,
-- module installs, historical grants, subscription identifiers or provider links.
CREATE TABLE public.clinicx_feature_aliases (alias text PRIMARY KEY,feature text NOT NULL);
INSERT INTO public.clinicx_feature_aliases VALUES
 ('website','website'),('website_builder','website'),('appointments','appointments'),('qr_checkin','appointments'),
 ('patients','patients'),('records','patients'),('emr','patients'),('crm','patients'),('doctors','doctors'),
 ('queue','queue'),('visits','visits'),('billing','billing'),('finance','billing'),('prescriptions','prescriptions'),
 ('whatsapp','whatsapp'),('reviews','reviews'),('analytics','analytics'),('video','video'),('consult','video'),('consultation','video'),
 ('staff','staff_management'),('staff_management','staff_management'),('inventory','inventory'),('pharmacy','inventory'),
 ('lab','lab'),('marketing','marketing'),('seo','marketing'),('ai_assistant','ai_assistant'),('white_label','white_label'),
 ('priority_support','priority_support'),('sla','sla'),('custom_integrations','custom_integrations');
ALTER TABLE public.clinicx_feature_aliases ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.clinicx_feature_aliases TO authenticated,anon;
GRANT ALL ON public.clinicx_feature_aliases TO service_role;
CREATE POLICY clinicx_alias_read ON public.clinicx_feature_aliases FOR SELECT USING(true);

CREATE TABLE public.plan_features (
  plan_id text NOT NULL REFERENCES public.plans(id), feature text NOT NULL,
  PRIMARY KEY(plan_id,feature)
);
CREATE TABLE public.plan_limits (
  plan_id text NOT NULL REFERENCES public.plans(id), limit_name text NOT NULL,
  limit_value bigint CHECK(limit_value IS NULL OR limit_value>=0),
  PRIMARY KEY(plan_id,limit_name)
);
INSERT INTO public.plan_features(plan_id,feature)
SELECT p.id,f.feature FROM public.plans p CROSS JOIN (VALUES
 ('website',1),('appointments',1),('patients',1),('doctors',1),('queue',1),('visits',1),
 ('billing',2),('prescriptions',2),('whatsapp',2),('reviews',2),('analytics',2),
 ('video',3),('staff_management',3),('inventory',3),('lab',3),('marketing',3),
 ('ai_assistant',4),('white_label',4),('priority_support',4),('sla',4),('custom_integrations',4)
) AS f(feature,rank) WHERE f.rank<=CASE p.id WHEN 'starter' THEN 1 WHEN 'growth' THEN 2 WHEN 'professional' THEN 3 WHEN 'enterprise' THEN 4 ELSE 0 END;
INSERT INTO public.plan_limits VALUES
 ('starter','patients',100),('starter','staff',1),('starter','doctors',1),
 ('growth','patients',1000),('growth','staff',5),('growth','doctors',1),
 ('professional','patients',NULL),('professional','staff',20),('professional','doctors',NULL),
 ('enterprise','patients',NULL),('enterprise','staff',NULL),('enterprise','doctors',NULL);
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.plan_features,public.plan_limits TO authenticated,anon;
GRANT ALL ON public.plan_features,public.plan_limits TO service_role;
CREATE POLICY clinicx_catalog_read ON public.plan_features FOR SELECT USING(true);
CREATE POLICY clinicx_catalog_read ON public.plan_limits FOR SELECT USING(true);

CREATE FUNCTION public.clinicx_effective_state(p_org uuid,p_at timestamptz DEFAULT now()) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce((SELECT CASE
   WHEN status::text='suspended' THEN 'suspended'
   WHEN access_source='free_trial' AND status::text IN ('trialing','trial_expired','grace_period') THEN
     CASE WHEN p_at<trial_ends_at THEN 'trialing' WHEN p_at<grace_ends_at THEN 'grace_period' ELSE 'suspended' END
   WHEN status::text IN ('active','cancelled','past_due') AND p_at<current_period_end THEN 'active'
   WHEN status::text='past_due' AND p_at<recovery_ends_at THEN 'past_due'
   ELSE 'suspended' END FROM public.subscriptions WHERE organization_id=p_org),'suspended')
$$;
CREATE FUNCTION public.clinicx_can_operate(p_org uuid,p_feature text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.clinicx_feature_aliases WHERE feature=p_feature)
   AND public.clinicx_effective_state(p_org) IN ('trialing','active','past_due')
   -- Explicit deny wins across aliases. Installed module flags are not grants.
   AND NOT EXISTS(SELECT 1 FROM public.organization_module_overrides o
     JOIN public.clinicx_feature_aliases a ON a.alias=o.module_id
     WHERE o.organization_id=p_org AND a.feature=p_feature AND NOT o.enabled)
   AND (public.clinicx_effective_state(p_org)='trialing'
     OR EXISTS(SELECT 1 FROM public.subscriptions s JOIN public.plan_features f ON f.plan_id=s.plan_id
       WHERE s.organization_id=p_org AND f.feature=p_feature)
     OR EXISTS(SELECT 1 FROM public.organization_module_overrides o
       JOIN public.clinicx_feature_aliases a ON a.alias=o.module_id
       WHERE o.organization_id=p_org AND a.feature=p_feature AND o.enabled
         AND nullif(trim(o.reason),'') IS NOT NULL AND o.updated_by IS NOT NULL))
$$;
CREATE FUNCTION public.clinicx_can_read(p_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.is_org_member(p_org,auth.uid()) AND public.clinicx_effective_state(p_org) IN ('trialing','active','past_due','grace_period')
$$;
CREATE FUNCTION public.clinicx_limit(p_org uuid,p_name text) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN public.clinicx_effective_state(p_org)='trialing' THEN NULL ELSE
 (SELECT l.limit_value FROM public.subscriptions s JOIN public.plan_limits l ON l.plan_id=s.plan_id AND l.limit_name=p_name WHERE s.organization_id=p_org) END
$$;

-- The trigger enforces time/feature even on service-role writes (RLS bypass).
-- Server handlers still MUST authorize the end user's tenant/action before service writes.
CREATE FUNCTION public.clinicx_operational_write_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_org uuid; v_old_org uuid; v_feature text:=TG_ARGV[0]; v_limit bigint; v_count bigint;
  v_invite_accept boolean:=false; v_pending_self integer:=0;
BEGIN
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
  -- Existing organization creator trigger runs before the subscription is inserted.
  -- Its owner bootstrap still relies on the existing membership RLS/grants;
  -- no trial entitlement or seat is granted by this exception.
  IF TG_TABLE_NAME='organization_members' AND TG_OP='INSERT' AND (to_jsonb(NEW)->>'role')='owner'
    AND (to_jsonb(NEW)->>'user_id')::uuid=auth.uid() AND NOT EXISTS(SELECT 1 FROM public.subscriptions WHERE organization_id=v_org) THEN
    RETURN NEW;
  END IF;
  IF NOT public.clinicx_can_operate(v_org,v_feature) THEN
    RAISE EXCEPTION 'Subscription does not allow operational writes' USING ERRCODE='42501';
  END IF;
  IF auth.uid() IS NOT NULL THEN
    -- Reuse accept_invite's verified Auth email. Accepting a reserved seat is
    -- distinct from granting administrative membership authority.
    IF TG_TABLE_NAME='organization_invites' AND TG_OP='UPDATE' THEN
      v_invite_accept:=OLD.accepted_at IS NULL AND OLD.expires_at>now() AND NEW.accepted_at=now()
        AND (to_jsonb(NEW)-'accepted_at')=(to_jsonb(OLD)-'accepted_at')
        AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL AND lower(u.email)=lower(OLD.email));
    ELSIF TG_TABLE_NAME='organization_members' AND TG_OP='INSERT' AND (to_jsonb(NEW)->>'user_id')::uuid=auth.uid() THEN
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
      -- Only the consumed immutable doctor invite in this transaction permits
      -- self-creation; no client-settable flag or general doctor INSERT right.
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
    -- Acceptance converts one reserved invite into a member in the security RPC.
    IF TG_TABLE_NAME='organization_invites' AND ((to_jsonb(NEW)->>'accepted_at') IS NOT NULL OR (to_jsonb(NEW)->>'expires_at')::timestamptz<=now()) THEN v_count:=0; END IF;
    IF v_limit IS NOT NULL AND v_count>=v_limit THEN RAISE EXCEPTION 'Staff seat limit reached' USING ERRCODE='42501'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;

-- Add restrictive READ policies to every existing operational organization table,
-- rather than assuming an old permissive policy has been removed. Config/account,
-- subscriptions and billing-authority tables remain reachable after grace.
DO $$
DECLARE r record; v_feature text;
BEGIN
 FOR r IN SELECT t.table_name FROM information_schema.tables t JOIN information_schema.columns c
   ON c.table_schema=t.table_schema AND c.table_name=t.table_name AND c.column_name='organization_id'
   WHERE t.table_schema='public' AND t.table_type='BASE TABLE' AND t.table_name NOT IN
    ('subscriptions','subscription_events','clinicx_trial_claims','invoices','transactions','subscription_reminders',
     'organization_members','organization_invites','organization_onboarding','organization_modules','organization_module_overrides',
     'clinics','audit_log','notifications','push_events','clinic_template_assignments')
 LOOP
   v_feature:=CASE
     WHEN r.table_name LIKE 'prescription%' OR r.table_name='medications' THEN 'prescriptions'
     WHEN r.table_name LIKE 'patient_invoice%' OR r.table_name='patient_payments' OR r.table_name LIKE 'finance_%' OR r.table_name IN ('cash_book','expenses','vendor_categories') THEN 'billing'
     WHEN r.table_name LIKE 'lab_%' THEN 'lab'
     WHEN r.table_name LIKE 'inventory_%' OR r.table_name LIKE 'pharmacy_%' THEN 'inventory'
     WHEN r.table_name LIKE 'marketing_%' OR r.table_name LIKE 'campaign_%' OR r.table_name LIKE 'seo_%' THEN 'marketing'
     WHEN r.table_name LIKE 'whatsapp_%' THEN 'whatsapp'
     WHEN r.table_name LIKE 'review%' THEN 'reviews'
     WHEN r.table_name='ai_assistant_runs' THEN 'ai_assistant'
     WHEN r.table_name='doctors' THEN 'doctors'
     WHEN r.table_name='consultations' THEN 'video'
     WHEN r.table_name='appointments' THEN 'appointments'
     ELSE 'patients' END;
   EXECUTE format('CREATE POLICY clinicx_operational_read ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING(public.clinicx_can_read(organization_id))',r.table_name);
   EXECUTE format('CREATE TRIGGER clinicx_operational_write BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.clinicx_operational_write_guard(%L)',r.table_name,v_feature);
 END LOOP;
 FOR r IN SELECT unnest(ARRAY['organization_members','organization_invites','organization_modules']) AS table_name LOOP
   EXECUTE format('CREATE TRIGGER clinicx_operational_write BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.clinicx_operational_write_guard(%L)',r.table_name,'patients');
 END LOOP;
END $$;
CREATE POLICY clinicx_invoice_item_read ON public.patient_invoice_items AS RESTRICTIVE FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.patient_invoices i WHERE i.id=invoice_id AND public.clinicx_can_read(i.organization_id)));
CREATE TRIGGER clinicx_operational_write BEFORE INSERT OR UPDATE OR DELETE ON public.patient_invoice_items
 FOR EACH ROW EXECUTE FUNCTION public.clinicx_operational_write_guard('billing');
REVOKE ALL ON FUNCTION public.clinicx_effective_state(uuid,timestamptz),public.clinicx_can_operate(uuid,text),public.clinicx_limit(uuid,text),public.clinicx_operational_write_guard() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.clinicx_can_read(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clinicx_can_read(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
