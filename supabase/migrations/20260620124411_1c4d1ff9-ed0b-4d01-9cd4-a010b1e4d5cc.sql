
DROP POLICY IF EXISTS "owner read clinic" ON public.clinics;
CREATE POLICY "owner read clinic" ON public.clinics
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);
