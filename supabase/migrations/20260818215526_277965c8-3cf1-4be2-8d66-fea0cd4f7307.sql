-- Fix permission denied for table system_settings
GRANT SELECT ON public.system_settings TO authenticated;
GRANT SELECT ON public.system_settings TO service_role;
GRANT SELECT ON public.system_settings TO anon;

-- Ensure RLS is enabled and policies allow reading these keys
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_settings' AND policyname = 'Allow public read of system settings') THEN
        CREATE POLICY "Allow public read of system settings" ON public.system_settings FOR SELECT USING (true);
    END IF;
END $$;
