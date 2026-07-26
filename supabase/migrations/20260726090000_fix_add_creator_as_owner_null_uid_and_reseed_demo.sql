-- add_creator_as_owner inserted auth.uid() into organization_members.user_id, which is NOT NULL.
-- Outside a JWT session (migrations, service-role jobs, seeds) auth.uid() is NULL, so the trigger
-- aborted the whole INSERT on public.organizations. That is why 20260715060000_seed_demo_clinic.sql
-- never produced a clinic: /c/sunrise-skin-demo 404s in production while /c/demo-clinic (created
-- through the app, with a real auth.uid()) serves 200.
CREATE OR REPLACE FUNCTION public.add_creator_as_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'owner')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END $function$;

-- Fixing the trigger alone changes nothing on a database where the seed already ran, so re-run
-- the idempotent seed. Guarded: on a database that never got 20260715060000 the function does
-- not exist, and a hard reference would fail this migration for an unrelated reason.
DO $do$
BEGIN
  IF to_regprocedure('public.seed_demo_clinic()') IS NOT NULL THEN
    PERFORM public.seed_demo_clinic();
  ELSE
    RAISE NOTICE 'seed_demo_clinic() absent; skipping demo reseed.';
  END IF;
END $do$;
