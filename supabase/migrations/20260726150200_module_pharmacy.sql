-- ============================================================
-- MODULE: Pharmacy & dispensing
--
-- Counter sales against a prescription, with batch/expiry
-- tracking. Deliberately built ON TOP of inventory_items rather
-- than a parallel stock table, so the Inventory module stays the
-- single source of truth for "how much do we have".
-- ============================================================

-- ------------------------------------------------------------
-- Batches. Indian pharmacy retail is batch-driven: the same drug
-- carries different expiry dates and MRPs per consignment.
-- ------------------------------------------------------------
CREATE TABLE public.pharmacy_batches (
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
CREATE POLICY "Org members manage pharmacy_batches" ON public.pharmacy_batches
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE UNIQUE INDEX pharmacy_batches_unique_idx
  ON public.pharmacy_batches(item_id, batch_no);
-- Drives the expiring-soon warning list.
CREATE INDEX pharmacy_batches_expiry_idx
  ON public.pharmacy_batches(organization_id, expiry_date)
  WHERE expiry_date IS NOT NULL;

CREATE TRIGGER pharmacy_batches_updated_at BEFORE UPDATE ON public.pharmacy_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- Sales (one counter transaction).
-- ------------------------------------------------------------
CREATE TABLE public.pharmacy_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name text NOT NULL,
  prescription_id uuid REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  -- Denormalised totals: recomputed by trigger from the line items so the
  -- header can never drift from what was actually dispensed.
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash','upi','card','insurance','pending')),
  status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed','cancelled')),
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pharmacy_sales TO authenticated;
GRANT ALL ON public.pharmacy_sales TO service_role;
ALTER TABLE public.pharmacy_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage pharmacy_sales" ON public.pharmacy_sales
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX pharmacy_sales_org_idx ON public.pharmacy_sales(organization_id, created_at DESC);

CREATE TRIGGER pharmacy_sales_updated_at BEFORE UPDATE ON public.pharmacy_sales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- Sale line items.
-- ------------------------------------------------------------
CREATE TABLE public.pharmacy_sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.pharmacy_sales(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES public.pharmacy_batches(id) ON DELETE SET NULL,
  -- Frozen at sale time: the catalog row may later be renamed or deleted,
  -- but a dispensing record must stay legible for audit.
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
CREATE POLICY "Org members manage pharmacy_sale_items" ON public.pharmacy_sale_items
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX pharmacy_sale_items_sale_idx ON public.pharmacy_sale_items(sale_id);

-- ------------------------------------------------------------
-- Stock deduction.
--
-- Done in the database, not the client: a dispensing UI that
-- crashed halfway would otherwise hand out medicine without ever
-- decrementing stock. Every dispense also lands in
-- inventory_movements so the Inventory module's ledger stays
-- complete and auditable.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pharmacy_dispense_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.batch_id IS NOT NULL THEN
    UPDATE public.pharmacy_batches
       SET quantity = quantity - NEW.quantity
     WHERE id = NEW.batch_id;
  END IF;

  IF NEW.item_id IS NOT NULL THEN
    UPDATE public.inventory_items
       SET quantity = quantity - NEW.quantity
     WHERE id = NEW.item_id;

    INSERT INTO public.inventory_movements
      (organization_id, item_id, movement_type, quantity, note)
    VALUES
      (NEW.organization_id, NEW.item_id, 'out', NEW.quantity,
       'Pharmacy dispense: ' || NEW.drug_name);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER pharmacy_sale_items_dispense AFTER INSERT ON public.pharmacy_sale_items
  FOR EACH ROW EXECUTE FUNCTION public.pharmacy_dispense_stock();

-- Keep the sale header totals in step with its lines.
CREATE OR REPLACE FUNCTION public.pharmacy_recalc_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale uuid := COALESCE(NEW.sale_id, OLD.sale_id);
  v_subtotal numeric(12,2);
BEGIN
  SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
    FROM public.pharmacy_sale_items WHERE sale_id = v_sale;

  UPDATE public.pharmacy_sales
     SET subtotal = v_subtotal,
         total = GREATEST(v_subtotal - discount, 0)
   WHERE id = v_sale;

  RETURN NULL;
END;
$$;

CREATE TRIGGER pharmacy_sale_items_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.pharmacy_sale_items
  FOR EACH ROW EXECUTE FUNCTION public.pharmacy_recalc_sale();

-- ------------------------------------------------------------
-- Catalog + plan wiring.
-- ------------------------------------------------------------
INSERT INTO public.modules (id, name, description, category, icon, is_core, is_available, min_plan, sort_order)
VALUES ('pharmacy', 'Pharmacy & Dispensing', 'Dispense against prescriptions with batch, expiry and stock deduction.', 'Operations', 'Pill', false, true, 'professional', 105)
ON CONFLICT (id) DO NOTHING;

UPDATE public.plans
SET module_ids = array_append(module_ids, 'pharmacy')
WHERE id IN ('professional', 'enterprise')
  AND NOT ('pharmacy' = ANY(module_ids));
