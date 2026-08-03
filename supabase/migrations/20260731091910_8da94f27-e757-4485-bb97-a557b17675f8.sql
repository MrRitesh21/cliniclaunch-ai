
-- ============ 1. LEDGER ============
CREATE TABLE public.finance_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  entry_type text NOT NULL DEFAULT 'revenue',
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  source text,
  service_category text,
  expense_category text,
  payment_mode text,
  patient_id uuid,
  patient_name text,
  doctor_id uuid,
  doctor_name text,
  appointment_id uuid,
  invoice_id uuid,
  payment_id uuid,
  expense_id uuid,
  invoice_number text,
  vendor text,
  gross_amount numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  notes text,
  auto_generated boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_ledger TO authenticated;
GRANT ALL ON public.finance_ledger TO service_role;
ALTER TABLE public.finance_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read ledger" ON public.finance_ledger FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "org staff write ledger" ON public.finance_ledger FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','doctor','staff']::org_role[]));
CREATE POLICY "org staff update ledger" ON public.finance_ledger FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','doctor']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','doctor']::org_role[]));
CREATE POLICY "org owners delete ledger" ON public.finance_ledger FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE INDEX idx_fl_org_date ON public.finance_ledger(organization_id, entry_date DESC);
CREATE INDEX idx_fl_org_type_date ON public.finance_ledger(organization_id, entry_type, entry_date DESC);
CREATE INDEX idx_fl_clinic_date ON public.finance_ledger(clinic_id, entry_date DESC);
CREATE INDEX idx_fl_doctor ON public.finance_ledger(organization_id, doctor_id);
CREATE INDEX idx_fl_payment_mode ON public.finance_ledger(organization_id, payment_mode);
CREATE UNIQUE INDEX idx_fl_payment_uniq ON public.finance_ledger(payment_id) WHERE payment_id IS NOT NULL;
CREATE UNIQUE INDEX idx_fl_appt_uniq ON public.finance_ledger(appointment_id) WHERE appointment_id IS NOT NULL;
CREATE UNIQUE INDEX idx_fl_expense_uniq ON public.finance_ledger(expense_id) WHERE expense_id IS NOT NULL;

