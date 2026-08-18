-- Fix permission denied for table system_settings by granting SELECT to authenticated and service_role
-- Also allow anon to read maintenance status so the landing page and login don't log errors
GRANT SELECT ON public.system_settings TO authenticated;
GRANT SELECT ON public.system_settings TO service_role;
GRANT SELECT ON public.system_settings TO anon;

-- Ensure RLS is enabled and policies allow reading these non-sensitive keys
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_settings' AND policyname = 'Allow public read of system settings') THEN
        CREATE POLICY "Allow public read of system settings" ON public.system_settings FOR SELECT USING (true);
    END IF;
END $$;
