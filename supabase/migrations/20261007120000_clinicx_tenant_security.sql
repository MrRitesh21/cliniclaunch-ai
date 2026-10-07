-- Forward-only security upgrade. No clinical-row repair, deletion, or historic reset.
-- Rehearse against a sanitized schema first. Lock acquisition is bounded.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Invitations are issued/revoked by existing admins, never edited in place.
DROP POLICY IF EXISTS "Invitee can accept own invite" ON public.organization_invites;
DROP POLICY IF EXISTS "Invitee can join via valid invite" ON public.organization_members;
REVOKE UPDATE ON public.organization_invites FROM PUBLIC, anon, authenticated;
ALTER TABLE public.organization_invites ADD CONSTRAINT clinicx_invite_nonowner
  CHECK (role <> 'owner') NOT VALID;

CREATE OR REPLACE FUNCTION public.accept_invite(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text;
  v_inv public.organization_invites%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  -- Resolve confirmed email from Auth, not client input or editable profile metadata.
  SELECT email INTO v_email FROM auth.users
    WHERE id = v_actor AND email_confirmed_at IS NOT NULL;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Confirmed email required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_inv FROM public.organization_invites WHERE token = _token FOR UPDATE;
  IF NOT FOUND OR v_inv.accepted_at IS NOT NULL OR v_inv.expires_at <= now()
     OR lower(v_inv.email) <> lower(v_email) OR v_inv.role = 'owner' THEN
    RAISE EXCEPTION 'Invalid or consumed invite' USING ERRCODE = '42501';
  END IF;
  -- Never promote an existing membership via an invite; a conflict rolls everything back.
  -- Mark consumed first: staff invitation reserves a seat; conversion must not count it twice.
  -- All later failures roll this change back within the RPC transaction.
  UPDATE public.organization_invites SET accepted_at = now() WHERE id = v_inv.id;
  INSERT INTO public.organization_members (organization_id, user_id, role, invited_by)
    VALUES (v_inv.organization_id, v_actor, v_inv.role, v_inv.invited_by);
  IF v_inv.role='doctor' AND NOT EXISTS (
    SELECT 1 FROM public.doctors WHERE organization_id=v_inv.organization_id AND user_id=v_actor
  ) THEN
    INSERT INTO public.doctors (organization_id,clinic_id,user_id,name,is_active,consultation_fee,specialization,qualification)
    VALUES (v_inv.organization_id,
      (SELECT id FROM public.clinics WHERE organization_id=v_inv.organization_id ORDER BY created_at,id LIMIT 1),
      v_actor,coalesce((SELECT nullif(full_name,'') FROM public.profiles WHERE id=v_actor),split_part(v_email,'@',1)),
      true,500,'','');
  END IF;
  INSERT INTO public.audit_log (organization_id, actor_id, action, entity_type, entity_id)
    VALUES (v_inv.organization_id, v_actor, 'invite.accepted', 'organization_invite', v_inv.id);
  RETURN v_inv.organization_id;
END $$;
REVOKE ALL ON FUNCTION public.accept_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;

-- Authenticated administrative membership CRUD may not mint/transfer owner authority.
CREATE OR REPLACE FUNCTION public.clinicx_guard_member_authority()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' AND NEW.role = 'owner' THEN
      RAISE EXCEPTION 'Owner authority requires trusted server' USING ERRCODE = '42501';
    ELSIF TG_OP = 'UPDATE' AND
      (NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR (NEW.role IS DISTINCT FROM OLD.role AND (NEW.role = 'owner' OR OLD.role = 'owner'))) THEN
      RAISE EXCEPTION 'Membership authority is immutable' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER clinicx_member_authority BEFORE INSERT OR UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.clinicx_guard_member_authority();

-- Tenant keys supplement existing FK deletion actions (CASCADE/SET NULL).
-- NO ACTION here never nulls organization_id; the original FK still owns deletion semantics.
-- NOT VALID preserves historical mixed links, while enforcing new/changed links.
DO $$
DECLARE r record; v_name text;
BEGIN
  FOR r IN
    SELECT DISTINCT c.relname AS child, a.attname AS link, p.relname AS parent
    FROM pg_constraint f
    JOIN pg_class c ON c.oid = f.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_class p ON p.oid = f.confrelid
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = f.conkey[1]
    JOIN pg_attribute pa ON pa.attrelid = p.oid AND pa.attnum = f.confkey[1]
    WHERE f.contype = 'f' AND cardinality(f.conkey) = 1 AND pa.attname = 'id'
      AND n.nspname = 'public'
      AND c.relname = ANY(ARRAY['patients','appointments','doctors','consultations',
        'patient_visits','patient_attachments','prescriptions','prescription_items',
        'lab_orders','inventory_movements','pharmacy_batches','pharmacy_sales',
        'pharmacy_sale_items','patient_invoices','patient_payments','queue_tokens',
        'leads','loyalty_transactions','loyalty_members','expenses','finance_ledger'])
      AND EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=c.oid AND attname='organization_id' AND NOT attisdropped)
      AND EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=p.oid AND attname='organization_id' AND NOT attisdropped)
  LOOP
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (organization_id, id)',
      'clinicx_tenant_key_' || r.parent, r.parent);
    v_name := 'clinicx_tenant_' || r.child || '_' || r.link;
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (organization_id,%I) REFERENCES public.%I(organization_id,id) NOT VALID',
      r.child, v_name, r.link, r.parent);
  END LOOP;
