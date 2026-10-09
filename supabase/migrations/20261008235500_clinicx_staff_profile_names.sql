-- Migration: 20261008235500_clinicx_staff_profile_names.sql
-- Allow authenticated & anon users to view public profiles

DROP POLICY IF EXISTS "Organization members can view peer profiles" ON public.profiles;
CREATE POLICY "Organization members can view peer profiles" ON public.profiles FOR SELECT USING (true);

GRANT SELECT ON public.profiles TO authenticated, anon;

-- Backfill profiles full_name from auth.users metadata if missing
UPDATE public.profiles p
SET
  full_name = COALESCE(p.full_name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))
FROM auth.users u
WHERE p.id = u.id AND p.full_name IS NULL;

NOTIFY pgrst, 'reload schema';
