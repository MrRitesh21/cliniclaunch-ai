-- Migration: 20261009100000_clinicx_usage_staff_count.sql
-- Ensure clinicx_usage correctly reflects staff members (non-owner members) and pending invites

CREATE OR REPLACE FUNCTION public.clinicx_usage(p_org uuid) RETURNS jsonb
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
   'staff',(SELECT count(*) FROM public.organization_members WHERE organization_id=p_org AND role<>'owner'),
   'pending_staff_invites',(SELECT count(*) FROM public.organization_invites WHERE organization_id=p_org AND accepted_at IS NULL AND expires_at>now()),
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
END $$
;

GRANT EXECUTE ON FUNCTION public.clinicx_usage(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
