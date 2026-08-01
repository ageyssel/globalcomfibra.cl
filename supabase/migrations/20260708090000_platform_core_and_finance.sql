-- Fibra Global platform hardening and finance module.
-- Apply first in a staging project and review the preflight report before production.

create extension if not exists pgcrypto;
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('superadmin','admin','finance','commercial','support','readonly','client');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
create table if not exists public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.app_role not null default 'client',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists app_users_email_lower_uidx on public.app_users (lower(email));
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists app_users_touch_updated_at on public.app_users;
create trigger app_users_touch_updated_at before update on public.app_users for each row execute function public.touch_updated_at();
create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer
set search_path = public
as $$
  select coalesce((select role from public.app_users where user_id = auth.uid() and active), 'client'::public.app_role);
$$;
create or replace function public.has_role(allowed public.app_role[])
returns boolean
language sql stable security definer
set search_path = public
as $$ select public.current_app_role() = any(allowed); $$;
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.app_users (user_id, email, full_name, role)
  values (new.id, coalesce(new.email,''), nullif(new.raw_user_meta_data->>'full_name',''), 'client')
  on conflict (user_id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_globalcom on auth.users;
create trigger on_auth_user_created_globalcom after insert or update of email on auth.users for each row execute function public.handle_new_auth_user();
insert into public.app_users (user_id,email,full_name,role,active)
select id, coalesce(email,''), nullif(raw_user_meta_data->>'full_name',''),
       case when lower(coalesce(email,'')) = 'contacto@globalcomfibra.cl' then 'superadmin'::public.app_role else 'client'::public.app_role end,
       true
from auth.users
on conflict (user_id) do update set email=excluded.email,
  role=case when lower(excluded.email)='contacto@globalcomfibra.cl' then 'superadmin'::public.app_role else public.app_users.role end,
  updated_at=now();
alter table public.app_users enable row level security;
drop policy if exists app_users_self_read on public.app_users;
create policy app_users_self_read on public.app_users for select to authenticated using (user_id = auth.uid() or public.has_role(array['superadmin','admin']::public.app_role[]));
drop policy if exists app_users_admin_write on public.app_users;
create policy app_users_admin_write on public.app_users for all to authenticated using (public.has_role(array['superadmin']::public.app_role[])) with check (public.has_role(array['superadmin']::public.app_role[]));
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid,
  user_email text,
  action text not null,
  module text not null,
  record_type text,
  record_id text,
  record_label text,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_module_idx on public.audit_logs(module, created_at desc);
alter table public.audit_logs enable row level security;
drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read on public.audit_logs for select to authenticated using (public.has_role(array['superadmin','admin']::public.app_role[]));
create or replace function public.write_audit_log()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  row_id text;
  row_label text;
  payload jsonb;
begin
  payload := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  row_id := coalesce(payload->>'id', '');
  row_label := coalesce(payload->>'legal_name', payload->>'empresa', payload->>'folio', row_id);
  insert into public.audit_logs(user_id,user_email,action,module,record_type,record_id,record_label,old_values,new_values)
  values(auth.uid(), auth.jwt()->>'email', lower(tg_op), tg_argv[0], tg_table_name, row_id, row_label,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end);
  return case when tg_op='DELETE' then old else new end;
end;
$$;
create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(name)
);
create table if not exists public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(name)
);
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text,
  rut text not null,
  business_activity text,
  address text,
  contact_name text,
  contact_email text,
  phone text,
  bank_name text,
  bank_account_type text,
  bank_account_number text,
  account_holder text,
  payment_email text,
  category text,
  active boolean not null default true,
  deleted_at timestamptz,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists suppliers_rut_normalized_uidx on public.suppliers ((regexp_replace(upper(rut),'[^0-9K]','','g')));
