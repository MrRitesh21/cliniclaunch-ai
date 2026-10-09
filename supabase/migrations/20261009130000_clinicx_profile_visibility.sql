-- Forward-only correction: staff-name reads must not expose the global profile
-- directory. Preserve existing rows and own-profile write policies.
-- Public clinic pages use their dedicated public DTOs, not public.profiles.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE SELECT ON public.profiles FROM PUBLIC, anon;
GRANT SELECT ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Organization members can view peer profiles" ON public.profiles;
CREATE POLICY "Organization members can view peer profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.organization_members AS peer
    JOIN public.organization_members AS caller
      ON caller.organization_id = peer.organization_id
    WHERE peer.user_id = profiles.id
      AND caller.user_id = auth.uid()
  )
);

NOTIFY pgrst, 'reload schema';
