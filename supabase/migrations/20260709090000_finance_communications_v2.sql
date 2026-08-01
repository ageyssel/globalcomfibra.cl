begin;
create sequence if not exists public.supplier_payment_code_seq start 1;
create or replace function public.next_supplier_payment_code()
returns text
language sql
security definer
set search_path = public
as $$
  select 'PAG-' || to_char(current_date,'YYYY') || '-' ||
         lpad(nextval('public.supplier_payment_code_seq')::text, 6, '0');
$$;
alter table public.payments
  add column if not exists payment_code text,
  add column if not exists accounting_reference text,
  add column if not exists provider_reference text,
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by uuid references auth.users(id),
  add column if not exists reversal_reason text;
update public.payments
set payment_code = public.next_supplier_payment_code()
where payment_code is null;
alter table public.payments
  alter column payment_code set default public.next_supplier_payment_code(),
  alter column payment_code set not null;
create unique index if not exists payments_payment_code_uidx
  on public.payments(payment_code);
create index if not exists payments_operation_number_idx
  on public.payments(operation_number)
  where operation_number is not null;
create index if not exists payments_payment_date_idx
  on public.payments(payment_date desc);
alter table public.facturas
  add column if not exists cliente_rut text,
  add column if not exists folio text,
  add column if not exists fecha_vencimiento date,
  add column if not exists fecha_pago date,
  add column if not exists metodo_pago text,
  add column if not exists referencia_pago text,
  add column if not exists email_status text,
  add column if not exists email_provider_id text,
  add column if not exists sent_at timestamptz,
  add column if not exists source_hash text;
create index if not exists facturas_cliente_rut_fecha_idx
  on public.facturas(
    (regexp_replace(upper(coalesce(cliente_rut,'')), '[^0-9K]', '', 'g')),
    fecha_emision desc
  );
update public.facturas f
set cliente_rut = c.rut
from public.clientes c
where f.cliente_rut is null
  and lower(f.email_cliente) = lower(c.email)
  and c.deleted_at is null
  and 1 = (
    select count(*)
    from public.clientes c2
    where lower(c2.email) = lower(f.email_cliente)
      and c2.deleted_at is null
  );
create index if not exists facturas_folio_idx
  on public.facturas(folio)
  where folio is not null;
create index if not exists facturas_source_hash_idx
  on public.facturas(source_hash)
  where source_hash is not null;