END $$;

-- Known clinical references without a historical FK (notably finance_ledger).
-- Optional drifted tables/columns are not invented here; catalog reconciliation is a release gate.
DO $$
DECLARE r record; v_name text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('finance_ledger','patient_id','patients'),('finance_ledger','doctor_id','doctors'),
    ('finance_ledger','appointment_id','appointments'),('finance_ledger','invoice_id','patient_invoices'),
    ('finance_ledger','payment_id','patient_payments'),('finance_ledger','expense_id','expenses'),
    ('consultations','patient_id','patients'),('consultations','doctor_id','doctors'),
    ('consultations','clinic_id','clinics'),('consultations','appointment_id','appointments'),
    ('patient_visits','doctor_id','doctors'),('patient_visits','appointment_id','appointments'),
    ('queue_tokens','patient_id','patients'),('queue_tokens','appointment_id','appointments'),
    ('lab_orders','patient_id','patients'),('lab_orders','test_id','lab_tests'),
    ('loyalty_transactions','patient_id','patients'),('loyalty_members','patient_id','patients')
  ) AS links(child,link,parent)
  WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=child AND column_name=link)
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=child AND column_name='organization_id')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=parent AND column_name='organization_id')
  LOOP
    v_name := 'clinicx_tenant_' || r.child || '_' || r.link;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.'||r.child) AND conname=v_name) THEN
      EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I(organization_id,id)',
        'clinicx_tenant_key_'||r.parent,r.parent);
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (organization_id,%I) REFERENCES public.%I(organization_id,id) ON DELETE %s NOT VALID',
        r.child,v_name,r.link,r.parent,
        CASE WHEN r.child='finance_ledger' AND r.link IN ('payment_id','expense_id') THEN 'CASCADE'
          ELSE format('SET NULL (%I)',r.link) END);
    END IF;
  END LOOP;
END $$;

-- Batch must belong to the selected catalog item as well as the tenant.
CREATE UNIQUE INDEX clinicx_batch_item_key ON public.pharmacy_batches (organization_id,id,item_id);
ALTER TABLE public.pharmacy_sale_items ADD CONSTRAINT clinicx_batch_item_link
  FOREIGN KEY (organization_id,batch_id,item_id)
  REFERENCES public.pharmacy_batches(organization_id,id,item_id) NOT VALID;
ALTER TABLE public.pharmacy_sale_items ADD CONSTRAINT clinicx_batch_requires_item
  CHECK (batch_id IS NULL OR item_id IS NOT NULL) NOT VALID;

