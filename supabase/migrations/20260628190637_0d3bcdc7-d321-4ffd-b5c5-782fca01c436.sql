DROP POLICY IF EXISTS "Allow public appointment booking" ON public.appointments;
DROP POLICY IF EXISTS "public can book" ON public.appointments;

CREATE POLICY "appointments_public_insert"
ON public.appointments
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

NOTIFY pgrst, 'reload schema';