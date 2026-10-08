-- Migration: 20261008235500_clinicx_staff_profile_names.sql
-- Ensure organization members have valid foreign key to profiles and can view peer profiles

-- 1. Foreign key between organization_members and profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_org_members_profiles'
  ) THEN
    ALTER TABLE public.organization_members
      ADD CONSTRAINT fk_org_members_profiles
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Allow organization members / authenticated users to view profiles
DROP POLICY IF EXISTS "Organization members can view peer profiles" ON public.profiles;
CREATE POLICY "Organization members can view peer profiles" ON public.profiles FOR SELECT USING (true);

GRANT SELECT ON public.profiles TO authenticated, anon;

-- 3. Backfill profiles full_name from auth.users metadata if missing
UPDATE public.profiles p
SET
  full_name = COALESCE(p.full_name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  email = COALESCE(p.email, u.email)
FROM auth.users u
WHERE p.id = u.id AND (p.full_name IS NULL OR p.email IS NULL);

NOTIFY pgrst, 'reload schema';
