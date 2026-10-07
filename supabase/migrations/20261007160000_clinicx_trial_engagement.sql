-- Forward-only engagement extension. Preserve centralized access and immutable trial dates.
CREATE TABLE public.clinicx_activation_days (
 subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE RESTRICT,
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
 activity_day date NOT NULL,
 first_activity_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(subscription_id,activity_day)
);
ALTER TABLE public.clinicx_activation_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinicx_activation_days FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.clinicx_activation_days TO service_role;

CREATE FUNCTION public.clinicx_capture_activation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public SET timezone='UTC' AS $$
DECLARE s public.subscriptions; k text; v jsonb:=to_jsonb(NEW);
BEGIN
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=(v->>'organization_id')::uuid;
 IF s.id IS NULL OR s.trial_started_at IS NULL OR now()<s.trial_started_at OR now()>=s.trial_ends_at THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='organization_onboarding' THEN
   IF (v->>'completed')::boolean IS TRUE AND (TG_OP='INSERT' OR (to_jsonb(OLD)->>'completed')::boolean IS DISTINCT FROM true) THEN k:='onboarding_completed';
   ELSIF TG_OP='INSERT' THEN k:='onboarding_started'; ELSE RETURN NEW; END IF;
 ELSIF TG_TABLE_NAME='clinics' THEN
   IF nullif(trim(v->>'clinic_name'),'') IS NOT NULL AND nullif(trim(v->>'doctor_name'),'') IS NOT NULL AND nullif(trim(v->>'specialization'),'') IS NOT NULL THEN k:='profile_completed';
   ELSIF TG_OP='INSERT' THEN k:='clinic_created'; ELSE RETURN NEW; END IF;
 ELSE
   k:=CASE TG_TABLE_NAME WHEN 'patients' THEN 'first_patient' WHEN 'appointments' THEN 'first_appointment'
     WHEN 'patient_visits' THEN 'first_visit' WHEN 'prescriptions' THEN 'first_prescription'
     WHEN 'patient_invoices' THEN 'first_invoice' WHEN 'patient_payments' THEN 'first_payment'
     WHEN 'doctors' THEN 'doctor_added' WHEN 'organization_members' THEN 'staff_added' END;
   IF k='staff_added' AND v->>'role'<>'staff' THEN RETURN NEW; END IF;
 END IF;
 IF k IS NULL THEN RETURN NEW; END IF;
 INSERT INTO public.clinicx_activation_days(subscription_id,organization_id,activity_day)
 VALUES(s.id,s.organization_id,(now() AT TIME ZONE 'UTC')::date) ON CONFLICT DO NOTHING;
 INSERT INTO public.subscription_events(organization_id,subscription_id,event_key,kind,effective_at,details)
 VALUES(s.organization_id,s.id,'activation:'||k,k,now(),jsonb_build_object('source','database_mutation'))
 ON CONFLICT(subscription_id,event_key) DO NOTHING;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['patients','appointments','patient_visits','prescriptions','patient_invoices','patient_payments','doctors','organization_members'] LOOP
   EXECUTE format('CREATE TRIGGER clinicx_activation AFTER INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.clinicx_capture_activation()',t);
 END LOOP;
END $$;
CREATE TRIGGER clinicx_activation AFTER INSERT OR UPDATE ON public.clinics FOR EACH ROW EXECUTE FUNCTION public.clinicx_capture_activation();
CREATE TRIGGER clinicx_activation AFTER INSERT OR UPDATE ON public.organization_onboarding FOR EACH ROW EXECUTE FUNCTION public.clinicx_capture_activation();
REVOKE ALL ON FUNCTION public.clinicx_capture_activation() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.clinicx_trial_usage(p_org uuid,p_until timestamptz DEFAULT now()) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public SET timezone='UTC' AS $$
DECLARE s public.subscriptions; v_end timestamptz; BEGIN
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=p_org;
 IF s.trial_started_at IS NULL THEN RETURN NULL; END IF;
 v_end:=least(p_until,s.trial_ends_at);
 RETURN jsonb_build_object('window','trial','window_started_at',s.trial_started_at,'window_ended_at',v_end,'currency','INR',
 'patients',(SELECT count(*) FROM public.patients WHERE organization_id=p_org AND created_at>=s.trial_started_at AND created_at<v_end),
 'appointments',(SELECT count(*) FROM public.appointments WHERE organization_id=p_org AND created_at>=s.trial_started_at AND created_at<v_end),
 'completed_appointments',(SELECT count(*) FROM public.appointments WHERE organization_id=p_org AND created_at>=s.trial_started_at AND created_at<v_end AND status='completed'),
 'visits',(SELECT count(*) FROM public.patient_visits WHERE organization_id=p_org AND created_at>=s.trial_started_at AND created_at<v_end),
 -- EMR stores a visit record, not a completion timestamp/status. Never infer completion.
 'completed_visits',NULL,
 'prescriptions',(SELECT count(*) FROM public.prescriptions WHERE organization_id=p_org AND created_at>=s.trial_started_at AND created_at<v_end),
 'invoices',(SELECT count(*) FROM public.patient_invoices WHERE organization_id=p_org AND created_at>=s.trial_started_at AND created_at<v_end AND status<>'void'),
 'invoiced_inr',(SELECT coalesce(sum(total),0) FROM public.patient_invoices WHERE organization_id=p_org AND created_at>=s.trial_started_at AND created_at<v_end AND status<>'void'),
 'collected_inr',(SELECT coalesce(sum(p.amount),0) FROM public.patient_payments p JOIN public.patient_invoices i ON i.id=p.invoice_id AND i.organization_id=p.organization_id WHERE p.organization_id=p_org AND p.paid_at>=s.trial_started_at AND p.paid_at<v_end AND i.status<>'void'),
 'days_active',(SELECT count(*) FROM (SELECT (created_at AT TIME ZONE 'UTC')::date d FROM public.patients WHERE organization_id=p_org AND created_at>=s.trial_started_at AND created_at<v_end
 UNION SELECT (created_at AT TIME ZONE 'UTC')::date FROM public.appointments WHERE organization_id=p_org AND created_at>=s.trial_started_at AND created_at<v_end
 UNION SELECT (created_at AT TIME ZONE 'UTC')::date FROM public.patient_visits WHERE organization_id=p_org AND created_at>=s.trial_started_at AND created_at<v_end
 UNION SELECT (created_at AT TIME ZONE 'UTC')::date FROM public.prescriptions WHERE organization_id=p_org AND created_at>=s.trial_started_at AND created_at<v_end
 UNION SELECT (created_at AT TIME ZONE 'UTC')::date FROM public.patient_invoices WHERE organization_id=p_org AND created_at>=s.trial_started_at AND created_at<v_end
 UNION SELECT (paid_at AT TIME ZONE 'UTC')::date FROM public.patient_payments WHERE organization_id=p_org AND paid_at>=s.trial_started_at AND paid_at<v_end
 UNION SELECT activity_day FROM public.clinicx_activation_days WHERE subscription_id=s.id AND first_activity_at>=s.trial_started_at AND first_activity_at<v_end) d),
 'days_active_basis','UTC days with persisted clinic setup or clinical mutations; not logins',
 'completed_visits_unavailable_reason','EMR has no visit completion status or timestamp');
