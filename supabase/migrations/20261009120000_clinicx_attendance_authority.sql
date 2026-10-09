-- Forward-only correction: the previously applied attendance table is preserved.
-- All end-user mutations go through JWT-authorized, server-clock RPCs.
DROP POLICY IF EXISTS org_members_read_attendance ON public.staff_attendance;
DROP POLICY IF EXISTS org_members_insert_attendance ON public.staff_attendance;
DROP POLICY IF EXISTS org_members_update_attendance ON public.staff_attendance;
DROP POLICY IF EXISTS org_members_delete_attendance ON public.staff_attendance;
REVOKE ALL ON public.staff_attendance FROM authenticated, anon;
GRANT SELECT ON public.staff_attendance TO authenticated;
-- Forgotten open shifts may exceed 99.99 hours; checkout must still be possible.
ALTER TABLE public.staff_attendance ALTER COLUMN working_hours TYPE numeric(12,2);
-- The generated schema includes member clinic scope; make clean historical installs match it.
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL;

INSERT INTO public.modules(id,name,description,category,icon,min_plan,sort_order,is_available)
SELECT 'attendance','Staff Attendance','Daily staff attendance, check-in/out, history and CSV reports.',
 'Operations','Clock',min_plan,91,true FROM public.modules WHERE id='staff'
ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,
 category=excluded.category,icon=excluded.icon,min_plan=excluded.min_plan,is_available=true;
UPDATE public.plans SET module_ids=array_append(module_ids,'attendance')
 WHERE ('staff'=ANY(module_ids) OR 'staff_management'=ANY(module_ids)) AND NOT 'attendance'=ANY(module_ids);
INSERT INTO public.clinicx_feature_aliases(alias,feature) VALUES('attendance','staff_management')
 ON CONFLICT(alias) DO UPDATE SET feature=excluded.feature;

CREATE FUNCTION public.clinicx_attendance_install_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF (TG_OP<>'DELETE' AND NEW.module_id='attendance') OR (TG_OP<>'INSERT' AND OLD.module_id='attendance') THEN
  IF auth.uid() IS NULL OR NOT public.has_org_role(coalesce(NEW.organization_id,OLD.organization_id),auth.uid(),ARRAY['owner','admin']::public.org_role[])
    OR NOT public.clinicx_can_operate(coalesce(NEW.organization_id,OLD.organization_id),'staff_management') THEN
   RAISE EXCEPTION 'Attendance installation requires owner/admin and an active Staff Management entitlement' USING ERRCODE='42501';
  END IF;
  IF TG_OP<>'DELETE' AND NOT EXISTS(SELECT 1 FROM public.modules WHERE id='attendance' AND is_available) THEN
   RAISE EXCEPTION 'Attendance is currently unavailable' USING ERRCODE='42501';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER clinicx_attendance_install BEFORE INSERT OR UPDATE OR DELETE ON public.organization_modules
 FOR EACH ROW EXECUTE FUNCTION public.clinicx_attendance_install_guard();
REVOKE ALL ON FUNCTION public.clinicx_attendance_install_guard() FROM PUBLIC,anon,authenticated;

