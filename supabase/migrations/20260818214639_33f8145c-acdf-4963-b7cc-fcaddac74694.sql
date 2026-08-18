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

-- Ensure RLS allows these reads for published/active content
DO $$ 
BEGIN
    -- Clinics policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clinics' AND policyname = 'Allow public read of published clinics') THEN
        CREATE POLICY "Allow public read of published clinics" ON public.clinics FOR SELECT TO anon USING (is_published = true AND (suspended_at IS NULL OR suspended_at > now()));
    END IF;

    -- Doctors policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'doctors' AND policyname = 'Allow public read of active doctors') THEN
        CREATE POLICY "Allow public read of active doctors" ON public.doctors FOR SELECT TO anon USING (is_active = true);
    END IF;

    -- Reviews policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Allow public read of approved reviews') THEN
        CREATE POLICY "Allow public read of approved reviews" ON public.reviews FOR SELECT TO anon USING (status = 'approved');
    END IF;

    -- Templates policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_templates' AND policyname = 'Allow public read of active global templates') THEN
        CREATE POLICY "Allow public read of active global templates" ON public.site_templates FOR SELECT TO anon USING (is_active = true AND is_global = true);
    END IF;

    -- Assignments policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clinic_template_assignments' AND policyname = 'Allow public read of assignments') THEN
        CREATE POLICY "Allow public read of assignments" ON public.clinic_template_assignments FOR SELECT TO anon USING (true);
    END IF;

    -- Organization modules policy (needed for feature gating)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organization_modules' AND policyname = 'Allow public read of installed modules') THEN
        CREATE POLICY "Allow public read of installed modules" ON public.organization_modules FOR SELECT TO anon USING (true);
    END IF;
END $$;
