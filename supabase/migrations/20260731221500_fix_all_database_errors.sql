-- ============================================================
-- COMPREHENSIVE REPAIR MIGRATION
-- Fixes:
-- 1. ERROR 42703: column appointments.consultation_fee does not exist
-- 2. ERROR 42703: column inventory_items.reorder_level does not exist
-- 3. ERROR 42501: permission denied for table clinics
-- 4. ERROR 42P01: relation public.pharmacy_sales does not exist
-- ============================================================

-- ------------------------------------------------------------
-- 1. ADD MISSING COLUMNS TO EXISTING TABLES
-- ------------------------------------------------------------
ALTER TABLE public.appointments 
  ADD COLUMN IF NOT EXISTS consultation_fee numeric NOT NULL DEFAULT 0;

ALTER TABLE public.inventory_items 
  ADD COLUMN IF NOT EXISTS reorder_level numeric NOT NULL DEFAULT 10;

-- ------------------------------------------------------------
-- 2. ENSURE ALL MODULE TABLES EXIST WITH RLS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pharmacy_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  batch_no text NOT NULL,
  expiry_date date,
  quantity numeric(12,2) NOT NULL DEFAULT 0,
  mrp numeric(10,2) NOT NULL DEFAULT 0,
  purchase_price numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pharmacy_batches TO authenticated;