create table if not exists public.supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id),
  document_type text not null,
  folio text not null,
  issue_date date not null,
  received_date date not null default current_date,
  due_date date not null,
  net_amount numeric(18,2) not null default 0 check(net_amount >= 0),
  exempt_amount numeric(18,2) not null default 0 check(exempt_amount >= 0),
  tax_amount numeric(18,2) not null default 0 check(tax_amount >= 0),
  other_taxes numeric(18,2) not null default 0 check(other_taxes >= 0),
  total_amount numeric(18,2) not null check(total_amount > 0),
  currency text not null default 'CLP' check(currency in ('CLP','UF','USD')),
  category_id uuid references public.expense_categories(id),
  cost_center_id uuid references public.cost_centers(id),
  related_client_rut text,
  related_service text,
  project_reference text,
  accounting_month date not null,
  purchase_order text,
  description text,
  status text not null default 'received' check(status in ('received','under_review','approved','observed','pending_payment','partial','paid','overdue','rejected','void','credit_compensated')),
  reception_channel text,
  storage_path text,
  xml_storage_path text,
  internal_notes text,
  deleted_at timestamptz,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_invoice_amounts_match check(abs(total_amount - (net_amount + exempt_amount + tax_amount + other_taxes)) <= 1)
);
create unique index if not exists supplier_invoices_exact_duplicate_uidx on public.supplier_invoices(supplier_id, document_type, folio, total_amount) where status <> 'void';
create index if not exists supplier_invoices_due_idx on public.supplier_invoices(due_date,status);
create index if not exists supplier_invoices_accounting_idx on public.supplier_invoices(accounting_month,supplier_id);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_date date not null,
  amount numeric(18,2) not null check(amount > 0),
  currency text not null default 'CLP' check(currency in ('CLP','UF','USD')),
  method text not null,
  bank text,
  source_account text,
  operation_number text,
  receipt_storage_path text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  supplier_invoice_id uuid not null references public.supplier_invoices(id) on delete restrict,
  allocated_amount numeric(18,2) not null check(allocated_amount > 0),
  created_at timestamptz not null default now(),
  unique(payment_id,supplier_invoice_id)
);
create index if not exists payment_allocations_invoice_idx on public.payment_allocations(supplier_invoice_id);
create table if not exists public.approval_history (
  id uuid primary key default gen_random_uuid(),
  supplier_invoice_id uuid not null references public.supplier_invoices(id) on delete cascade,
  from_status text,
  to_status text not null,
  notes text,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);
