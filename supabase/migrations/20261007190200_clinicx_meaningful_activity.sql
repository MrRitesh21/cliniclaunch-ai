-- Count genuine persisted mutations, not timestamp-only/no-op UPDATEs or elapsed/logged-in days.
CREATE OR REPLACE FUNCTION public.clinicx_capture_activation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public SET timezone='UTC' AS $$
DECLARE s public.subscriptions; k text; v jsonb:=to_jsonb(NEW); old_v jsonb; kinds text[]:=ARRAY[]::text[]; BEGIN
 IF TG_OP='UPDATE' THEN
  old_v:=to_jsonb(OLD);
  IF (v-ARRAY['updated_at','created_at']) IS NOT DISTINCT FROM (old_v-ARRAY['updated_at','created_at']) THEN RETURN NEW; END IF;
 END IF;
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=(v->>'organization_id')::uuid;
 IF s.id IS NULL OR s.trial_started_at IS NULL OR now()<s.trial_started_at OR now()>=s.trial_ends_at THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='organization_members' AND v->>'role'<>'staff' THEN RETURN NEW; END IF;
 INSERT INTO public.clinicx_activation_days(subscription_id,organization_id,activity_day)
 VALUES(s.id,s.organization_id,(now() AT TIME ZONE 'UTC')::date) ON CONFLICT DO NOTHING;
 IF TG_TABLE_NAME='organization_onboarding' THEN
  IF TG_OP='INSERT' THEN kinds:=array_append(kinds,'onboarding_started'); END IF;
  IF (v->>'completed')::boolean IS TRUE AND (TG_OP='INSERT' OR (old_v->>'completed')::boolean IS DISTINCT FROM true) THEN kinds:=array_append(kinds,'onboarding_completed'); END IF;
 ELSIF TG_TABLE_NAME='clinics' THEN
  IF TG_OP='INSERT' THEN kinds:=array_append(kinds,'clinic_created'); END IF;
  IF nullif(trim(v->>'clinic_name'),'') IS NOT NULL AND nullif(trim(v->>'doctor_name'),'') IS NOT NULL AND nullif(trim(v->>'specialization'),'') IS NOT NULL THEN kinds:=array_append(kinds,'profile_completed'); END IF;
 ELSIF TG_OP='INSERT' THEN
  k:=CASE TG_TABLE_NAME WHEN 'patients' THEN 'first_patient' WHEN 'appointments' THEN 'first_appointment'
   WHEN 'patient_visits' THEN 'first_visit' WHEN 'prescriptions' THEN 'first_prescription' WHEN 'patient_invoices' THEN 'first_invoice'
   WHEN 'patient_payments' THEN 'first_payment' WHEN 'doctors' THEN 'doctor_added' WHEN 'organization_members' THEN 'staff_added' END;
  IF k IS NOT NULL THEN kinds:=array_append(kinds,k); END IF;
 END IF;
 FOREACH k IN ARRAY kinds LOOP
  INSERT INTO public.subscription_events(organization_id,subscription_id,event_key,kind,effective_at,details)
  VALUES(s.organization_id,s.id,'activation:'||k,k,now(),jsonb_build_object('source','database_mutation')) ON CONFLICT(subscription_id,event_key) DO NOTHING;
 END LOOP;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['patients','appointments','patient_visits','prescriptions','patient_invoices','patient_payments','doctors','organization_members'] LOOP
  EXECUTE format('DROP TRIGGER clinicx_activation ON public.%I',t);
  EXECUTE format('CREATE TRIGGER clinicx_activation AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.clinicx_capture_activation()',t);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
