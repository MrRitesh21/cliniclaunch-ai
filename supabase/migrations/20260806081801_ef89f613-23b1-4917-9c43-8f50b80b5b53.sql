-- 1. Revoke EXECUTE on internal SECURITY DEFINER helpers from public API roles
REVOKE ALL ON FUNCTION public.award_loyalty_on_revenue() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.fill_expense_org_from_clinic() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.ledger_from_appointment() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.ledger_from_expense() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.ledger_from_payment() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.ledger_from_pharmacy_sale() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.ledger_remove_expense() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.ledger_remove_payment() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.link_lead_on_appointment() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.sync_appointment_to_queue() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.expire_lapsed_subscriptions() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_lapsed_subscriptions() TO service_role;

-- 2. Public lead submissions must reference a real, active clinic in the same org
DROP POLICY IF EXISTS "public can submit lead" ON public.leads;
CREATE POLICY "public can submit lead" ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    clinic_id IS NOT NULL
    AND organization_id IS NOT NULL
    AND COALESCE(name, '') <> ''
    AND EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = leads.clinic_id
        AND c.organization_id = leads.organization_id
        AND c.suspended_at IS NULL
    )
  );

-- 3. Organization creation requires real values
DROP POLICY IF EXISTS "authenticated create org" ON public.organizations;
CREATE POLICY "authenticated create org" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND COALESCE(name, '') <> ''
    AND COALESCE(slug, '') <> ''
  );