create table if not exists public.supplier_import_batches (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'csv',
  original_filename text,
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  rejected_rows integer not null default 0,
  status text not null default 'processing'
    check(status in ('processing','completed','completed_with_errors','failed')),
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create table if not exists public.supplier_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.supplier_import_batches(id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null,
  status text not null default 'pending'
    check(status in ('pending','imported','duplicate','rejected')),
  supplier_invoice_id uuid references public.supplier_invoices(id),
  error_message text,
  created_at timestamptz not null default now(),
  unique(batch_id,row_number)
);
create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'general',
  department text not null default 'Gerencia General',
  subject text not null,
  body text not null,
  active boolean not null default true,
  shared boolean not null default true,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  client_rut text,
  recipient text not null,
  cc text[],
  bcc text[],
  subject text not null,
  department text not null,
  template_id uuid references public.email_templates(id),
  message_type text not null default 'custom',
  status text not null default 'queued'
    check(status in ('queued','sent','failed')),
  provider_message_id text,
  error_message text,
  related_invoice_id text,
  sent_by uuid references auth.users(id),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_messages_created_idx
  on public.email_messages(created_at desc);
create index if not exists email_messages_client_idx
  on public.email_messages(client_rut,created_at desc);
alter table public.supplier_import_batches enable row level security;
alter table public.supplier_import_rows enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_messages enable row level security;
drop policy if exists finance_import_batches_read on public.supplier_import_batches;
create policy finance_import_batches_read
on public.supplier_import_batches for select to authenticated
using (public.has_role(array['superadmin','admin','finance','readonly']::public.app_role[]));
drop policy if exists finance_import_batches_write on public.supplier_import_batches;
create policy finance_import_batches_write
on public.supplier_import_batches for all to authenticated
using (public.has_role(array['superadmin','admin','finance']::public.app_role[]))
with check (public.has_role(array['superadmin','admin','finance']::public.app_role[]));
drop policy if exists finance_import_rows_read on public.supplier_import_rows;
create policy finance_import_rows_read
on public.supplier_import_rows for select to authenticated
using (public.has_role(array['superadmin','admin','finance','readonly']::public.app_role[]));
drop policy if exists finance_import_rows_write on public.supplier_import_rows;
create policy finance_import_rows_write
on public.supplier_import_rows for all to authenticated
using (public.has_role(array['superadmin','admin','finance']::public.app_role[]))
with check (public.has_role(array['superadmin','admin','finance']::public.app_role[]));
drop policy if exists email_templates_read on public.email_templates;
create policy email_templates_read
on public.email_templates for select to authenticated
using (
  active
  and public.has_role(array['superadmin','admin','finance','commercial','support','readonly']::public.app_role[])
);
drop policy if exists email_templates_write on public.email_templates;
create policy email_templates_write
on public.email_templates for all to authenticated
using (public.has_role(array['superadmin','admin','finance','commercial','support']::public.app_role[]))
with check (public.has_role(array['superadmin','admin','finance','commercial','support']::public.app_role[]));
drop policy if exists email_messages_read on public.email_messages;
create policy email_messages_read
on public.email_messages for select to authenticated
using (public.has_role(array['superadmin','admin','finance','commercial','support','readonly']::public.app_role[]));
drop policy if exists email_messages_insert on public.email_messages;
create policy email_messages_insert
on public.email_messages for insert to authenticated
with check (public.has_role(array['superadmin','admin','finance','commercial','support']::public.app_role[]));
grant select,insert,update on public.supplier_import_batches to authenticated;
grant select,insert,update on public.supplier_import_rows to authenticated;
grant select,insert,update on public.email_templates to authenticated;
grant select,insert on public.email_messages to authenticated;
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
    when i.status in ('approved','received','under_review') then i.status
    else 'pending_payment'
  end as status
from public.supplier_invoices i
join public.suppliers s on s.id=i.supplier_id
left join public.expense_categories c on c.id=i.category_id
left join public.cost_centers cc on cc.id=i.cost_center_id
left join (
  select pa.supplier_invoice_id, sum(pa.allocated_amount) paid_amount
  from public.payment_allocations pa
  join public.payments p on p.id=pa.payment_id
  where p.reversed_at is null
  group by pa.supplier_invoice_id
) pa on pa.supplier_invoice_id=i.id
where i.deleted_at is null;
grant select on public.supplier_invoice_summary to authenticated;
create or replace view public.supplier_account_summary
with (security_invoker=true)
as
select
  s.id as supplier_id,
  s.legal_name,
  s.trade_name,
  s.rut,
  s.contact_name,
  s.contact_email,
  s.payment_email,
  s.bank_name,
  s.bank_account_type,
  s.bank_account_number,
  count(i.id)::integer as invoice_count,
  coalesce(sum(i.total_amount),0)::numeric(18,2) as total_invoiced,
  coalesce(sum(i.paid_amount),0)::numeric(18,2) as total_paid,
  coalesce(sum(i.balance_due),0)::numeric(18,2) as balance_due,
  coalesce(sum(case when i.status='overdue' then i.balance_due else 0 end),0)::numeric(18,2) as overdue_balance,
  coalesce(sum(case when i.balance_due>0 and i.due_date between current_date and current_date+30 then i.balance_due else 0 end),0)::numeric(18,2) as due_next_30_days,
  max(i.issue_date) as last_invoice_date
from public.suppliers s
left join public.supplier_invoice_summary i on i.supplier_id=s.id
where s.deleted_at is null
group by s.id,s.legal_name,s.trade_name,s.rut,s.contact_name,s.contact_email,
         s.payment_email,s.bank_name,s.bank_account_type,s.bank_account_number;
grant select on public.supplier_account_summary to authenticated;
create or replace view public.supplier_payment_history
with (security_invoker=true)
as
select
  p.id,
  p.payment_code,
  p.payment_date,
  p.amount,
  p.currency,
  p.method,
  p.bank,
  p.source_account,
  p.operation_number,
  p.accounting_reference,
  p.provider_reference,
  p.receipt_storage_path,
  p.notes,
  p.reversed_at,
  p.reversal_reason,
  p.created_by,
  p.created_at,
  s.id as supplier_id,
  s.legal_name as supplier_name,
  s.rut as supplier_rut,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'invoice_id', i.id,
        'document_type', i.document_type,
        'folio', i.folio,
        'allocated_amount', pa.allocated_amount
      )
      order by i.issue_date
    ) filter (where i.id is not null),
    '[]'::jsonb
  ) as allocations
