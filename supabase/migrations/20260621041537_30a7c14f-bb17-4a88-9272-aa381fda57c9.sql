
-- 1. Role enum
DO $$ BEGIN
  CREATE TYPE public.clinic_role AS ENUM ('owner', 'doctor', 'receptionist', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. clinic_members table
CREATE TABLE IF NOT EXISTS public.clinic_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.clinic_role NOT NULL DEFAULT 'staff',
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_clinic_members_user ON public.clinic_members(user_id);
CREATE INDEX IF NOT EXISTS idx_clinic_members_clinic ON public.clinic_members(clinic_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_members TO authenticated;
GRANT ALL ON public.clinic_members TO service_role;

ALTER TABLE public.clinic_members ENABLE ROW LEVEL SECURITY;

-- 3. Security-definer helpers
CREATE OR REPLACE FUNCTION public.is_clinic_member(_clinic_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_members
    WHERE clinic_id = _clinic_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.has_clinic_role(_clinic_id uuid, _user_id uuid, _roles public.clinic_role[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_members
    WHERE clinic_id = _clinic_id
      AND user_id = _user_id
      AND role = ANY(_roles)
  )
$$;

CREATE OR REPLACE FUNCTION public.user_clinic_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT clinic_id FROM public.clinic_members WHERE user_id = _user_id
$$;

-- 4. Auto-add owner on clinic create
CREATE OR REPLACE FUNCTION public.add_owner_as_clinic_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.clinic_members (clinic_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner')
    ON CONFLICT (clinic_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clinics_add_owner_member ON public.clinics;
CREATE TRIGGER clinics_add_owner_member
AFTER INSERT ON public.clinics
FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_clinic_member();

-- 5. Backfill existing owners
INSERT INTO public.clinic_members (clinic_id, user_id, role)
SELECT id, owner_id, 'owner' FROM public.clinics WHERE owner_id IS NOT NULL
ON CONFLICT (clinic_id, user_id) DO NOTHING;

-- 6. updated_at trigger
DROP TRIGGER IF EXISTS clinic_members_set_updated_at ON public.clinic_members;
CREATE TRIGGER clinic_members_set_updated_at
BEFORE UPDATE ON public.clinic_members
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. RLS policies on clinic_members
DROP POLICY IF EXISTS "members read own clinics" ON public.clinic_members;
CREATE POLICY "members read own clinics" ON public.clinic_members
FOR SELECT TO authenticated
USING (public.is_clinic_member(clinic_id, auth.uid()));

DROP POLICY IF EXISTS "owners manage members" ON public.clinic_members;
CREATE POLICY "owners manage members" ON public.clinic_members
FOR ALL TO authenticated
USING (public.has_clinic_role(clinic_id, auth.uid(), ARRAY['owner']::public.clinic_role[]))
WITH CHECK (public.has_clinic_role(clinic_id, auth.uid(), ARRAY['owner']::public.clinic_role[]));

-- 8. Extend clinic access to all members
DROP POLICY IF EXISTS "owner read clinic" ON public.clinics;
DROP POLICY IF EXISTS "members read clinic" ON public.clinics;
CREATE POLICY "members read clinic" ON public.clinics
FOR SELECT TO authenticated
USING (public.is_clinic_member(id, auth.uid()) OR auth.uid() = owner_id);

-- 9. Extend patients to all members
DROP POLICY IF EXISTS "members manage patients" ON public.patients;
CREATE POLICY "members manage patients" ON public.patients
FOR ALL TO authenticated
USING (public.is_clinic_member(clinic_id, auth.uid()))
WITH CHECK (public.is_clinic_member(clinic_id, auth.uid()));

-- 10. Extend appointments to all members
DROP POLICY IF EXISTS "members manage appointments" ON public.appointments;
CREATE POLICY "members manage appointments" ON public.appointments
FOR ALL TO authenticated
USING (public.is_clinic_member(clinic_id, auth.uid()))
WITH CHECK (public.is_clinic_member(clinic_id, auth.uid()));

-- 11. Extend leads to all members
DROP POLICY IF EXISTS "members manage leads" ON public.leads;
CREATE POLICY "members manage leads" ON public.leads
FOR ALL TO authenticated
USING (public.is_clinic_member(clinic_id, auth.uid()))
WITH CHECK (public.is_clinic_member(clinic_id, auth.uid()));

-- 12. Audit log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_clinic ON public.audit_log(clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log(actor_id);

GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners read audit" ON public.audit_log;
CREATE POLICY "owners read audit" ON public.audit_log
FOR SELECT TO authenticated
USING (clinic_id IS NOT NULL AND public.has_clinic_role(clinic_id, auth.uid(), ARRAY['owner']::public.clinic_role[]));

DROP POLICY IF EXISTS "members insert audit" ON public.audit_log;
CREATE POLICY "members insert audit" ON public.audit_log
FOR INSERT TO authenticated
WITH CHECK (clinic_id IS NULL OR public.is_clinic_member(clinic_id, auth.uid()));