-- ClinicX attendance dates use India standard time, independent of session/browser timezone.
-- Overnight shifts retain their check-in date until checkout; no client clock is accepted.
CREATE FUNCTION public.clinicx_attendance_roster(p_org uuid)
RETURNS TABLE(staff_id text,staff_name text,staff_role text,clinic_id uuid,user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT 'user:'||m.user_id,coalesce(nullif(p.full_name,''),d.name,'Team member'),m.role::text,
   m.clinic_id,m.user_id
 FROM public.organization_members m LEFT JOIN public.profiles p ON p.id=m.user_id
 LEFT JOIN LATERAL (SELECT name FROM public.doctors WHERE organization_id=p_org AND user_id=m.user_id AND is_active ORDER BY id LIMIT 1) d ON true
 WHERE m.organization_id=p_org
 UNION ALL
 SELECT DISTINCT ON (coalesce(d.user_id,d.id))
   CASE WHEN d.user_id IS NULL THEN 'doctor:'||d.id ELSE 'user:'||d.user_id END,
   d.name,'doctor',d.clinic_id,d.user_id
 FROM public.doctors d WHERE d.organization_id=p_org AND d.is_active
 AND NOT EXISTS(SELECT 1 FROM public.organization_members m WHERE m.organization_id=p_org AND m.user_id=d.user_id)
$$;

CREATE FUNCTION public.clinicx_attendance_access(p_org uuid,p_clinic uuid,p_subject text,p_write boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL
 AND EXISTS(SELECT 1 FROM public.organization_members m WHERE m.organization_id=p_org AND m.user_id=auth.uid()
   AND (m.clinic_id IS NULL OR m.clinic_id=p_clinic)
   AND (m.role IN ('owner','admin') OR p_subject='user:'||auth.uid()))
 AND (p_clinic IS NULL OR EXISTS(SELECT 1 FROM public.clinics c WHERE c.id=p_clinic AND c.organization_id=p_org))
 AND EXISTS(SELECT 1 FROM public.organization_modules i JOIN public.modules c ON c.id=i.module_id
   WHERE i.organization_id=p_org AND i.module_id='attendance' AND c.is_available)
 AND NOT EXISTS(SELECT 1 FROM public.organization_module_overrides o WHERE o.organization_id=p_org AND o.module_id='attendance' AND NOT o.enabled)
 AND CASE WHEN p_write THEN public.clinicx_can_operate(p_org,'staff_management')
   ELSE public.clinicx_can_read(p_org) AND (public.clinicx_effective_state(p_org)='grace_period' OR public.clinicx_can_operate(p_org,'staff_management')) END
$$;
CREATE POLICY clinicx_attendance_read ON public.staff_attendance FOR SELECT TO authenticated
 USING(public.clinicx_attendance_access(organization_id,clinic_id,staff_id,false));

CREATE FUNCTION public.clinicx_attendance_day(p_org uuid,p_date date DEFAULT NULL,p_clinic uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_today date:=(now() AT TIME ZONE 'Asia/Kolkata')::date; v_date date:=coalesce(p_date,v_today);
 v_manage boolean; v_scope uuid; v_roster jsonb; v_records jsonb; v_open jsonb;
BEGIN
 SELECT role IN ('owner','admin'),clinic_id INTO v_manage,v_scope FROM public.organization_members
 WHERE organization_id=p_org AND user_id=auth.uid();
 IF v_manage IS NULL OR (p_clinic IS NOT NULL AND (NOT EXISTS(SELECT 1 FROM public.clinics WHERE id=p_clinic AND organization_id=p_org)
   OR (v_scope IS NOT NULL AND v_scope<>p_clinic))) THEN
   RAISE EXCEPTION 'Attendance access denied: verify clinic membership' USING ERRCODE='42501';
 END IF;
 -- Verify access even when the roster is empty.
 IF NOT public.clinicx_attendance_access(p_org,coalesce(p_clinic,v_scope),'user:'||auth.uid(),false) THEN
   RAISE EXCEPTION 'Install Attendance and verify your plan access; expired access cannot open attendance' USING ERRCODE='42501';
 END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r)-'user_id' ORDER BY r.staff_name,r.staff_id),'[]') INTO v_roster
 FROM public.clinicx_attendance_roster(p_org) r
 WHERE public.clinicx_attendance_access(p_org,r.clinic_id,r.staff_id,false) AND (p_clinic IS NULL OR r.clinic_id=p_clinic);
 SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.staff_name,a.staff_id),'[]') INTO v_records FROM public.staff_attendance a
 WHERE a.organization_id=p_org AND a.attendance_date=v_date
 AND public.clinicx_attendance_access(p_org,a.clinic_id,a.staff_id,false) AND (p_clinic IS NULL OR a.clinic_id=p_clinic);
 SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') INTO v_open FROM public.staff_attendance a
 WHERE a.organization_id=p_org AND a.check_in IS NOT NULL AND a.check_out IS NULL
 AND public.clinicx_attendance_access(p_org,a.clinic_id,a.staff_id,false) AND (p_clinic IS NULL OR a.clinic_id=p_clinic);
 RETURN jsonb_build_object('organization_id',p_org,'date',v_date,'today',v_today,'server_now',now(),
  'timezone','Asia/Kolkata','can_manage',v_manage,'can_write',public.clinicx_can_operate(p_org,'staff_management'),
  'self_id','user:'||auth.uid(),'roster',v_roster,'records',v_records,'open_records',v_open);