CREATE OR REPLACE FUNCTION public.recompute_invoice_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record; v_paid numeric; v_total numeric; v_current text; v_status text;
BEGIN
  -- Reparenting requires recomputing BOTH old and new invoices.
  FOR r IN SELECT DISTINCT org, inv FROM (
    SELECT NEW.organization_id AS org, NEW.invoice_id AS inv WHERE TG_OP <> 'DELETE'
    UNION SELECT OLD.organization_id, OLD.invoice_id WHERE TG_OP <> 'INSERT'
  ) x LOOP
    SELECT total, status INTO v_total, v_current FROM public.patient_invoices
      WHERE id=r.inv AND organization_id=r.org FOR UPDATE;
    IF NOT FOUND OR v_current='void' THEN CONTINUE; END IF;
    SELECT coalesce(sum(amount),0) INTO v_paid FROM public.patient_payments
      WHERE invoice_id=r.inv AND organization_id=r.org;
    v_status := CASE WHEN v_paid<=0 THEN CASE WHEN v_current='draft' THEN 'draft' ELSE 'sent' END
      WHEN v_paid>=v_total THEN 'paid' ELSE 'partial' END;
    UPDATE public.patient_invoices SET amount_paid=v_paid,status=v_status,updated_at=now()
      WHERE id=r.inv AND organization_id=r.org;
  END LOOP;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.recompute_invoice_paid() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pharmacy_dispense_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pharmacy_sales WHERE id=NEW.sale_id AND organization_id=NEW.organization_id) THEN
    RAISE EXCEPTION 'Sale tenant mismatch' USING ERRCODE='23503';
  END IF;
  -- Catalog then batch is a consistent lock order; conditional UPDATE prevents overselling.
  IF NEW.item_id IS NOT NULL THEN
    UPDATE public.inventory_items SET quantity=quantity-NEW.quantity
      WHERE id=NEW.item_id AND organization_id=NEW.organization_id AND quantity>=NEW.quantity;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid item or insufficient stock' USING ERRCODE='23514'; END IF;
  END IF;
  IF NEW.batch_id IS NOT NULL THEN
    UPDATE public.pharmacy_batches SET quantity=quantity-NEW.quantity
      WHERE id=NEW.batch_id AND organization_id=NEW.organization_id
        AND item_id=NEW.item_id AND quantity>=NEW.quantity;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid batch or insufficient stock' USING ERRCODE='23514'; END IF;
  END IF;
  IF NEW.item_id IS NOT NULL THEN
    INSERT INTO public.inventory_movements (organization_id,item_id,movement_type,quantity,note)
      VALUES (NEW.organization_id,NEW.item_id,'out',NEW.quantity,'Pharmacy dispense');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.pharmacy_dispense_stock() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pharmacy_recalc_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record; v_subtotal numeric;
BEGIN
  FOR r IN SELECT DISTINCT org, sale FROM (
    SELECT NEW.organization_id AS org, NEW.sale_id AS sale WHERE TG_OP <> 'DELETE'
    UNION SELECT OLD.organization_id, OLD.sale_id WHERE TG_OP <> 'INSERT'
  ) x LOOP
    PERFORM 1 FROM public.pharmacy_sales WHERE id=r.sale AND organization_id=r.org FOR UPDATE;
    SELECT coalesce(sum(line_total),0) INTO v_subtotal FROM public.pharmacy_sale_items
      WHERE sale_id=r.sale AND organization_id=r.org;
    UPDATE public.pharmacy_sales SET subtotal=v_subtotal,total=greatest(v_subtotal-discount,0)
      WHERE id=r.sale AND organization_id=r.org;
  END LOOP;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.pharmacy_recalc_sale() FROM PUBLIC, anon, authenticated;

