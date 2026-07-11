
-- =========================================================
-- 1) admin_audit_logs: drop the always-true authenticated SELECT
-- =========================================================
DROP POLICY IF EXISTS "Admins read audit logs" ON public.admin_audit_logs;

-- =========================================================
-- 2) admin_users: drop the always-true authenticated SELECT
--    (service_role ALL policy remains for admin server code)
-- =========================================================
DROP POLICY IF EXISTS "Admins read admin_users" ON public.admin_users;

-- =========================================================
-- 3) clinics: hide private / WhatsApp columns from anon
--    (org members still access via authenticated role)
-- =========================================================
REVOKE SELECT (personal_phone, personal_email, wa_phone, wa_session_id, wa_linked_by)
  ON public.clinics FROM anon;

-- =========================================================
-- 4) organization_invites: replace blanket policy with token RPC
-- =========================================================
DROP POLICY IF EXISTS "Anyone can read invite by token" ON public.organization_invites;

CREATE OR REPLACE FUNCTION public.get_invite_by_token(_token text)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  email text,
  role org_role,
  expires_at timestamptz,
  accepted_at timestamptz,
  organization_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.organization_id, i.email, i.role, i.expires_at, i.accepted_at, o.name
  FROM public.organization_invites i
  LEFT JOIN public.organizations o ON o.id = i.organization_id
  WHERE i.token = _token
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon, authenticated;

-- =========================================================
-- 5) review_qr_codes: fix broken "IN (SELECT id FROM organizations)"
-- =========================================================
DROP POLICY IF EXISTS "Org members manage QR codes" ON public.review_qr_codes;
DROP POLICY IF EXISTS "Org members read QR codes" ON public.review_qr_codes;

CREATE POLICY "Org members read QR codes"
  ON public.review_qr_codes
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Org members manage QR codes"
  ON public.review_qr_codes
  FOR ALL
  TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- =========================================================
-- 6) Storage: drop overly broad listing policy on clinic-media
--    (public bucket URLs still serve files without SELECT policy)
-- =========================================================
DROP POLICY IF EXISTS "Public read clinic-media" ON storage.objects;

-- =========================================================
-- 7) Lock down SECURITY DEFINER trigger-only functions
--    (RLS helper functions keep EXECUTE for authenticated)
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.add_creator_as_owner() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_clinic_domain_secret() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fill_appointment_org_from_clinic() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fill_org_from_clinic() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fill_patient_org_from_clinic() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_invoice_paid() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at_patient_invoices() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_clinic_legacy_fields() FROM PUBLIC, anon, authenticated;

-- =========================================================
-- 8) Set immutable search_path on the last mutable function
-- =========================================================
ALTER FUNCTION public.sync_clinic_legacy_fields() SET search_path = public;
