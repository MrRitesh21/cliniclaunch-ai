-- ============================================================================
-- P0 SECURITY HARDENING  (part 2 of 2)
-- ----------------------------------------------------------------------------
-- clinics and organizations were world-readable: their only SELECT policy was
-- `USING (true)` granted to anon + authenticated. With the anon key shipped in
-- the browser bundle, anyone could read owner_id, personal_email/phone and
-- internal config for every tenant.
--
-- The public microsite (/c/$slug) and the review page (/r/$slug) read these
-- tables through service-role server functions (getClinicBySlug,
-- getReviewPageContext, resolveAvailableOrgSlug) which bypass RLS, so anon
-- needs no direct table access. Authenticated dashboard reads are re-scoped to
-- org membership. The org-creator is auto-added as an 'owner' member by the
-- trg_add_creator_as_owner trigger, so owners retain access.
-- Idempotent.
-- ============================================================================

-- ── organizations ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "public read organizations" ON public.organizations;
DROP POLICY IF EXISTS "members read organizations" ON public.organizations;
CREATE POLICY "members read organizations" ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()));
REVOKE SELECT ON public.organizations FROM anon;

-- ── clinics ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "public read clinics" ON public.clinics;
DROP POLICY IF EXISTS "public read clinic"  ON public.clinics;
DROP POLICY IF EXISTS "members read clinics" ON public.clinics;
CREATE POLICY "members read clinics" ON public.clinics
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_org_member(organization_id, auth.uid())
  );
REVOKE SELECT ON public.clinics FROM anon;