END $$;

CREATE FUNCTION public.clinicx_attendance_record(p_org uuid,p_subject text DEFAULT NULL,p_action text DEFAULT 'check_in',
 p_date date DEFAULT NULL,p_status text DEFAULT NULL,p_shift text DEFAULT 'morning',p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_subject text:=coalesce(p_subject,'user:'||auth.uid()); v_staff record; v_row public.staff_attendance;
 v_now timestamptz:=clock_timestamp(); v_today date:=(v_now AT TIME ZONE 'Asia/Kolkata')::date;
 v_date date; v_manage boolean;
BEGIN
 SELECT * INTO v_staff FROM public.clinicx_attendance_roster(p_org) WHERE staff_id=v_subject;
 IF NOT FOUND OR NOT public.clinicx_attendance_access(p_org,v_staff.clinic_id,v_subject,true) THEN
  RAISE EXCEPTION 'Attendance write denied: check your role, clinic, installation and active plan' USING ERRCODE='42501';
 END IF;
 SELECT role IN ('owner','admin') INTO v_manage FROM public.organization_members WHERE organization_id=p_org AND user_id=auth.uid();
 IF p_action IS NULL OR p_action NOT IN ('check_in','check_out','set_status') OR p_shift IS NULL
  OR p_shift NOT IN ('morning','evening','night','full_day') OR length(coalesce(p_notes,''))>1000 THEN
  RAISE EXCEPTION 'Invalid attendance action, shift or notes (maximum 1000 characters)' USING ERRCODE='22023';
 END IF;
 IF p_action='set_status' THEN
  IF NOT v_manage THEN RAISE EXCEPTION 'Only owner/admin can correct attendance status' USING ERRCODE='42501'; END IF;
  IF p_date IS NULL OR p_date>v_today OR p_status IS NULL OR p_status NOT IN ('present','late','half_day','absent','on_leave') THEN
   RAISE EXCEPTION 'Choose a valid status and non-future attendance date' USING ERRCODE='22023';
  END IF;
  v_date:=p_date;
 ELSE
  IF p_date IS NOT NULL OR p_status IS NOT NULL OR p_notes IS NOT NULL THEN
   RAISE EXCEPTION 'Check-in/out uses server time; manual dates, status and notes are not accepted' USING ERRCODE='22023';
  END IF;
  v_date:=v_today;
 END IF;
 -- Serialize the entire subject, not just a date: no double clicks or overlapping overnight shifts.
 PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-attendance:'||p_org||':'||v_subject,0));
 SELECT * INTO v_row FROM public.staff_attendance WHERE organization_id=p_org AND staff_id=v_subject
 AND check_in IS NOT NULL AND check_out IS NULL ORDER BY attendance_date DESC LIMIT 1 FOR UPDATE;
 IF p_action IN ('check_in','check_out') AND FOUND THEN
   IF NOT public.clinicx_attendance_access(p_org,v_row.clinic_id,v_subject,true) THEN
    RAISE EXCEPTION 'Open shift belongs to another clinic; ask your clinic administrator' USING ERRCODE='42501';
   END IF;
   IF p_action='check_in' THEN RETURN to_jsonb(v_row); END IF;
   IF v_now<v_row.check_in THEN RAISE EXCEPTION 'Check-out cannot precede check-in; ask an administrator' USING ERRCODE='22023'; END IF;
   UPDATE public.staff_attendance SET check_out=v_now,working_hours=round((extract(epoch FROM v_now-v_row.check_in)/3600)::numeric,2),updated_at=v_now
    WHERE id=v_row.id RETURNING * INTO v_row;
   RETURN to_jsonb(v_row);
 END IF;
 SELECT * INTO v_row FROM public.staff_attendance WHERE organization_id=p_org AND staff_id=v_subject AND attendance_date=v_date FOR UPDATE;
 IF p_action='check_out' THEN
  IF v_row.id IS NOT NULL AND NOT public.clinicx_attendance_access(p_org,v_row.clinic_id,v_subject,true) THEN
   RAISE EXCEPTION 'Attendance record is outside your clinic scope' USING ERRCODE='42501';
  END IF;
  IF v_row.check_out IS NOT NULL THEN RETURN to_jsonb(v_row); END IF;
  -- A repeat checkout matches today's completion, regardless of the opening date.
  SELECT * INTO v_row FROM public.staff_attendance WHERE organization_id=p_org AND staff_id=v_subject AND check_out IS NOT NULL
   AND (check_out AT TIME ZONE 'Asia/Kolkata')::date=v_today ORDER BY check_out DESC LIMIT 1;
  IF FOUND THEN
   IF NOT public.clinicx_attendance_access(p_org,v_row.clinic_id,v_subject,true) THEN
    RAISE EXCEPTION 'Attendance record is outside your clinic scope' USING ERRCODE='42501';
   END IF;
   RETURN to_jsonb(v_row);
  END IF;
  RAISE EXCEPTION 'Check in before checking out' USING ERRCODE='22023';
 END IF;
 IF v_row.id IS NOT NULL AND NOT public.clinicx_attendance_access(p_org,v_row.clinic_id,v_subject,true) THEN
  RAISE EXCEPTION 'Attendance record is outside your clinic scope' USING ERRCODE='42501';
 END IF;
 IF p_action='check_in' AND v_row.check_in IS NOT NULL THEN RETURN to_jsonb(v_row); END IF;
 IF p_action='set_status' AND p_status IN ('absent','on_leave') AND v_row.check_in IS NOT NULL THEN
  RAISE EXCEPTION 'A clocked shift cannot be marked absent or on leave' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.staff_attendance(organization_id,clinic_id,staff_id,staff_name,staff_role,attendance_date,status,check_in,shift,notes)
 VALUES(p_org,v_staff.clinic_id,v_subject,v_staff.staff_name,v_staff.staff_role,v_date,coalesce(p_status,'present'),
  CASE WHEN p_action='check_in' THEN v_now END,p_shift,p_notes)
 ON CONFLICT(organization_id,staff_id,attendance_date) DO UPDATE SET
  status=CASE WHEN p_action='set_status' THEN excluded.status ELSE 'present' END,
  check_in=CASE WHEN p_action='check_in' THEN coalesce(staff_attendance.check_in,v_now) ELSE staff_attendance.check_in END,
  shift=CASE WHEN p_action='set_status' OR staff_attendance.check_in IS NULL THEN excluded.shift ELSE staff_attendance.shift END,
  notes=CASE WHEN p_action='set_status' THEN excluded.notes ELSE staff_attendance.notes END,updated_at=v_now
 RETURNING * INTO v_row;
 RETURN to_jsonb(v_row);
END $$;
REVOKE ALL ON FUNCTION public.clinicx_attendance_roster(uuid),public.clinicx_attendance_access(uuid,uuid,text,boolean),
 public.clinicx_attendance_day(uuid,date,uuid),public.clinicx_attendance_record(uuid,text,text,date,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clinicx_attendance_access(uuid,uuid,text,boolean),public.clinicx_attendance_day(uuid,date,uuid),
 public.clinicx_attendance_record(uuid,text,text,date,text,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