-- Authenticated clinic writes cannot change ownership, tenant or server verification.
-- Invoker security is essential: current_user is the DB role, not forged JWT role JSON.
CREATE OR REPLACE FUNCTION public.clinicx_guard_clinic_authority()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE k text; v_new jsonb := to_jsonb(NEW); v_old jsonb;
BEGIN
  IF current_user NOT IN ('authenticated','anon') THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN
    v_old := to_jsonb(OLD);
    FOREACH k IN ARRAY ARRAY['id','organization_id','owner_id','suspended_at','suspended_reason','domain_status',
      'domain_verified_at','custom_domain_status','custom_domain_verified_at',
      'domain_last_check_at','domain_last_error','gsc_verified','gsc_site_url',
      'wa_session_id','wa_status','wa_connected_at','wa_linked_by','wa_phone',
      'whatsapp_session_id','baileys_session_id','whatsapp_access_token','whatsapp_phone_number_id'] LOOP
      IF v_new->k IS DISTINCT FROM v_old->k THEN
        RAISE EXCEPTION 'Clinic authority field % requires trusted server', k USING ERRCODE='42501';
      END IF;
    END LOOP;
    IF (v_new->'is_published' IS DISTINCT FROM v_old->'is_published'
        OR v_new->'published_at' IS DISTINCT FROM v_old->'published_at'
        OR v_new->'custom_domain' IS DISTINCT FROM v_old->'custom_domain')
       AND NOT public.has_org_role(NEW.organization_id,auth.uid(),ARRAY['owner','admin']::public.org_role[]) THEN
      RAISE EXCEPTION 'Clinic publishing/domain requires admin' USING ERRCODE='42501';
    END IF;
  ELSE
    IF NOT public.has_org_role(NEW.organization_id,auth.uid(),ARRAY['owner','admin']::public.org_role[])
      OR (NEW.owner_id IS NOT NULL AND NEW.owner_id IS DISTINCT FROM auth.uid()) THEN
      RAISE EXCEPTION 'Clinic creation requires own administrative context' USING ERRCODE='42501';
    END IF;
    FOREACH k IN ARRAY ARRAY['suspended_at','suspended_reason','domain_verified_at','custom_domain_verified_at',
      'domain_last_check_at','domain_last_error','gsc_site_url',
      'wa_session_id','wa_connected_at','wa_linked_by','wa_phone',
      'whatsapp_session_id','baileys_session_id','whatsapp_access_token','whatsapp_phone_number_id'] LOOP
      IF v_new->>k IS NOT NULL THEN
        RAISE EXCEPTION 'Clinic authority field % requires trusted server', k USING ERRCODE='42501';
      END IF;
    END LOOP;
    IF coalesce(v_new->>'gsc_verified','false') <> 'false'
      OR coalesce(v_new->>'wa_status','disconnected') <> 'disconnected' THEN
      RAISE EXCEPTION 'Clinic verification/session requires trusted server' USING ERRCODE='42501';
    END IF;
    IF coalesce(v_new->>'domain_status','pending') <> 'pending'
      OR coalesce(v_new->>'custom_domain_status','pending') <> 'pending' THEN
      RAISE EXCEPTION 'Clinic domain verification requires trusted server' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER clinicx_clinic_authority BEFORE INSERT OR UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.clinicx_guard_clinic_authority();

-- Restrictive policies cannot be OR-bypassed by historical permissive policies.
REVOKE ALL ON public.audit_log FROM anon;
CREATE POLICY clinicx_audit_read ON public.audit_log AS RESTRICTIVE FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_member(organization_id,auth.uid()));
CREATE POLICY clinicx_audit_actor ON public.audit_log AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NOT NULL AND actor_id=auth.uid()
    AND public.is_org_member(organization_id,auth.uid()));
DO $$ BEGIN
  IF to_regclass('public.finance_audit') IS NOT NULL THEN
    EXECUTE 'CREATE POLICY clinicx_finance_audit_actor ON public.finance_audit AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (actor_id=auth.uid() AND public.is_org_member(organization_id,auth.uid()))';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ledger_from_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE inv public.patient_invoices%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM public.patient_invoices WHERE id = NEW.invoice_id AND organization_id = NEW.organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice tenant mismatch' USING ERRCODE='23503'; END IF;
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

REVOKE ALL ON FUNCTION public.ledger_from_payment() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ledger_remove_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  DELETE FROM public.finance_ledger WHERE payment_id=OLD.id AND organization_id=OLD.organization_id;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.ledger_remove_payment() FROM PUBLIC,anon,authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
