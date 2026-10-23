-- ============================================================================
-- FIX: 1-Click Clinic Setup from the Doctor CRM & AI Outreach silently failed.
--
-- Root cause: `trg_add_creator_as_owner` (AFTER INSERT ON organizations) calls
-- add_creator_as_owner(), which inserted organization_members(user_id = auth.uid()).
-- Platform provisioning (setupCompleteClinicFromLeadImpl) runs with the Supabase
-- service role, where auth.uid() IS NULL. organization_members.user_id is NOT NULL,
-- so EVERY service-role organization insert was rolled back with a 23502 violation.
-- The clinics insert then failed on its organizations(id) foreign key, and the
-- application swallowed both PostgREST errors, still returning a "live" URL that
-- rendered as "Clinic not found".
--
-- Fix: skip creator auto-membership only for non-interactive (no-JWT) writes.
-- Self-signup flows (authenticated JWT present) keep the owner auto-membership.
-- Platform-provisioned organizations intentionally have no member rows yet — the
-- doctor does not have an account until they sign up and claim the workspace.
-- Idempotent and safe to re-run.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_creator_as_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Platform/service-role provisioning has no creator account yet: skip membership.
  -- (Supabase service-role requests run without a JWT, so auth.uid() is NULL.)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (NEW.id, auth.uid(), 'owner')
    ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
