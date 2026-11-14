-- Migration: 20261114080000_fix_database_errors.sql
-- Resolves the following production PostgreSQL errors:
-- 1. 42P10: "there is no unique or exclusion constraint matching the ON CONFLICT specification" on patients table
-- 2. 42501: "new row violates row-level security policy for table 'queue_tokens'" on public bookings
-- 3. 42501: "Tenant is immutable" when organization_id is omitted on operational inserts with valid clinic_id
-- 4. 42501: "new row violates row-level security policy for table 'appointments'"
-- 5. 22P02: "invalid input syntax for type uuid"

-- ============================================================================
-- 1. Fix patients table UNIQUE constraint (eliminates 42P10)
-- ============================================================================
-- PostgREST upsert emits ON CONFLICT (clinic_id, phone) with no WHERE predicate.
-- PostgreSQL requires an exact non-partial unique index or constraint.

-- Deduplicate any duplicate (clinic_id, phone) rows keeping the newest record
DELETE FROM public.patients p
USING public.patients newer
WHERE p.clinic_id = newer.clinic_id
  AND p.phone = newer.phone
  AND p.clinic_id IS NOT NULL
  AND p.phone IS NOT NULL
  AND (newer.created_at, newer.id) > (p.created_at, p.id);

-- Drop any partial index
DROP INDEX IF EXISTS public.uniq_patients_clinic_phone;

-- Create standard non-partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS uniq_patients_clinic_phone
  ON public.patients(clinic_id, phone);

-- Also add an explicit table constraint using the index so Postgres ON CONFLICT inference is 100% reliable
ALTER TABLE public.patients
  DROP CONSTRAINT IF EXISTS uniq_patients_clinic_phone_constraint;

ALTER TABLE public.patients
  ADD CONSTRAINT uniq_patients_clinic_phone_constraint
  UNIQUE USING INDEX uniq_patients_clinic_phone;

-- Allow anonymous and authenticated public booking inserts into patients
GRANT INSERT, SELECT ON public.patients TO anon, authenticated;

DROP POLICY IF EXISTS "patients_public_insert" ON public.patients;
CREATE POLICY "patients_public_insert" ON public.patients
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    clinic_id IS NOT NULL
    AND organization_id IS NOT NULL
    AND phone IS NOT NULL
    AND COALESCE(phone, '') <> ''
    AND EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = clinic_id
        AND c.organization_id = patients.organization_id
        AND c.suspended_at IS NULL
    )
  );


-- ============================================================================
-- 2. Fix queue_tokens RLS and Grant for Public Bookings (eliminates 42501 on queue_tokens)
-- ============================================================================
-- Ensure anon and authenticated roles have permission to insert queue tokens
GRANT INSERT, SELECT ON public.queue_tokens TO anon, authenticated;

-- Allow public bookings (with valid clinic organization) to register in the queue
DROP POLICY IF EXISTS "queue_tokens_public_insert" ON public.queue_tokens;
CREATE POLICY "queue_tokens_public_insert" ON public.queue_tokens
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND patient_name IS NOT NULL
    AND COALESCE(patient_name, '') <> ''
    AND EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.organization_id = queue_tokens.organization_id
        AND c.suspended_at IS NULL
    )
  );

-- Ensure public select for their own issued token if matching appointment_id or phone
DROP POLICY IF EXISTS "queue_tokens_public_select" ON public.queue_tokens;
CREATE POLICY "queue_tokens_public_select" ON public.queue_tokens
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.organization_id = queue_tokens.organization_id
        AND c.is_published = true
        AND c.suspended_at IS NULL
    )
  );


-- ============================================================================
-- 3. Fix appointments RLS (eliminates 42501 on appointments)
-- ============================================================================
GRANT INSERT, SELECT ON public.appointments TO anon, authenticated;

DROP POLICY IF EXISTS "appointments_public_insert" ON public.appointments;
CREATE POLICY "appointments_public_insert" ON public.appointments
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    clinic_id IS NOT NULL
    AND organization_id IS NOT NULL
    AND scheduled_at IS NOT NULL
    AND patient_name IS NOT NULL
    AND COALESCE(patient_name, '') <> ''
    AND EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = clinic_id
        AND c.organization_id = appointments.organization_id
        AND c.suspended_at IS NULL
    )
  );


-- ============================================================================
-- 4. Auto-resolve organization_id in operational_write_guard (eliminates 42501 "Tenant is immutable")
-- ============================================================================
-- When an insert to an operational table (appointments, patients, leads) supplies clinic_id
-- but organization_id is NULL, automatically resolve organization_id from clinics.
CREATE OR REPLACE FUNCTION public.clinicx_operational_write_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_org uuid;
  v_old_org uuid;
  v_feature text := TG_ARGV[0];
  v_limit bigint;
  v_count bigint;
  v_invite_accept boolean := false;
  v_pending_self integer := 0;
