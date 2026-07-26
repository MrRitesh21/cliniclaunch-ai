
-- Lock down anon access to sensitive tables; public reads now go through server functions using service role.

-- 1) appointments: remove anon SELECT (exposed PII)
DROP POLICY IF EXISTS "public read appointment slots" ON public.appointments;

-- 2) patients: remove permissive anon UPDATE (anyone could overwrite any patient)
DROP POLICY IF EXISTS "public update patient on upsert" ON public.patients;

-- 3) clinics: remove anon SELECT; public clinic site reads via server function
DROP POLICY IF EXISTS "public read clinics" ON public.clinics;

-- 4) Lock down SECURITY DEFINER trigger/event-trigger functions from API roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