END $$;
CREATE FUNCTION public.clinicx_trial_engagement(p_org uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.subscriptions; BEGIN
 IF auth.uid() IS NULL OR NOT public.is_org_member(p_org,auth.uid()) THEN RAISE EXCEPTION 'Tenant membership required' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.subscriptions WHERE organization_id=p_org;
 RETURN jsonb_build_object('organization_id',p_org,'server_now',now(),'usage',public.clinicx_trial_usage(p_org),
 'activation',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',kind,'effective_at',effective_at) ORDER BY effective_at) FROM public.subscription_events WHERE subscription_id=s.id AND event_key LIKE 'activation:%'),'[]'),
 'checkpoints',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',kind,'effective_at',effective_at,'recorded_at',recorded_at,'usage',CASE WHEN details->'usage'->>'window'='trial' THEN details->'usage' ELSE NULL END) ORDER BY effective_at) FROM public.subscription_events WHERE subscription_id=s.id AND kind LIKE 'trial_day_%'),'[]'));
END $$;
REVOKE ALL ON FUNCTION public.clinicx_trial_usage(uuid,timestamptz),public.clinicx_trial_engagement(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_trial_usage(uuid,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.clinicx_trial_engagement(uuid) TO authenticated;
-- Existing idempotent lifecycle jobs keep their implementation. Enrich their atomic event
-- producer, so late checkpoint snapshots stop at the actual backend day-N boundary.
CREATE OR REPLACE FUNCTION public.clinicx_record_trial_event(p_sub public.subscriptions,p_key text,p_at timestamptz,p_payload jsonb DEFAULT '{}')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_event uuid; v_payload jsonb:=p_payload; BEGIN
 IF p_key LIKE 'trial_day_%' THEN
  v_payload:=v_payload||jsonb_build_object('usage',public.clinicx_trial_usage(p_sub.organization_id,p_at),'snapshot_at',p_at,
   'snapshot_semantics','records created in trial window, using current stored status/totals; not a historical state reconstruction');
 END IF;
 INSERT INTO public.subscription_events(organization_id,subscription_id,event_key,kind,effective_at,details)
 VALUES(p_sub.organization_id,p_sub.id,p_key,p_key,p_at,v_payload) ON CONFLICT(subscription_id,event_key) DO NOTHING RETURNING id INTO v_event;
 IF v_event IS NULL THEN RETURN 0; END IF;
 INSERT INTO public.subscription_outbox(organization_id,event_id,kind,payload,available_at) VALUES(p_sub.organization_id,v_event,p_key,v_payload,p_at);
 RETURN 1;
END $$;
CREATE INDEX clinicx_patients_trial_time ON public.patients(organization_id,created_at);
CREATE INDEX clinicx_appointments_trial_time ON public.appointments(organization_id,created_at);
CREATE INDEX clinicx_visits_trial_time ON public.patient_visits(organization_id,created_at);
CREATE INDEX clinicx_prescriptions_trial_time ON public.prescriptions(organization_id,created_at);
CREATE INDEX clinicx_clinical_invoices_trial_time ON public.patient_invoices(organization_id,created_at);
-- Existing patient_payments_org_idx already indexes (organization_id,paid_at).
NOTIFY pgrst,'reload schema';
