-- ============================================================================
-- P0 SECURITY HARDENING  (part 1 of 2)
-- ----------------------------------------------------------------------------
-- Fixes confirmed cross-tenant data-exposure regressions. All changes drop
-- over-permissive policies / revoke unnecessary grants and are safe:
--   * Public booking reads taken slots via the getBookedSlots server function
--     (service role, `scheduled_at` only) — anon never needs table read access.
--   * Admin panel + getVerifiedAdmin() read admin tables via the service-role
--     client (bypasses RLS) — the authenticated browser role never needs them.
-- Idempotent: safe to re-run.
--
-- NOTE: anon read of `public.clinics` is intentionally NOT touched here. One
-- browser path (r.$slug review redirect) still reads it directly; that is
-- migrated to a server function in the companion change, after which a second
-- migration will revoke anon read on clinics.
-- ============================================================================

-- 1) appointments: a full-row anonymous SELECT policy was reintroduced by
--    20260621112814, undoing the 20260620123533 hardening. With the anon key
--    shipped in the browser bundle, this let ANY visitor read every clinic's
--    patient_name / patient_phone / notes across all tenants (PII / PHI leak).
--    Remove it. Authenticated clinic staff keep access via the org/clinic-member
--    policies ("members read appointments", "owner read appointments").
DROP POLICY IF EXISTS "public read appointment slots" ON public.appointments;
DROP POLICY IF EXISTS "public read appointments"       ON public.appointments;
REVOKE SELECT ON public.appointments FROM anon;

-- 2) admin_users: "Admins read admin_users FOR SELECT TO authenticated
--    USING(true)" let ANY logged-in clinic user read the admin table, including
--    password_hash. Combined with unsalted SHA-256 hashes this is a full
--    admin-account compromise vector. Admin auth uses the service-role client
--    which bypasses RLS, so closing this does not affect admin login.
DROP POLICY IF EXISTS "Admins read admin_users" ON public.admin_users;
REVOKE SELECT ON public.admin_users FROM authenticated, anon;

-- 3) admin_audit_logs: same over-exposure — every authenticated user could read
--    the cross-tenant admin action log. The admin panel reads it via server
--    functions (service role), never from the browser.
DROP POLICY IF EXISTS "Admins read audit logs" ON public.admin_audit_logs;
REVOKE SELECT ON public.admin_audit_logs FROM authenticated, anon;
