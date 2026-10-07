-- Future downgrade quotas apply to NEW admissions while scheduling/reconciling.
-- Existing records stay intact. Same lock/order as reservation and existing admission authority.
CREATE FUNCTION public.clinicx_future_capacity_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.clinicx_recurring_commands;v_org uuid;
BEGIN
 v_org:=(to_jsonb(NEW)->>'organization_id')::uuid;
 IF v_org IS NULL THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-admission:'||v_org,0));
 FOR c IN SELECT * FROM public.clinicx_recurring_commands WHERE organization_id=v_org AND kind='change' AND state IN ('reserved','uncertain','scheduled') LOOP
  IF NOT (public.clinicx_plan_capacity(v_org,c.plan_id)->>'allowed')::boolean THEN
   RAISE EXCEPTION 'Scheduled target plan quota exceeded; cancel/reconcile change or resolve usage, no data deleted' USING ERRCODE='23514';
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER clinicx_future_patient_capacity AFTER INSERT OR UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.clinicx_future_capacity_guard();
CREATE TRIGGER clinicx_future_staff_capacity AFTER INSERT OR UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.clinicx_future_capacity_guard();
CREATE TRIGGER clinicx_future_invite_capacity AFTER INSERT OR UPDATE ON public.organization_invites FOR EACH ROW EXECUTE FUNCTION public.clinicx_future_capacity_guard();
CREATE TRIGGER clinicx_future_doctor_capacity AFTER INSERT OR UPDATE ON public.doctors FOR EACH ROW EXECUTE FUNCTION public.clinicx_future_capacity_guard();
REVOKE ALL ON FUNCTION public.clinicx_future_capacity_guard() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