CREATE TRIGGER trg_fl_updated BEFORE UPDATE ON public.finance_ledger
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ 2. EXPENSES UPGRADE ============
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS organization_id uuid,
  ADD COLUMN IF NOT EXISTS vendor text,
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS bill_url text,
  ADD COLUMN IF NOT EXISTS gst_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.expenses e SET organization_id = c.organization_id
  FROM public.clinics c WHERE c.id = e.clinic_id AND e.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_exp_org_date ON public.expenses(organization_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_exp_vendor ON public.expenses(organization_id, vendor);

CREATE OR REPLACE FUNCTION public.fill_expense_org_from_clinic()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.clinic_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id FROM public.clinics WHERE id = NEW.clinic_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_exp_fill_org BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.fill_expense_org_from_clinic();
CREATE TRIGGER trg_exp_updated BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ 3. VENDOR CATEGORY MEMORY ============
CREATE TABLE public.vendor_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vendor_key text NOT NULL,
  vendor_label text NOT NULL,
  category text NOT NULL,
  hits integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, vendor_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_categories TO authenticated;
GRANT ALL ON public.vendor_categories TO service_role;
ALTER TABLE public.vendor_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage vendor categories" ON public.vendor_categories FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE TRIGGER trg_vc_updated BEFORE UPDATE ON public.vendor_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ 4. CASH BOOK ============
CREATE TABLE public.cash_book (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  book_date date NOT NULL,
  expected_cash numeric NOT NULL DEFAULT 0,
  actual_cash numeric NOT NULL DEFAULT 0,
  difference numeric NOT NULL DEFAULT 0,
  cash_expenses numeric NOT NULL DEFAULT 0,
  notes text,
  closed_by uuid,
  closed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, clinic_id, book_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_book TO authenticated;
GRANT ALL ON public.cash_book TO service_role;
ALTER TABLE public.cash_book ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read cash book" ON public.cash_book FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "org staff manage cash book" ON public.cash_book FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','doctor','staff']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','doctor','staff']::org_role[]));
CREATE TRIGGER trg_cb_updated BEFORE UPDATE ON public.cash_book
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ 5. BUDGETS ============
CREATE TABLE public.finance_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category text NOT NULL,
  monthly_limit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, category)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_budgets TO authenticated;
GRANT ALL ON public.finance_budgets TO service_role;
ALTER TABLE public.finance_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read budgets" ON public.finance_budgets FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "org admins manage budgets" ON public.finance_budgets FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','doctor']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','doctor']::org_role[]));
CREATE TRIGGER trg_fb_updated BEFORE UPDATE ON public.finance_budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ 6. GOALS ============
CREATE TABLE public.finance_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  goal_type text NOT NULL,
  period text NOT NULL DEFAULT 'monthly',
  target_value numeric NOT NULL DEFAULT 0,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_goals TO authenticated;
GRANT ALL ON public.finance_goals TO service_role;
ALTER TABLE public.finance_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read goals" ON public.finance_goals FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "org admins manage goals" ON public.finance_goals FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','doctor']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','doctor']::org_role[]));
CREATE TRIGGER trg_fg_updated BEFORE UPDATE ON public.finance_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ 7. FINANCE AUDIT TRAIL (immutable) ============
CREATE TABLE public.finance_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_name text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  amount numeric,
  reason text,
  ip_address text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.finance_audit TO authenticated;
GRANT SELECT, INSERT ON public.finance_audit TO service_role;
ALTER TABLE public.finance_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read finance audit" ON public.finance_audit FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "org members write finance audit" ON public.finance_audit FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX idx_fa_org_date ON public.finance_audit(organization_id, created_at DESC);

-- ============ 8. AUTO-BOOKKEEPING TRIGGERS ============

-- Revenue from patient payments
CREATE OR REPLACE FUNCTION public.ledger_from_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.patient_invoices%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM public.patient_invoices WHERE id = NEW.invoice_id;
  INSERT INTO public.finance_ledger (
    organization_id, clinic_id, entry_type, entry_date, source, service_category,
    payment_mode, patient_id, patient_name, invoice_id, payment_id, invoice_number,
    gross_amount, discount, tax_amount, net_amount, created_by
  ) VALUES (
    NEW.organization_id, inv.clinic_id, 'revenue', NEW.paid_at::date, 'invoice', 'consultation',
    NEW.method, inv.patient_id, inv.patient_name, NEW.invoice_id, NEW.id, inv.invoice_number,
    NEW.amount,
    COALESCE(inv.discount, 0),
    ROUND(NEW.amount * COALESCE(inv.tax_percent, 0) / NULLIF(100 + COALESCE(inv.tax_percent, 0), 0), 2),
    NEW.amount, NEW.created_by
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_ledger_payment AFTER INSERT ON public.patient_payments
  FOR EACH ROW EXECUTE FUNCTION public.ledger_from_payment();

CREATE OR REPLACE FUNCTION public.ledger_remove_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.finance_ledger WHERE payment_id = OLD.id;
  RETURN OLD;
END $$;
CREATE TRIGGER trg_ledger_payment_del AFTER DELETE ON public.patient_payments
  FOR EACH ROW EXECUTE FUNCTION public.ledger_remove_payment();

-- Revenue from completed appointments (only when not invoiced)
CREATE OR REPLACE FUNCTION public.ledger_from_appointment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fee numeric; src text; dname text;
BEGIN
  IF NEW.status <> 'completed' OR (TG_OP = 'UPDATE' AND OLD.status = 'completed') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.finance_ledger WHERE appointment_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.patient_invoices WHERE clinic_id = NEW.clinic_id
             AND patient_id = NEW.patient_id AND issue_date = COALESCE(NEW.appointment_date, CURRENT_DATE)) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(d.consultation_fee, c.consultation_fee, 0), COALESCE(d.name, c.doctor_name)
    INTO fee, dname
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
    ELSE 'walkin' END;

  INSERT INTO public.finance_ledger (
    organization_id, clinic_id, entry_type, entry_date, source, service_category,
    payment_mode, patient_id, patient_name, doctor_id, doctor_name, appointment_id,
    gross_amount, net_amount
  ) VALUES (
    NEW.organization_id, NEW.clinic_id, 'revenue',
    COALESCE(NEW.appointment_date, CURRENT_DATE), src, 'consultation',
    'cash', NEW.patient_id, NEW.patient_name, NEW.doctor_id, COALESCE(NEW.doctor_name, dname),
    NEW.id, COALESCE(fee, 0), COALESCE(fee, 0)
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_ledger_appointment AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.ledger_from_appointment();

-- Expenses into ledger
CREATE OR REPLACE FUNCTION public.ledger_from_expense()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.finance_ledger (
    organization_id, clinic_id, entry_type, entry_date, expense_category, payment_mode,
    vendor, expense_id, gross_amount, tax_amount, net_amount, notes, created_by
  ) VALUES (
    NEW.organization_id, NEW.clinic_id, 'expense', NEW.date, NEW.category, NEW.payment_mode,
    NEW.vendor, NEW.id, NEW.amount, COALESCE(NEW.gst_amount,0), NEW.amount, NEW.notes, NEW.created_by
  )
  ON CONFLICT (expense_id) WHERE expense_id IS NOT NULL DO UPDATE SET
    entry_date = EXCLUDED.entry_date, expense_category = EXCLUDED.expense_category,
    payment_mode = EXCLUDED.payment_mode, vendor = EXCLUDED.vendor,
    gross_amount = EXCLUDED.gross_amount, tax_amount = EXCLUDED.tax_amount,
    net_amount = EXCLUDED.net_amount, notes = EXCLUDED.notes, updated_at = now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_ledger_expense AFTER INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.ledger_from_expense();

CREATE OR REPLACE FUNCTION public.ledger_remove_expense()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.finance_ledger WHERE expense_id = OLD.id;
  RETURN OLD;
END $$;
CREATE TRIGGER trg_ledger_expense_del AFTER DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.ledger_remove_expense();

-- ============ 9. BACKFILL EXISTING DATA ============
INSERT INTO public.finance_ledger (
  organization_id, clinic_id, entry_type, entry_date, source, service_category,
  payment_mode, patient_id, patient_name, invoice_id, payment_id, invoice_number,
  gross_amount, discount, net_amount
)
SELECT p.organization_id, i.clinic_id, 'revenue', p.paid_at::date, 'invoice', 'consultation',
       p.method, i.patient_id, i.patient_name, p.invoice_id, p.id, i.invoice_number,
       p.amount, COALESCE(i.discount,0), p.amount
FROM public.patient_payments p
JOIN public.patient_invoices i ON i.id = p.invoice_id
ON CONFLICT DO NOTHING;

INSERT INTO public.finance_ledger (
  organization_id, clinic_id, entry_type, entry_date, expense_category, payment_mode,
  vendor, expense_id, gross_amount, net_amount, notes
)
SELECT e.organization_id, e.clinic_id, 'expense', e.date, e.category, e.payment_mode,
       e.vendor, e.id, e.amount, e.amount, e.notes
FROM public.expenses e
WHERE e.organization_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============ 10. REALTIME ============
ALTER TABLE public.finance_ledger REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_ledger;
