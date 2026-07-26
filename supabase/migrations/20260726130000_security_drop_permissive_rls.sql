-- ============================================================
-- SECURITY HARDENING: remove overly-permissive RLS policies
--
-- Three data leaks, all caused by `USING (true)` policies that
-- were superseded by service-role server functions but never
-- removed.
-- ============================================================

-- ------------------------------------------------------------
-- 1. CRITICAL: admin_users.password_hash was readable by any
--    signed-in clinic user.
--
--    Original: 20260628090500_super_admin_panel.sql:18
--      CREATE POLICY "Admins read admin_users" ON public.admin_users
--        FOR SELECT TO authenticated USING (true);
--
--    Admin auth runs entirely server-side via src/lib/admin.server.ts
--    and src/lib/admin-auth.functions.ts using the service role, so
--    the `authenticated` grant has no consumer.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admins read admin_users" ON public.admin_users;
REVOKE ALL ON public.admin_users FROM anon, authenticated;

-- Same problem on the audit log (20260628090500:51) — leaks every
-- admin action, including which orgs were suspended/refunded.
DROP POLICY IF EXISTS "Admins read audit logs" ON public.admin_audit_logs;
REVOKE ALL ON public.admin_audit_logs FROM anon, authenticated;

-- admin_sessions holds live session tokens; make sure it is
-- service_role-only too.
REVOKE ALL ON public.admin_sessions FROM anon, authenticated;
REVOKE ALL ON public.admin_login_failures FROM anon, authenticated;

-- ------------------------------------------------------------
-- 2. CRITICAL: the entire appointments table (patient_name,
--    patient_phone, patient_email, scheduled_at) was readable by
--    anonymous internet users.
--
--    Original: 20260620070322_...:69, re-created 20260621112814_...:8
--      CREATE POLICY "public read appointment slots" ON public.appointments
--        FOR SELECT TO anon USING (true);
--
--    Every public slot-availability read now goes through server
--    functions in src/lib/clinic.functions.ts (lines 299, 360, 377,
--    390, 511, 528) which use the service-role client.
--
--    Public booking still works: it is an INSERT, covered by the
--    "public book appointment" policy (20260620070322:67) and the
--    anon INSERT grant — this REVOKE touches SELECT only.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "public read appointment slots" ON public.appointments;
REVOKE SELECT ON public.appointments FROM anon;

-- ------------------------------------------------------------
-- 3. HIGH: the whole clinics row was readable by anon — including
--    personal_phone / personal_email, and unpublished draft sites,
--    which bypassed the is_published gate enforced by
--    getClinicBySlug().
--
--    Originals: 20260620070322_...:41, 20260621120020_...:360
--               ("public read clinics") and 20260621112814_...:4
--               ("public read clinic").
--
--    The public site reads clinics through getClinicBySlug() /
--    resolveHostToClinic() on the service role — see the comment at
--    src/lib/clinic.functions.ts:142 which already notes this grant
--    is unnecessary.
--
--    Signed-in staff keep access via the "members manage clinic"
--    policy (FOR ALL, is_org_member) created in 20260621120020:361.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "public read clinics" ON public.clinics;
DROP POLICY IF EXISTS "public read clinic" ON public.clinics;
REVOKE SELECT ON public.clinics FROM anon;
