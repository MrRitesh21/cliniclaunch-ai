DROP POLICY IF EXISTS "Public can read active doctors" ON public.doctors;

CREATE POLICY "Public can read active doctors of published clinics"
ON public.doctors
FOR SELECT
TO anon, authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  OR (
    is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.clinics c
      WHERE c.id = doctors.clinic_id
        AND c.is_published = true
        AND c.suspended_at IS NULL
    )
  )
);