from public.payments p
left join public.payment_allocations pa on pa.payment_id=p.id
left join public.supplier_invoices i on i.id=pa.supplier_invoice_id
left join public.suppliers s on s.id=i.supplier_id
group by p.id,s.id,s.legal_name,s.rut;
grant select on public.supplier_payment_history to authenticated;
create or replace function public.register_supplier_payment_v2(
  p_payment_date date,
  p_amount numeric,
  p_method text,
  p_allocations jsonb,
  p_bank text default null,
  p_source_account text default null,
  p_operation_number text default null,
  p_accounting_reference text default null,
  p_provider_reference text default null,
  p_receipt_storage_path text default null,
  p_notes text default null,
  p_payment_code text default null
)
returns table(payment_id uuid,payment_code text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_payment_id uuid;
  v_code text;
  v_item jsonb;
  v_invoice_id uuid;
  v_allocated numeric;
  v_sum numeric := 0;
  v_balance numeric;
  v_status text;
begin
  if not public.has_role(array['superadmin','admin','finance']::public.app_role[]) then
    raise exception 'Acceso denegado';
  end if;
  if p_amount <= 0 then raise exception 'Monto inválido'; end if;
  if jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations)=0 then
    raise exception 'Debe indicar al menos una factura';
  end if;

  select coalesce(sum((value->>'amount')::numeric),0)
  into v_sum
  from jsonb_array_elements(p_allocations);

  if abs(v_sum-p_amount) > 0.01 then
    raise exception 'La suma distribuida no coincide con el pago';
  end if;

  v_code := nullif(trim(coalesce(p_payment_code,'')),'');
  if v_code is null then v_code := public.next_supplier_payment_code(); end if;

  insert into public.payments(
    payment_code,payment_date,amount,currency,method,bank,source_account,
    operation_number,accounting_reference,provider_reference,
    receipt_storage_path,notes,created_by
  )
  values(
    v_code,p_payment_date,p_amount,'CLP',p_method,p_bank,p_source_account,
    p_operation_number,p_accounting_reference,p_provider_reference,
    p_receipt_storage_path,p_notes,auth.uid()
  )
  returning id into v_payment_id;

  for v_item in select value from jsonb_array_elements(p_allocations)
  loop
    v_invoice_id := (v_item->>'invoiceId')::uuid;
    v_allocated := (v_item->>'amount')::numeric;
    if v_allocated <= 0 then raise exception 'Distribución inválida'; end if;

    perform 1 from public.supplier_invoices where id=v_invoice_id for update;
    select balance_due into v_balance
    from public.supplier_invoice_summary
    where id=v_invoice_id;

    if v_balance is null then raise exception 'Factura no encontrada'; end if;
    if v_allocated > v_balance + 0.01 then
      raise exception 'El pago supera el saldo de una factura';
    end if;

    insert into public.payment_allocations(payment_id,supplier_invoice_id,allocated_amount)
    values(v_payment_id,v_invoice_id,v_allocated);
  end loop;

  for v_invoice_id in
    select distinct (value->>'invoiceId')::uuid
    from jsonb_array_elements(p_allocations)
  loop
    select status into v_status from public.supplier_invoice_summary where id=v_invoice_id;
    update public.supplier_invoices set status=v_status where id=v_invoice_id;
  end loop;

  return query select v_payment_id,v_code;
