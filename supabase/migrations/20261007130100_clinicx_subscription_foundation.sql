-- Requires 20261007130000 committed separately (PostgreSQL enum safety).
-- No UPDATE of legacy subscription/plan rows; reconciliation is a release gate.
ALTER TABLE public.subscriptions
  ADD COLUMN trial_started_at timestamptz,
  ADD COLUMN grace_ends_at timestamptz,
  ADD COLUMN recovery_ends_at timestamptz,
  ADD COLUMN access_source text NOT NULL DEFAULT 'legacy_unverified'
    CHECK (access_source IN ('legacy_unverified','free_trial','verified_payment','documented_override'));
ALTER TABLE public.subscriptions ADD CONSTRAINT clinicx_trial_duration CHECK (
  trial_started_at IS NULL OR (trial_ends_at = trial_started_at + interval '720 hours'
    AND grace_ends_at = trial_ends_at + interval '168 hours')) NOT VALID;

CREATE TABLE public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE RESTRICT,
  event_key text NOT NULL,
  kind text NOT NULL,
  actor_id uuid,
  effective_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}',
  UNIQUE(subscription_id,event_key)
);
CREATE INDEX clinicx_events_org_time ON public.subscription_events(organization_id,recorded_at DESC);
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.subscription_events TO authenticated;
GRANT ALL ON public.subscription_events TO service_role;
CREATE POLICY clinicx_events_read ON public.subscription_events FOR SELECT TO authenticated
  USING(public.has_org_role(organization_id,auth.uid(),ARRAY['owner','admin']::public.org_role[]));

-- An owner cannot acquire another trial by changing slug/request key or deleting a clinic.
CREATE TABLE public.clinicx_trial_claims (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE RESTRICT,
  claimed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clinicx_trial_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinicx_trial_claims FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.clinicx_trial_claims TO service_role;

REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.subscriptions,public.invoices FROM PUBLIC,anon,authenticated;
DROP POLICY IF EXISTS "admins manage subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "admins create invoices" ON public.invoices;

CREATE FUNCTION public.clinicx_immutable_trial() RETURNS trigger
LANGUAGE plpgsql SET search_path=public SET timezone='UTC' AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR
     NEW.trial_started_at IS DISTINCT FROM OLD.trial_started_at OR
     NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at OR
     NEW.grace_ends_at IS DISTINCT FROM OLD.grace_ends_at THEN
    RAISE EXCEPTION 'Trial timestamps and tenant are immutable' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER clinicx_immutable_trial BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.clinicx_immutable_trial();

CREATE FUNCTION public.clinicx_audit_subscription() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.subscription_events(organization_id,subscription_id,event_key,kind,actor_id,effective_at,details)
      VALUES(NEW.organization_id,NEW.id,'created',CASE WHEN NEW.access_source='free_trial' THEN 'trial_started' ELSE 'subscription_created' END,
        auth.uid(),now(),jsonb_build_object('status',NEW.status,'plan_id',NEW.plan_id,'access_source',NEW.access_source));
  ELSIF ROW(NEW.status,NEW.plan_id,NEW.current_period_end,NEW.cancel_at_period_end,NEW.access_source,NEW.recovery_ends_at)
    IS DISTINCT FROM ROW(OLD.status,OLD.plan_id,OLD.current_period_end,OLD.cancel_at_period_end,OLD.access_source,OLD.recovery_ends_at) THEN
    INSERT INTO public.subscription_events(organization_id,subscription_id,event_key,kind,actor_id,effective_at,details)
      VALUES(NEW.organization_id,NEW.id,'change:'||gen_random_uuid(),'subscription_changed',auth.uid(),now(),
        jsonb_build_object('from',OLD.status,'to',NEW.status,'plan_id',NEW.plan_id,'period_end',NEW.current_period_end,
          'cancel_at_period_end',NEW.cancel_at_period_end,'access_source',NEW.access_source));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER clinicx_subscription_audit AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.clinicx_audit_subscription();

CREATE FUNCTION public.clinicx_provision_trial(p_slug text,p_name text,p_doctor_name text,p_business_type text DEFAULT 'clinic')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public SET timezone='UTC' AS $$
DECLARE v_owner uuid:=auth.uid(); v_org uuid; v_clinic uuid; v_start timestamptz:=now();
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_slug !~ '^[a-z0-9][a-z0-9-]{2,62}$' OR length(trim(p_name)) NOT BETWEEN 1 AND 160
    OR length(trim(p_doctor_name)) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'Invalid clinic profile' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-trial:'||v_owner,0));
  SELECT organization_id INTO v_org FROM public.clinicx_trial_claims WHERE owner_id=v_owner;
  IF v_org IS NULL THEN
    IF EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=v_owner AND role='owner') THEN
      RAISE EXCEPTION 'Existing owner requires trial eligibility review' USING ERRCODE='42501';
    END IF;
    INSERT INTO public.organizations(slug,name,business_type) VALUES(p_slug,trim(p_name),p_business_type::public.business_type) RETURNING id INTO v_org;
    INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(v_org,v_owner,'owner') ON CONFLICT DO NOTHING;
    INSERT INTO public.subscriptions(organization_id,plan_id,status,trial_started_at,trial_ends_at,grace_ends_at,current_period_start,current_period_end,access_source)
      VALUES(v_org,'growth','trialing',v_start,v_start+interval '720 hours',v_start+interval '888 hours',v_start,v_start+interval '720 hours','free_trial');
    INSERT INTO public.clinics(organization_id,owner_id,slug,clinic_name,doctor_name) VALUES(v_org,v_owner,p_slug,trim(p_name),trim(p_doctor_name));
    INSERT INTO public.doctors(organization_id,clinic_id,user_id,name)
      SELECT v_org,id,v_owner,trim(p_doctor_name) FROM public.clinics WHERE organization_id=v_org;
    INSERT INTO public.organization_onboarding(organization_id,current_step) VALUES(v_org,1);
    INSERT INTO public.organization_modules(organization_id,module_id,installed_by)
      SELECT v_org,id,v_owner FROM public.modules WHERE is_core ON CONFLICT DO NOTHING;
    INSERT INTO public.clinicx_trial_claims(owner_id,organization_id) VALUES(v_owner,v_org);
  END IF;
  SELECT id INTO v_clinic FROM public.clinics WHERE organization_id=v_org;
  RETURN jsonb_build_object('organization_id',v_org,'clinic_id',v_clinic);
END $$;
REVOKE ALL ON FUNCTION public.clinicx_provision_trial(text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clinicx_provision_trial(text,text,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.clinicx_immutable_trial(),public.clinicx_audit_subscription() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst, 'reload schema';
