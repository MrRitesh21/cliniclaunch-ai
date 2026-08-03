
-- Allow anyone (anon or authenticated) to read invites; the token in the URL is the unguessable secret.
DROP POLICY IF EXISTS "Anyone can read invite by token" ON public.organization_invites;
CREATE POLICY "Anyone can read invite by token" ON public.organization_invites
  FOR SELECT TO anon, authenticated
  USING (true);

-- Allow authenticated users to mark their own invite (matching their email) as accepted.
DROP POLICY IF EXISTS "Invitee can accept own invite" ON public.organization_invites;
CREATE POLICY "Invitee can accept own invite" ON public.organization_invites
  FOR UPDATE TO authenticated
  USING (lower(email) = lower(coalesce(auth.jwt()->>'email','')) AND accepted_at IS NULL AND expires_at > now())
  WITH CHECK (lower(email) = lower(coalesce(auth.jwt()->>'email','')));

-- Allow a user to add themselves to an organization if they have a valid pending invite matching their email.
DROP POLICY IF EXISTS "Invitee can join via valid invite" ON public.organization_members;
CREATE POLICY "Invitee can join via valid invite" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.organization_invites i
      WHERE i.organization_id = organization_members.organization_id
        AND lower(i.email) = lower(coalesce(auth.jwt()->>'email',''))
        AND i.accepted_at IS NULL
        AND i.expires_at > now()
        AND i.role = organization_members.role
    )
  );
