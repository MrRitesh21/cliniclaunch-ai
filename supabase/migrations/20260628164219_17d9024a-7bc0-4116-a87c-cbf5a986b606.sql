create table if not exists public.patient_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  clinic_id uuid references public.clinics(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  patient_name text not null,
  invoice_number text not null,
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric(12,2) not null default 0,
  tax_percent numeric(5,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','sent','paid','partial','void')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists patient_invoices_org_idx on public.patient_invoices(organization_id, issue_date desc);
create unique index if not exists patient_invoices_org_num_uq on public.patient_invoices(organization_id, invoice_number);

create table if not exists public.patient_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.patient_invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  position int not null default 0
);
create index if not exists patient_invoice_items_inv_idx on public.patient_invoice_items(invoice_id);

create table if not exists public.patient_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.patient_invoices(id) on delete cascade,
  amount numeric(12,2) not null,
  method text not null default 'cash' check (method in ('cash','card','upi','bank','other')),
  paid_at timestamptz not null default now(),
  note text,
  created_by uuid references auth.users(id) on delete set null
);
create index if not exists patient_payments_org_idx on public.patient_payments(organization_id, paid_at desc);
create index if not exists patient_payments_inv_idx on public.patient_payments(invoice_id);

grant select, insert, update, delete on public.patient_invoices to authenticated;
grant all on public.patient_invoices to service_role;
grant select, insert, update, delete on public.patient_invoice_items to authenticated;
grant all on public.patient_invoice_items to service_role;
grant select, insert, update, delete on public.patient_payments to authenticated;
grant all on public.patient_payments to service_role;

alter table public.patient_invoices enable row level security;
alter table public.patient_invoice_items enable row level security;
alter table public.patient_payments enable row level security;

drop policy if exists "invoices_org_access" on public.patient_invoices;
create policy "invoices_org_access" on public.patient_invoices
  for all to authenticated using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

drop policy if exists "invoice_items_org_access" on public.patient_invoice_items;
create policy "invoice_items_org_access" on public.patient_invoice_items
  for all to authenticated using (
    exists (select 1 from public.patient_invoices i
      where i.id = patient_invoice_items.invoice_id
        and public.is_org_member(i.organization_id, auth.uid()))
  ) with check (
    exists (select 1 from public.patient_invoices i
      where i.id = patient_invoice_items.invoice_id
        and public.is_org_member(i.organization_id, auth.uid()))
  );

drop policy if exists "payments_org_access" on public.patient_payments;
create policy "payments_org_access" on public.patient_payments
  for all to authenticated using (public.is_org_member(organization_id, auth.uid()))
  with check (public.is_org_member(organization_id, auth.uid()));

create or replace function public.set_updated_at_patient_invoices()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_patient_invoices_updated_at on public.patient_invoices;
create trigger trg_patient_invoices_updated_at before update on public.patient_invoices
for each row execute function public.set_updated_at_patient_invoices();

create or replace function public.recompute_invoice_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_inv uuid; v_paid numeric; v_total numeric; v_current text; v_status text;
begin
  v_inv := coalesce(new.invoice_id, old.invoice_id);
  select coalesce(sum(amount), 0) into v_paid from public.patient_payments where invoice_id = v_inv;
  select total, status into v_total, v_current from public.patient_invoices where id = v_inv;
  if v_total is null then return null; end if;
  if v_current = 'void' then return null; end if;
  if v_paid <= 0 then v_status := case when v_current = 'draft' then 'draft' else 'sent' end;
  elsif v_paid >= v_total then v_status := 'paid';
  else v_status := 'partial';
  end if;
  update public.patient_invoices
     set amount_paid = v_paid, status = v_status, updated_at = now()
   where id = v_inv;
  return null;
end $$;

drop trigger if exists trg_recompute_invoice_paid on public.patient_payments;
create trigger trg_recompute_invoice_paid
after insert or update or delete on public.patient_payments
for each row execute function public.recompute_invoice_paid();