GRANT ALL ON public.pharmacy_batches TO service_role;
ALTER TABLE public.pharmacy_batches ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.pharmacy_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name text NOT NULL,
  prescription_id uuid REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  status text NOT NULL DEFAULT 'completed',
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pharmacy_sales TO authenticated;
GRANT ALL ON public.pharmacy_sales TO service_role;
ALTER TABLE public.pharmacy_sales ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.pharmacy_sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.pharmacy_sales(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES public.pharmacy_batches(id) ON DELETE SET NULL,
  drug_name text NOT NULL,
  batch_no text,
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pharmacy_sale_items TO authenticated;
GRANT ALL ON public.pharmacy_sale_items TO service_role;
ALTER TABLE public.pharmacy_sale_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.patient_loyalty (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  tier text NOT NULL DEFAULT 'Bronze',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, patient_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_loyalty TO authenticated;
GRANT ALL ON public.patient_loyalty TO service_role;
ALTER TABLE public.patient_loyalty ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 3. RLS POLICIES (SAFE IF-NOT-EXISTS GUARDS)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pharmacy_batches' AND policyname = 'Org members manage pharmacy_batches') THEN
    CREATE POLICY "Org members manage pharmacy_batches" ON public.pharmacy_batches FOR ALL TO authenticated
      USING (public.is_org_member(organization_id, auth.uid()))
      WITH CHECK (public.is_org_member(organization_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pharmacy_sales' AND policyname = 'Org members manage pharmacy_sales') THEN
    CREATE POLICY "Org members manage pharmacy_sales" ON public.pharmacy_sales FOR ALL TO authenticated
      USING (public.is_org_member(organization_id, auth.uid()))
      WITH CHECK (public.is_org_member(organization_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pharmacy_sale_items' AND policyname = 'Org members manage pharmacy_sale_items') THEN
    CREATE POLICY "Org members manage pharmacy_sale_items" ON public.pharmacy_sale_items FOR ALL TO authenticated
      USING (public.is_org_member(organization_id, auth.uid()))
      WITH CHECK (public.is_org_member(organization_id, auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patient_loyalty' AND policyname = 'Org members manage patient_loyalty') THEN
    CREATE POLICY "Org members manage patient_loyalty" ON public.patient_loyalty FOR ALL TO authenticated
      USING (public.is_org_member(organization_id, auth.uid()))
      WITH CHECK (public.is_org_member(organization_id, auth.uid()));
  END IF;

  -- Ensure clinics permission for public booking & dashboard
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clinics' AND policyname = 'Anon and authenticated read published clinics') THEN
    CREATE POLICY "Anon and authenticated read published clinics" ON public.clinics FOR SELECT TO anon, authenticated
      USING (is_published = true OR public.is_org_member(organization_id, auth.uid()));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. HARDENED TRIGGER FUNCTIONS (SECURITY DEFINER)
-- ------------------------------------------------------------

-- Appointment revenue trigger (safely handles consultation_fee from appointments, doctors, or clinics)
CREATE OR REPLACE FUNCTION public.ledger_from_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fee numeric;
  src text;
  dname text;
BEGIN
  IF NEW.status <> 'completed' OR (TG_OP = 'UPDATE' AND OLD.status = 'completed') THEN
    RETURN NEW;
  END IF;
  
  IF EXISTS (SELECT 1 FROM public.finance_ledger WHERE appointment_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Fallback logic for fee: appointment's consultation_fee -> doctor's consultation_fee -> clinic's consultation_fee
  fee := COALESCE(
    NEW.consultation_fee,
    (SELECT consultation_fee FROM public.doctors WHERE id = NEW.doctor_id),
    (SELECT consultation_fee FROM public.clinics WHERE id = NEW.clinic_id),
    0
  );

  SELECT COALESCE(d.name, c.doctor_name) INTO dname
  FROM public.clinics c
  LEFT JOIN public.doctors d ON d.id = NEW.doctor_id
  WHERE c.id = NEW.clinic_id;

  src := CASE
    WHEN NEW.source = 'walkin' THEN 'walkin'
    WHEN NEW.appointment_type = 'video' THEN 'video_consultation'
    WHEN NEW.appointment_type = 'chat' THEN 'chat_consultation'
    WHEN NEW.appointment_type = 'online' THEN 'online_consultation'
    WHEN NEW.appointment_type = 'home' THEN 'home_visit'
    WHEN NEW.appointment_type = 'emergency' THEN 'emergency_visit'
    ELSE 'walkin'
  END;

  INSERT INTO public.finance_ledger (
    organization_id, clinic_id, entry_type, entry_date, source, service_category,
    payment_mode, patient_id, patient_name, doctor_id, doctor_name, appointment_id,
    gross_amount, net_amount, auto_generated
  ) VALUES (
    NEW.organization_id, NEW.clinic_id, 'revenue',
    COALESCE(NEW.appointment_date, CURRENT_DATE), src, 'consultation',
    'cash', NEW.patient_id, NEW.patient_name, NEW.doctor_id, COALESCE(NEW.doctor_name, dname),
    NEW.id, COALESCE(fee, 0), COALESCE(fee, 0), true
  ) ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_appointment ON public.appointments;
CREATE TRIGGER trg_ledger_appointment
  AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.ledger_from_appointment();

-- Pharmacy sales revenue trigger
CREATE OR REPLACE FUNCTION public.ledger_from_pharmacy_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    INSERT INTO public.finance_ledger (
      organization_id, entry_type, entry_date, source, service_category,
      payment_mode, patient_id, patient_name, invoice_number,
      gross_amount, discount, net_amount, notes, auto_generated
    ) VALUES (
      NEW.organization_id, 'revenue', NEW.created_at::date, 'pharmacy', 'Pharmacy Sales',
      COALESCE(NEW.payment_method, 'cash'), NEW.patient_id, NEW.patient_name,
      'PHARM-' || SUBSTRING(NEW.id::text FROM 1 FOR 8),
      COALESCE(NEW.subtotal, 0), COALESCE(NEW.discount, 0), COALESCE(NEW.total, 0),
      NEW.note, true
    ) ON CONFLICT DO NOTHING;
  ELSIF NEW.status = 'cancelled' THEN
    DELETE FROM public.finance_ledger
     WHERE source = 'pharmacy'
       AND invoice_number = 'PHARM-' || SUBSTRING(NEW.id::text FROM 1 FOR 8);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_pharmacy_sale ON public.pharmacy_sales;
CREATE TRIGGER trg_ledger_pharmacy_sale
  AFTER INSERT OR UPDATE ON public.pharmacy_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.ledger_from_pharmacy_sale();

-- Appointment to Queue status sync
CREATE OR REPLACE FUNCTION public.sync_appointment_to_queue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status <> 'completed') THEN
    UPDATE public.patient_queue
       SET status = 'completed',
           updated_at = now()
     WHERE appointment_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_appointment_queue ON public.appointments;
CREATE TRIGGER trg_sync_appointment_queue
  AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_appointment_to_queue();

-- Loyalty auto-points on revenue ledger
CREATE OR REPLACE FUNCTION public.award_loyalty_on_revenue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  earned_pts integer;
BEGIN
  IF NEW.entry_type = 'revenue' AND NEW.patient_id IS NOT NULL AND NEW.net_amount > 0 THEN
    earned_pts := GREATEST(1, FLOOR(NEW.net_amount / 100));

    INSERT INTO public.patient_loyalty (organization_id, patient_id, points)
    VALUES (NEW.organization_id, NEW.patient_id, earned_pts)
    ON CONFLICT (organization_id, patient_id) DO UPDATE SET
      points = public.patient_loyalty.points + EXCLUDED.points,
      tier = CASE
        WHEN public.patient_loyalty.points + EXCLUDED.points >= 1000 THEN 'Platinum'
        WHEN public.patient_loyalty.points + EXCLUDED.points >= 500 THEN 'Gold'
        WHEN public.patient_loyalty.points + EXCLUDED.points >= 200 THEN 'Silver'
        ELSE 'Bronze'
      END,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_loyalty ON public.finance_ledger;
CREATE TRIGGER trg_award_loyalty
  AFTER INSERT ON public.finance_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.award_loyalty_on_revenue();