end;
$$;
grant execute on function public.register_supplier_payment_v2(
  date,numeric,text,jsonb,text,text,text,text,text,text,text,text
) to authenticated;
create or replace function public.reverse_supplier_payment(
  p_payment_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_invoice_id uuid;
  v_status text;
begin
  if not public.has_role(array['superadmin','admin','finance']::public.app_role[]) then
    raise exception 'Acceso denegado';
  end if;
  if length(trim(coalesce(p_reason,''))) < 5 then
    raise exception 'Debe informar el motivo de la reversa';
  end if;

  update public.payments
  set reversed_at=now(), reversed_by=auth.uid(), reversal_reason=trim(p_reason)
  where id=p_payment_id and reversed_at is null;

  if not found then raise exception 'Pago no encontrado o ya reversado'; end if;

  for v_invoice_id in
    select supplier_invoice_id from public.payment_allocations where payment_id=p_payment_id
  loop
    select status into v_status from public.supplier_invoice_summary where id=v_invoice_id;
    update public.supplier_invoices set status=v_status where id=v_invoice_id;
  end loop;
end;
$$;
grant execute on function public.reverse_supplier_payment(uuid,text) to authenticated;
drop trigger if exists email_templates_touch_updated_at on public.email_templates;
create trigger email_templates_touch_updated_at
before update on public.email_templates
for each row execute function public.touch_updated_at();
insert into public.email_templates(name,category,department,subject,body,shared)
select *
from (values
  ('Factura mensual','facturacion','Facturación y Cobranza',
   'Factura de servicios Globalcom — [PERIODO]',
   'Estimados equipo de [EMPRESA],\n\nJunto con saludar, informamos que su factura correspondiente a [PERIODO] ya se encuentra disponible.\n\nMonto total: [MONTO_TOTAL]\nFecha de vencimiento: [FECHA_VENCIMIENTO]\n\nPuede revisar y descargar el documento desde su portal privado.\n\nSaludos cordiales.',true),
  ('Cobranza amable','cobranza','Facturación y Cobranza',
   'Recordatorio de pago — [EMPRESA]',
   'Estimados equipo de [EMPRESA],\n\nEsperamos que se encuentren bien. Les compartimos un recordatorio sobre su estado de cuenta:\n\n[ESTADO_CUENTA]\n\nDeuda total pendiente: [DEUDA_TOTAL]\n\nSi el pago ya fue realizado, agradeceremos enviar el comprobante a contacto@globalcomfibra.cl.\n\nSaludos cordiales.',true),
  ('Confirmación de pago','pagos','Facturación y Cobranza',
   'Pago recibido — [EMPRESA]',
   'Estimados equipo de [EMPRESA],\n\nConfirmamos la recepción de su pago. Su estado de cuenta ha sido actualizado correctamente.\n\nAgradecemos su gestión.\n\nSaludos cordiales.',true),
  ('Gestión comercial','comercial','Gerencia Comercial',
   'Soluciones de conectividad Globalcom para [EMPRESA]',
   'Estimado equipo de [EMPRESA],\n\nNos gustaría presentarles nuestras soluciones de internet dedicado, transporte de datos, fibra oscura y soporte especializado.\n\nQuedamos disponibles para evaluar sus necesidades y preparar una propuesta.\n\nSaludos cordiales.',true),
  ('Notificación técnica','soporte','Soporte Técnico - NOC',
   'Información técnica de su servicio Globalcom',
   'Estimados equipo de [EMPRESA],\n\nLes informamos la siguiente actualización relacionada con su servicio:\n\n[DETALLE]\n\nNuestro equipo de soporte se mantiene disponible.\n\nSaludos cordiales.',true)
) as seed(name,category,department,subject,body,shared)
where not exists (
  select 1 from public.email_templates t where lower(t.name)=lower(seed.name)
);
commit;
