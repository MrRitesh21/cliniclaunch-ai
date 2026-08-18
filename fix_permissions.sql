-- Grant SELECT on tables needed for public clinic site to anon role
GRANT SELECT ON public.clinics TO anon;
GRANT SELECT ON public.clinic_domain_secrets TO anon;
GRANT SELECT ON public.organization_modules TO anon;
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT ON public.doctors TO anon;
GRANT SELECT ON public.appointments TO anon;
GRANT SELECT ON public.seo_ai_content TO anon;
GRANT SELECT ON public.organizations TO anon;
GRANT SELECT ON public.site_templates TO anon;
GRANT SELECT ON public.clinic_template_assignments TO anon;

-- Ensure RLS allows these reads (assuming policies exist or adding basic ones)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clinics' AND policyname = 'Allow public read of published clinics') THEN
        CREATE POLICY "Allow public read of published clinics" ON public.clinics FOR SELECT TO anon USING (is_published = true AND suspended_at IS NULL);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'doctors' AND policyname = 'Allow public read of active doctors') THEN
        CREATE POLICY "Allow public read of active doctors" ON public.doctors FOR SELECT TO anon USING (is_active = true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Allow public read of approved reviews') THEN
        CREATE POLICY "Allow public read of approved reviews" ON public.reviews FOR SELECT TO anon USING (status = 'approved');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_templates' AND policyname = 'Allow public read of active global templates') THEN
        CREATE POLICY "Allow public read of active global templates" ON public.site_templates FOR SELECT TO anon USING (is_active = true AND is_global = true);
    END IF;
END $$;
