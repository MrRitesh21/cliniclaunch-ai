-- Source-record identifiers stay in service-only audit, never notification/engagement DTOs.
CREATE TABLE public.clinicx_product_mutations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
 subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE RESTRICT,
 source_table text NOT NULL, record_id uuid,
 operation text NOT NULL CHECK(operation IN ('INSERT','UPDATE','DELETE')),
 actor_id uuid, recorded_at timestamptz NOT NULL DEFAULT now(),
 details jsonb NOT NULL DEFAULT '{"source":"database_mutation"}'::jsonb
);
CREATE INDEX clinicx_mutations_org_time ON public.clinicx_product_mutations(organization_id,recorded_at);
ALTER TABLE public.clinicx_product_mutations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinicx_product_mutations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.clinicx_product_mutations TO service_role;
CREATE FUNCTION public.clinicx_capture_product_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public SET timezone='UTC' AS $$
DECLARE s public.subscriptions; v jsonb; k text; v_id uuid:=gen_random_uuid(); BEGIN
 v:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 IF TG_OP='UPDATE' AND (v-ARRAY['updated_at','created_at']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['updated_at','created_at']) THEN RETURN NEW; END IF;
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=(v->>'organization_id')::uuid;
 IF s.id IS NULL THEN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END IF;
 INSERT INTO public.clinicx_product_mutations(id,organization_id,subscription_id,source_table,record_id,operation,actor_id)
 VALUES(v_id,s.organization_id,s.id,TG_TABLE_NAME,coalesce((v->>'id')::uuid,(v->>'organization_id')::uuid),TG_OP,auth.uid());
 IF TG_OP='DELETE' AND now()>=s.trial_started_at AND now()<s.trial_ends_at THEN
  INSERT INTO public.clinicx_activation_days(subscription_id,organization_id,activity_day)
  VALUES(s.id,s.organization_id,(now() AT TIME ZONE 'UTC')::date) ON CONFLICT DO NOTHING;
 END IF;
 IF TG_OP='INSERT' THEN
  k:=CASE TG_TABLE_NAME WHEN 'patients' THEN 'patient_created' WHEN 'appointments' THEN 'appointment_created'
   WHEN 'prescriptions' THEN 'prescription_created' WHEN 'patient_invoices' THEN 'invoice_created' END;
  IF k IS NOT NULL THEN
   INSERT INTO public.subscription_events(organization_id,subscription_id,event_key,kind,actor_id,effective_at,details)
   VALUES(s.organization_id,s.id,'product:'||v_id,k,auth.uid(),now(),jsonb_build_object('source','database_mutation'));
  END IF;
 END IF;
 -- Setup events remain factual, durable and once-only, including outside the free-trial window.
 IF TG_TABLE_NAME='organization_onboarding' THEN
  IF TG_OP='INSERT' THEN k:='onboarding_started'; ELSE k:=NULL; END IF;
  IF k IS NOT NULL THEN
   INSERT INTO public.subscription_events(organization_id,subscription_id,event_key,kind,effective_at,details)
   VALUES(s.organization_id,s.id,'activation:'||k,k,now(),jsonb_build_object('source','database_mutation')) ON CONFLICT(subscription_id,event_key) DO NOTHING;
  END IF;
  IF TG_OP<>'DELETE' AND (v->>'completed')::boolean IS TRUE THEN
   INSERT INTO public.subscription_events(organization_id,subscription_id,event_key,kind,effective_at,details)
   VALUES(s.organization_id,s.id,'activation:onboarding_completed','onboarding_completed',now(),jsonb_build_object('source','database_mutation')) ON CONFLICT(subscription_id,event_key) DO NOTHING;
  END IF;
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['patients','appointments','patient_visits','prescriptions','patient_invoices','patient_payments','clinics','doctors','organization_members','organization_onboarding'] LOOP
  EXECUTE format('CREATE TRIGGER clinicx_product_mutation AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.clinicx_capture_product_mutation()',t);
 END LOOP;
END $$;
CREATE FUNCTION public.clinicx_capture_checkout_engagement() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.subscriptions; k text; BEGIN
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=NEW.organization_id;
 FOREACH k IN ARRAY ARRAY['upgrade_clicked','checkout_started'] LOOP
  INSERT INTO public.subscription_events(organization_id,subscription_id,event_key,kind,actor_id,effective_at,details)
  VALUES(NEW.organization_id,s.id,'checkout:'||NEW.id||':'||k,k,NEW.actor_id,NEW.created_at,
   jsonb_build_object('source','accepted_checkout_reservation','plan_id',NEW.plan_id,'billing_cycle',NEW.billing_cycle)) ON CONFLICT(subscription_id,event_key) DO NOTHING;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER clinicx_checkout_engagement AFTER INSERT ON public.clinicx_checkout_attempts FOR EACH ROW EXECUTE FUNCTION public.clinicx_capture_checkout_engagement();
REVOKE ALL ON FUNCTION public.clinicx_capture_product_mutation(),public.clinicx_capture_checkout_engagement() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
