-- ============================================================
-- MIGRATION: Interconnect All Clinic Modules into Financial & Operational Ledger
-- ============================================================

-- 0. Ensure Pharmacy Sales Table Exists
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pharmacy_sales' AND policyname = 'Org members manage pharmacy_sales') THEN
    CREATE POLICY "Org members manage pharmacy_sales" ON public.pharmacy_sales
      FOR ALL TO authenticated
      USING (public.is_org_member(organization_id, auth.uid()))
      WITH CHECK (public.is_org_member(organization_id, auth.uid()));
  END IF;
END $$;

-- 1. Pharmacy Sales -> Financial Ledger Trigger
CREATE OR REPLACE FUNCTION public.ledger_from_pharmacy_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    INSERT INTO public.finance_ledger (
      organization_id,
      entry_type,
      entry_date,
      source,
      service_category,
      payment_mode,
      patient_id,
      patient_name,
      invoice_number,
      gross_amount,
      discount,
      net_amount,
      notes,
      auto_generated
    ) VALUES (
      NEW.organization_id,
      'revenue',
      NEW.created_at::date,
      'pharmacy',
      'Pharmacy Sales',
      COALESCE(NEW.payment_method, 'cash'),
      NEW.patient_id,
      NEW.patient_name,
      'PHARM-' || SUBSTRING(NEW.id::text FROM 1 FOR 8),
      COALESCE(NEW.subtotal, 0),
      COALESCE(NEW.discount, 0),
      COALESCE(NEW.total, 0),
      NEW.note,
      true
    )
    ON CONFLICT DO NOTHING;
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

-- 2. Appointment completion sync with Queue Status
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

-- 3. Patient Loyalty Auto-Points on Revenue
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patient_loyalty' AND policyname = 'Org members manage patient_loyalty') THEN
    CREATE POLICY "Org members manage patient_loyalty" ON public.patient_loyalty
      FOR ALL TO authenticated
      USING (public.is_org_member(organization_id, auth.uid()))
      WITH CHECK (public.is_org_member(organization_id, auth.uid()));
  END IF;
END $$;

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