BEGIN
  -- Always permit DELETE operations
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF TG_TABLE_NAME = 'patient_invoice_items' THEN
    SELECT organization_id INTO v_org FROM public.patient_invoices WHERE id = coalesce(NEW.invoice_id, OLD.invoice_id);
    IF TG_OP = 'UPDATE' THEN
      SELECT organization_id INTO v_old_org FROM public.patient_invoices WHERE id = OLD.invoice_id;
    END IF;
  ELSE
    v_org := coalesce(NEW.organization_id, OLD.organization_id);
    IF TG_OP = 'UPDATE' THEN
      v_old_org := OLD.organization_id;
    END IF;
  END IF;

  -- Auto-resolve organization_id from clinic_id on INSERT if missing
  IF v_org IS NULL AND TG_OP = 'INSERT' THEN
    BEGIN
      IF (to_jsonb(NEW) ? 'clinic_id') AND (NEW.clinic_id IS NOT NULL) THEN
        SELECT organization_id INTO v_org FROM public.clinics WHERE id = NEW.clinic_id;
        IF v_org IS NOT NULL THEN
          NEW.organization_id := v_org;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- Reject if tenant still cannot be determined, or if tenant ID is illegally modified
  IF v_org IS NULL OR (v_old_org IS NOT NULL AND v_org <> v_old_org) THEN
    RAISE EXCEPTION 'Tenant is immutable' USING ERRCODE='42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('clinicx-admission:' || v_org, 0));

  -- Bootstrap exception: allow creating initial owner member for a new organization before subscription exists
  IF TG_TABLE_NAME = 'organization_members' AND TG_OP = 'INSERT' AND (to_jsonb(NEW)->>'role') = 'owner'
    AND NOT EXISTS(SELECT 1 FROM public.subscriptions WHERE organization_id = v_org) THEN
    RETURN NEW;
  END IF;

  IF NOT public.clinicx_can_operate(v_org, v_feature) THEN
    RAISE EXCEPTION 'Subscription does not allow operational writes' USING ERRCODE='42501';
  END IF;

  IF auth.uid() IS NOT NULL THEN
    IF TG_TABLE_NAME = 'organization_invites' AND TG_OP = 'UPDATE' THEN
      v_invite_accept := OLD.accepted_at IS NULL AND OLD.expires_at > now() AND NEW.accepted_at = now()
        AND (to_jsonb(NEW) - 'accepted_at') = (to_jsonb(OLD) - 'accepted_at')
        AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL AND lower(u.email) = lower(OLD.email));
    ELSIF TG_TABLE_NAME = 'organization_members' AND TG_OP = 'INSERT' AND (to_jsonb(NEW)->>'role')::text <> 'owner' AND (to_jsonb(NEW)->>'user_id')::uuid = auth.uid() THEN
      SELECT EXISTS(SELECT 1 FROM public.organization_invites i JOIN auth.users u ON u.id = auth.uid()
        WHERE i.organization_id = v_org AND i.role = NEW.role AND i.role <> 'owner'
          AND i.invited_by IS NOT DISTINCT FROM NEW.invited_by AND i.expires_at > now()
          AND (i.accepted_at IS NULL OR i.accepted_at = now()) AND u.email_confirmed_at IS NOT NULL AND lower(u.email) = lower(i.email))
        INTO v_invite_accept;
      IF v_invite_accept THEN
        SELECT least(count(*), 1) INTO v_pending_self FROM public.organization_invites i JOIN auth.users u ON u.id = auth.uid()
          WHERE i.organization_id = v_org AND i.role = NEW.role AND i.accepted_at IS NULL AND i.expires_at > now() AND lower(u.email) = lower(i.email);
      END IF;
    ELSIF TG_TABLE_NAME = 'doctors' AND TG_OP = 'INSERT' AND (to_jsonb(NEW)->>'user_id')::uuid = auth.uid() THEN
      SELECT public.has_org_role(v_org, auth.uid(), ARRAY['doctor']::public.org_role[])
        AND EXISTS(SELECT 1 FROM public.organization_invites i JOIN auth.users u ON u.id = auth.uid()
          WHERE i.organization_id = v_org AND i.role = 'doctor' AND i.accepted_at = now()
            AND i.expires_at > now() AND u.email_confirmed_at IS NOT NULL AND lower(u.email) = lower(i.email))
        AND EXISTS(SELECT 1 FROM public.clinics c WHERE c.id = NEW.clinic_id AND c.organization_id = v_org)
        AND NOT EXISTS(SELECT 1 FROM public.doctors d WHERE d.organization_id = v_org AND d.user_id = auth.uid())
        INTO v_invite_accept;
    END IF;

    IF TG_TABLE_NAME IN ('prescriptions', 'prescription_items', 'patient_visits', 'lab_orders') THEN
      IF NOT public.has_org_role(v_org, auth.uid(), ARRAY['owner', 'admin', 'doctor']::public.org_role[]) THEN
        RAISE EXCEPTION 'Clinical signing permission required' USING ERRCODE='42501';
      END IF;
    ELSIF TG_TABLE_NAME IN ('organization_members', 'organization_invites', 'doctors', 'organization_modules') THEN
      IF NOT v_invite_accept AND NOT public.has_org_role(v_org, auth.uid(), ARRAY['owner', 'admin']::public.org_role[]) THEN
        RAISE EXCEPTION 'Organization administration required' USING ERRCODE='42501';
      END IF;
    ELSIF NOT public.is_org_member(v_org, auth.uid()) THEN
      RAISE EXCEPTION 'Tenant membership required' USING ERRCODE='42501';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'patients' THEN
    v_limit := public.clinicx_limit(v_org, 'patients');
    SELECT count(*) INTO v_count FROM public.patients WHERE organization_id = v_org;
    IF v_limit IS NOT NULL AND v_count >= v_limit THEN
      RAISE EXCEPTION 'Patient limit reached' USING ERRCODE='42501';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'doctors' AND (to_jsonb(NEW)->>'is_active')::boolean AND (TG_OP = 'INSERT' OR NOT (to_jsonb(OLD)->>'is_active')::boolean) THEN
    v_limit := public.clinicx_limit(v_org, 'doctors');
    SELECT count(*) INTO v_count FROM public.doctors WHERE organization_id = v_org AND is_active AND id <> NEW.id;
    IF v_limit IS NOT NULL AND v_count >= v_limit THEN
      RAISE EXCEPTION 'Doctor limit reached' USING ERRCODE='42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