create table if not exists public.commercial_leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  rut text,
  address text,
  commune text,
  requested_service text,
  current_provider text,
  message text,
  source text not null default 'website',
  status text not null default 'new' check(status in ('new','contacted','evaluation','technical_feasibility','quote_sent','negotiation','won','lost','not_viable')),
  assigned_to uuid references auth.users(id),
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists commercial_leads_status_idx on public.commercial_leads(status,created_at desc);
create table if not exists public.public_form_rate_limits (
  fingerprint text primary key,
  attempts integer not null default 1,
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['suppliers','supplier_invoices','payments','payment_allocations','approval_history','expense_categories','cost_centers','commercial_leads'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
-- Finance policies.
drop policy if exists finance_suppliers_read on public.suppliers;
create policy finance_suppliers_read on public.suppliers for select to authenticated using (public.has_role(array['superadmin','admin','finance','readonly']::public.app_role[]));
drop policy if exists finance_suppliers_write on public.suppliers;
create policy finance_suppliers_write on public.suppliers for all to authenticated using (public.has_role(array['superadmin','admin','finance']::public.app_role[])) with check (public.has_role(array['superadmin','admin','finance']::public.app_role[]));
drop policy if exists finance_invoices_read on public.supplier_invoices;
create policy finance_invoices_read on public.supplier_invoices for select to authenticated using (public.has_role(array['superadmin','admin','finance','readonly']::public.app_role[]));
drop policy if exists finance_invoices_write on public.supplier_invoices;
create policy finance_invoices_write on public.supplier_invoices for all to authenticated using (public.has_role(array['superadmin','admin','finance']::public.app_role[])) with check (public.has_role(array['superadmin','admin','finance']::public.app_role[]));
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['payments','payment_allocations','approval_history','expense_categories','cost_centers'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS finance_read ON public.%I',t);
    EXECUTE format('CREATE POLICY finance_read ON public.%I FOR SELECT TO authenticated USING (public.has_role(ARRAY[''superadmin'',''admin'',''finance'',''readonly'']::public.app_role[]))',t);
    EXECUTE format('DROP POLICY IF EXISTS finance_write ON public.%I',t);
    EXECUTE format('CREATE POLICY finance_write ON public.%I FOR ALL TO authenticated USING (public.has_role(ARRAY[''superadmin'',''admin'',''finance'']::public.app_role[])) WITH CHECK (public.has_role(ARRAY[''superadmin'',''admin'',''finance'']::public.app_role[]))',t);
  END LOOP;
END $$;
drop policy if exists commercial_leads_read on public.commercial_leads;
create policy commercial_leads_read on public.commercial_leads for select to authenticated using (public.has_role(array['superadmin','admin','commercial','readonly']::public.app_role[]));
drop policy if exists commercial_leads_write on public.commercial_leads;
create policy commercial_leads_write on public.commercial_leads for all to authenticated using (public.has_role(array['superadmin','admin','commercial']::public.app_role[])) with check (public.has_role(array['superadmin','admin','commercial']::public.app_role[]));
-- Legacy table hardening, guarded so staging can be initialized before the legacy schema is imported.
DO $$
DECLARE safe_cols text;
BEGIN
  IF to_regclass('public.clientes') IS NOT NULL THEN
    ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS clientes_staff_read ON public.clientes';
    EXECUTE 'CREATE POLICY clientes_staff_read ON public.clientes FOR SELECT TO authenticated USING (public.has_role(ARRAY[''superadmin'',''admin'',''finance'',''commercial'',''support'',''readonly'']::public.app_role[]))';
    EXECUTE 'DROP POLICY IF EXISTS clientes_self_read ON public.clientes';
    EXECUTE 'CREATE POLICY clientes_self_read ON public.clientes FOR SELECT TO authenticated USING (lower(email)=lower(auth.jwt()->>''email''))';
    EXECUTE 'DROP POLICY IF EXISTS clientes_staff_insert ON public.clientes';
    EXECUTE 'CREATE POLICY clientes_staff_insert ON public.clientes FOR INSERT TO authenticated WITH CHECK (public.has_role(ARRAY[''superadmin'',''admin'',''commercial'']::public.app_role[]))';
    EXECUTE 'DROP POLICY IF EXISTS clientes_staff_update ON public.clientes';
    EXECUTE 'CREATE POLICY clientes_staff_update ON public.clientes FOR UPDATE TO authenticated USING (public.has_role(ARRAY[''superadmin'',''admin'',''commercial'']::public.app_role[])) WITH CHECK (public.has_role(ARRAY[''superadmin'',''admin'',''commercial'']::public.app_role[]))';
    EXECUTE 'REVOKE DELETE ON public.clientes FROM anon, authenticated';
    EXECUTE 'REVOKE SELECT ON public.clientes FROM anon, authenticated';
    SELECT string_agg(quote_ident(column_name), ',') INTO safe_cols FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND column_name NOT IN ('pass_noc','user_noc');
    IF safe_cols IS NOT NULL THEN EXECUTE 'GRANT SELECT ('||safe_cols||') ON public.clientes TO authenticated'; END IF;
    EXECUTE 'GRANT INSERT, UPDATE ON public.clientes TO authenticated';
  END IF;

  IF to_regclass('public.facturas') IS NOT NULL THEN
    ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS storage_path text;
    ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS facturas_staff_read ON public.facturas';
    EXECUTE 'CREATE POLICY facturas_staff_read ON public.facturas FOR SELECT TO authenticated USING (public.has_role(ARRAY[''superadmin'',''admin'',''finance'',''readonly'']::public.app_role[]))';
    IF EXISTS (select 1 from information_schema.columns where table_schema='public' and table_name='facturas' and column_name='email_cliente') THEN
      EXECUTE 'DROP POLICY IF EXISTS facturas_self_read ON public.facturas';
      EXECUTE 'CREATE POLICY facturas_self_read ON public.facturas FOR SELECT TO authenticated USING (lower(email_cliente)=lower(auth.jwt()->>''email''))';
    END IF;
    EXECUTE 'REVOKE DELETE ON public.facturas FROM anon, authenticated';
  END IF;

  IF to_regclass('public.tickets') IS NOT NULL THEN
    ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS tickets_staff_read ON public.tickets';
    EXECUTE 'CREATE POLICY tickets_staff_read ON public.tickets FOR SELECT TO authenticated USING (public.has_role(ARRAY[''superadmin'',''admin'',''support'',''readonly'']::public.app_role[]))';
    EXECUTE 'DROP POLICY IF EXISTS tickets_self_read ON public.tickets';
    EXECUTE 'CREATE POLICY tickets_self_read ON public.tickets FOR SELECT TO authenticated USING (lower(email_cliente)=lower(auth.jwt()->>''email''))';
    EXECUTE 'DROP POLICY IF EXISTS tickets_self_insert ON public.tickets';
    EXECUTE 'CREATE POLICY tickets_self_insert ON public.tickets FOR INSERT TO authenticated WITH CHECK (lower(email_cliente)=lower(auth.jwt()->>''email''))';
    EXECUTE 'DROP POLICY IF EXISTS tickets_staff_update ON public.tickets';
    EXECUTE 'CREATE POLICY tickets_staff_update ON public.tickets FOR UPDATE TO authenticated USING (public.has_role(ARRAY[''superadmin'',''admin'',''support'']::public.app_role[])) WITH CHECK (public.has_role(ARRAY[''superadmin'',''admin'',''support'']::public.app_role[]))';
    EXECUTE 'REVOKE DELETE ON public.tickets FROM anon, authenticated';
  END IF;

  IF to_regclass('public.registro_accesos') IS NOT NULL THEN
    ALTER TABLE public.registro_accesos ENABLE ROW LEVEL SECURITY;
    EXECUTE 'DROP POLICY IF EXISTS access_log_admin_only ON public.registro_accesos';
    EXECUTE 'CREATE POLICY access_log_admin_only ON public.registro_accesos FOR SELECT TO authenticated USING (public.has_role(ARRAY[''superadmin'',''admin'']::public.app_role[]))';
  END IF;
END $$;
create or replace view public.supplier_invoice_summary
with (security_invoker=true)
as
select
  i.id, i.supplier_id, i.document_type, i.folio, i.issue_date, i.received_date, i.due_date,
  i.net_amount, i.exempt_amount, i.tax_amount, i.other_taxes, i.total_amount, i.currency,
  i.category_id, i.cost_center_id, i.related_client_rut, i.related_service, i.project_reference,
  i.accounting_month, i.purchase_order, i.description, i.reception_channel, i.storage_path,
  i.xml_storage_path, i.internal_notes, i.approved_by, i.approved_at, i.created_by, i.created_at, i.updated_at,
  s.legal_name as supplier_name,
  s.rut as supplier_rut,
  c.name as category_name,
  cc.name as cost_center_name,
  coalesce(pa.paid_amount,0)::numeric(18,2) as paid_amount,
  greatest(i.total_amount-coalesce(pa.paid_amount,0),0)::numeric(18,2) as balance_due,
  case
    when i.status in ('void','rejected','credit_compensated') then i.status
    when coalesce(pa.paid_amount,0) >= i.total_amount then 'paid'
    when coalesce(pa.paid_amount,0) > 0 then 'partial'
    when i.due_date < current_date then 'overdue'
    else i.status
  end as status
from public.supplier_invoices i
join public.suppliers s on s.id=i.supplier_id
left join public.expense_categories c on c.id=i.category_id
left join public.cost_centers cc on cc.id=i.cost_center_id
left join (
  select supplier_invoice_id, sum(allocated_amount) paid_amount from public.payment_allocations group by supplier_invoice_id
) pa on pa.supplier_invoice_id=i.id;
grant select on public.supplier_invoice_summary to authenticated;
create or replace function public.approve_supplier_invoice(p_invoice_id uuid, p_status text, p_notes text default null)
returns void
language plpgsql security definer
set search_path=public
as $$
declare old_status text;
begin
  if not public.has_role(array['superadmin','admin','finance']::public.app_role[]) then raise exception 'Acceso denegado'; end if;
  if p_status not in ('under_review','approved','observed','pending_payment','rejected','void') then raise exception 'Estado no permitido'; end if;
  select status into old_status from public.supplier_invoices where id=p_invoice_id for update;
  if old_status is null then raise exception 'Factura no encontrada'; end if;
  update public.supplier_invoices set status=p_status, approved_by=case when p_status='approved' then auth.uid() else approved_by end, approved_at=case when p_status='approved' then now() else approved_at end where id=p_invoice_id;
  insert into public.approval_history(supplier_invoice_id,from_status,to_status,notes,changed_by) values(p_invoice_id,old_status,p_status,p_notes,auth.uid());
end;
$$;
grant execute on function public.approve_supplier_invoice(uuid,text,text) to authenticated;
create or replace function public.register_supplier_payment(
  p_invoice_id uuid, p_payment_date date, p_amount numeric, p_method text,
  p_bank text default null, p_source_account text default null, p_operation_number text default null,
  p_receipt_storage_path text default null, p_notes text default null
)
returns uuid
language plpgsql security definer
set search_path=public
as $$
declare v_invoice public.supplier_invoice_summary%rowtype; v_payment_id uuid; v_new_paid numeric;
begin
  if not public.has_role(array['superadmin','admin','finance']::public.app_role[]) then raise exception 'Acceso denegado'; end if;
  if p_amount <= 0 then raise exception 'Monto inválido'; end if;
  perform 1 from public.supplier_invoices where id=p_invoice_id for update;
  select * into v_invoice from public.supplier_invoice_summary where id=p_invoice_id;
  if v_invoice.id is null then raise exception 'Factura no encontrada'; end if;
  if p_amount > v_invoice.balance_due then raise exception 'El pago supera el saldo pendiente'; end if;
  insert into public.payments(payment_date,amount,currency,method,bank,source_account,operation_number,receipt_storage_path,notes,created_by)
  values(p_payment_date,p_amount,v_invoice.currency,p_method,p_bank,p_source_account,p_operation_number,p_receipt_storage_path,p_notes,auth.uid()) returning id into v_payment_id;
  insert into public.payment_allocations(payment_id,supplier_invoice_id,allocated_amount) values(v_payment_id,p_invoice_id,p_amount);
  v_new_paid := v_invoice.paid_amount + p_amount;
  update public.supplier_invoices set status=case when v_new_paid >= total_amount then 'paid' else 'partial' end where id=p_invoice_id;
  return v_payment_id;
end;
$$;
grant execute on function public.register_supplier_payment(uuid,date,numeric,text,text,text,text,text,text) to authenticated;
DO $$
DECLARE t text; trg text;
BEGIN
  FOREACH t IN ARRAY ARRAY['suppliers','supplier_invoices','commercial_leads'] LOOP
    trg := t||'_touch_updated_at';
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',trg,t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()',trg,t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['suppliers','supplier_invoices','payments','payment_allocations','approval_history','commercial_leads','app_users'] LOOP
    trg := t||'_audit';
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',trg,t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.write_audit_log(%L)',trg,t,case when t in ('suppliers','supplier_invoices','payments','payment_allocations','approval_history') then 'finance' when t='commercial_leads' then 'commercial' else 'permissions' end);
  END LOOP;
END $$;
-- Private storage buckets. Existing public buckets with these IDs are switched to private.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('supplier-invoices','supplier-invoices',false,15728640,array['application/pdf','application/xml','text/xml','image/png','image/jpeg','image/webp']),
 ('payment-receipts','payment-receipts',false,10485760,array['application/pdf','image/png','image/jpeg','image/webp']),
 ('ticket-attachments','ticket-attachments',false,10485760,array['application/pdf','image/png','image/jpeg','image/webp','text/plain']),
 ('contracts','contracts',false,15728640,array['application/pdf']),
 ('customer-invoices','customer-invoices',false,15728640,array['application/pdf','application/xml','text/xml'])
on conflict(id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
-- Storage policies intentionally grant direct reads only to staff. Client downloads use document-sign after ownership validation.
drop policy if exists staff_private_documents_read on storage.objects;
create policy staff_private_documents_read on storage.objects for select to authenticated using (
  bucket_id in ('supplier-invoices','payment-receipts','contracts','customer-invoices','ticket-attachments')
  and public.has_role(array['superadmin','admin','finance','support','commercial','readonly']::public.app_role[])
);
drop policy if exists staff_private_documents_insert on storage.objects;
create policy staff_private_documents_insert on storage.objects for insert to authenticated with check (
  (bucket_id in ('supplier-invoices','payment-receipts') and public.has_role(array['superadmin','admin','finance']::public.app_role[]))
  or (bucket_id in ('contracts','customer-invoices') and public.has_role(array['superadmin','admin','finance','commercial']::public.app_role[]))
  or (bucket_id='ticket-attachments' and (public.has_role(array['superadmin','admin','support']::public.app_role[]) or (storage.foldername(name))[1]=auth.uid()::text))
);
drop policy if exists staff_private_documents_update on storage.objects;
create policy staff_private_documents_update on storage.objects for update to authenticated using (public.has_role(array['superadmin','admin','finance','support']::public.app_role[])) with check (public.has_role(array['superadmin','admin','finance','support']::public.app_role[]));
drop policy if exists private_documents_no_delete on storage.objects;
create policy private_documents_no_delete on storage.objects for delete to authenticated using (public.has_role(array['superadmin']::public.app_role[]));
-- Explicit API privileges; RLS remains the authorization boundary.
grant usage on schema public to authenticated;
grant select on public.app_users, public.audit_logs to authenticated;
grant select, insert, update on public.suppliers, public.supplier_invoices to authenticated;
grant select on public.payments, public.payment_allocations, public.approval_history, public.expense_categories, public.cost_centers to authenticated;
grant select, insert, update on public.commercial_leads to authenticated;
revoke all on public.public_form_rate_limits from anon, authenticated;
grant select,insert,update on public.commercial_leads to service_role;
grant all on public.public_form_rate_limits to service_role;
grant all on public.audit_logs to service_role;
