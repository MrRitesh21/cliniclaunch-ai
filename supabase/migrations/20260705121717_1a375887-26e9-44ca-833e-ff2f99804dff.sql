
-- 1. Appointments: verify clinic exists and belongs to organization_id
DROP POLICY IF EXISTS "appointments_public_insert" ON public.appointments;
CREATE POLICY "appointments_public_insert" ON public.appointments
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    clinic_id IS NOT NULL
    AND organization_id IS NOT NULL
    AND scheduled_at IS NOT NULL
    AND patient_name IS NOT NULL
    AND COALESCE(patient_name, '') <> ''
    AND EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = clinic_id
        AND c.organization_id = appointments.organization_id
        AND c.suspended_at IS NULL
    )
  );

-- 2. Reviews: verify clinic belongs to organization_id
DROP POLICY IF EXISTS "Public can submit reviews" ON public.reviews;
CREATE POLICY "Public can submit reviews" ON public.reviews
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'pending'
    AND rating >= 1 AND rating <= 5
    AND clinic_id IS NOT NULL
    AND organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = clinic_id
        AND c.organization_id = reviews.organization_id
        AND c.suspended_at IS NULL
    )
  );

-- 3. Coupon codes: remove broad public read; validation goes through secure server fn.
DROP POLICY IF EXISTS "All read active coupons" ON public.coupon_codes;
REVOKE SELECT ON public.coupon_codes FROM anon;

-- 4. Revoke anon EXECUTE on internal RLS helper functions (kept for authenticated for RLS).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, org_role[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_org_ids(uuid) FROM anon, public;
