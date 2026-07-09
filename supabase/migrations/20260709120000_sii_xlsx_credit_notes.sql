begin;

alter table public.supplier_invoices
  alter column due_date drop not null,
  add column if not exists dte_type_code integer,
  add column if not exists sii_receiver_rut text,
  add column if not exists source_filename text,
  add column if not exists source_row_number integer;

create index if not exists supplier_invoices_dte_identity_idx
  on public.supplier_invoices(supplier_id,dte_type_code,folio)
  where deleted_at is null and status <> 'void';

create table if not exists public.supplier_credit_notes (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id),
  document_type text not null,
  dte_type_code integer not null,
  folio text not null,
  issue_date date not null,
  received_date date not null default current_date,
  net_amount numeric(18,2) not null default 0 check(net_amount >= 0),
  exempt_amount numeric(18,2) not null default 0 check(exempt_amount >= 0),
  tax_amount numeric(18,2) not null default 0 check(tax_amount >= 0),
  other_taxes numeric(18,2) not null default 0 check(other_taxes >= 0),
  total_amount numeric(18,2) not null check(total_amount > 0),
  currency text not null default 'CLP' check(currency in ('CLP','UF','USD')),
  description text,
  reception_channel text not null default 'sii_xlsx',
  sii_receiver_rut text,
  source_filename text,
  source_row_number integer,
  status text not null default 'available'
    check(status in ('available','partially_applied','applied','observed','void')),
  internal_notes text,
  deleted_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_credit_note_amounts_match
    check(abs(total_amount - (net_amount + exempt_amount + tax_amount + other_taxes)) <= 1)
);

create unique index if not exists supplier_credit_notes_identity_uidx
  on public.supplier_credit_notes(supplier_id,dte_type_code,folio)
  where deleted_at is null and status <> 'void';

create index if not exists supplier_credit_notes_supplier_idx
  on public.supplier_credit_notes(supplier_id,issue_date desc);

create table if not exists public.supplier_credit_allocations (
  id uuid primary key default gen_random_uuid(),
  credit_note_id uuid not null references public.supplier_credit_notes(id) on delete restrict,
  supplier_invoice_id uuid not null references public.supplier_invoices(id) on delete restrict,
  allocated_amount numeric(18,2) not null check(allocated_amount > 0),
  allocation_method text not null default 'automatic',
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(credit_note_id,supplier_invoice_id)
);

create index if not exists supplier_credit_allocations_invoice_idx
  on public.supplier_credit_allocations(supplier_invoice_id);

alter table public.supplier_import_rows
  add column if not exists document_kind text,
  add column if not exists supplier_credit_note_id uuid references public.supplier_credit_notes(id);

alter table public.supplier_import_rows
  drop constraint if exists supplier_import_rows_status_check;

alter table public.supplier_import_rows
  add constraint supplier_import_rows_status_check
  check(status in (
    'pending',
    'imported',
    'duplicate',
    'rejected',
    'credit_imported',
    'credit_duplicate',
    'excluded'
  ));

alter table public.supplier_credit_notes enable row level security;
alter table public.supplier_credit_allocations enable row level security;

drop policy if exists finance_credit_notes_read on public.supplier_credit_notes;
create policy finance_credit_notes_read
on public.supplier_credit_notes for select to authenticated
using (
  public.has_role(
    array['superadmin','admin','finance','readonly']::public.app_role[]
  )
);

drop policy if exists finance_credit_allocations_read on public.supplier_credit_allocations;
create policy finance_credit_allocations_read
on public.supplier_credit_allocations for select to authenticated
using (
  public.has_role(
    array['superadmin','admin','finance','readonly']::public.app_role[]
  )
);

grant select on public.supplier_credit_notes to authenticated;
grant select on public.supplier_credit_allocations to authenticated;
grant all on public.supplier_credit_notes to service_role;
grant all on public.supplier_credit_allocations to service_role;

drop trigger if exists supplier_credit_notes_touch_updated_at
  on public.supplier_credit_notes;
create trigger supplier_credit_notes_touch_updated_at
before update on public.supplier_credit_notes
for each row execute function public.touch_updated_at();

drop trigger if exists supplier_credit_notes_audit
  on public.supplier_credit_notes;
create trigger supplier_credit_notes_audit
after insert or update or delete on public.supplier_credit_notes
for each row execute function public.write_audit_log('finance');

drop trigger if exists supplier_credit_allocations_audit
  on public.supplier_credit_allocations;
create trigger supplier_credit_allocations_audit
after insert or update or delete on public.supplier_credit_allocations
for each row execute function public.write_audit_log('finance');

create or replace function public.auto_allocate_supplier_credit(
  p_credit_note_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credit public.supplier_credit_notes%rowtype;
  v_remaining numeric(18,2);
  v_existing numeric(18,2);
  v_allocate numeric(18,2);
  v_invoice record;
begin
  select *
    into v_credit
  from public.supplier_credit_notes
  where id = p_credit_note_id
    and deleted_at is null
    and status <> 'void'
  for update;

  if v_credit.id is null then
    return;
  end if;

  select coalesce(sum(allocated_amount),0)
    into v_existing
  from public.supplier_credit_allocations
  where credit_note_id = v_credit.id;

  v_remaining := greatest(v_credit.total_amount - v_existing,0);

  if v_remaining <= 0 then
    update public.supplier_credit_notes
    set status = 'applied'
    where id = v_credit.id;
    return;
  end if;

  for v_invoice in
    with balances as (
      select
        i.id,
        i.issue_date,
        i.total_amount,
        coalesce(p.paid_amount,0) as paid_amount,
        coalesce(c.credited_amount,0) as credited_amount,
        greatest(
          i.total_amount
          - coalesce(p.paid_amount,0)
          - coalesce(c.credited_amount,0),
          0
        ) as balance_due
      from public.supplier_invoices i
      left join (
        select
          pa.supplier_invoice_id,
          sum(pa.allocated_amount) as paid_amount
        from public.payment_allocations pa
        join public.payments pmt on pmt.id = pa.payment_id
        where pmt.reversed_at is null
        group by pa.supplier_invoice_id
      ) p on p.supplier_invoice_id = i.id
      left join (
        select
          supplier_invoice_id,
          sum(allocated_amount) as credited_amount
        from public.supplier_credit_allocations
        group by supplier_invoice_id
      ) c on c.supplier_invoice_id = i.id
      where i.supplier_id = v_credit.supplier_id
        and i.deleted_at is null
        and i.status not in ('void','rejected')
    )
    select *
    from balances
    where balance_due > 0
    order by
      case when abs(balance_due - v_remaining) <= 1 then 0 else 1 end,
      case when issue_date <= v_credit.issue_date then 0 else 1 end,
      abs(v_credit.issue_date - issue_date),
      issue_date desc,
      id
  loop
    exit when v_remaining <= 0;

    perform 1 from public.supplier_invoices where id = v_invoice.id for update;

    v_allocate := least(v_remaining,v_invoice.balance_due);

    insert into public.supplier_credit_allocations(
      credit_note_id,
      supplier_invoice_id,
      allocated_amount,
      allocation_method,
      notes
    )
    values(
      v_credit.id,
      v_invoice.id,
      v_allocate,
      case
        when abs(v_invoice.balance_due - v_remaining) <= 1
          then 'automatic_exact_balance'
        else 'automatic_closest_invoice'
      end,
      'Asignación automática por proveedor, saldo y cercanía de fecha.'
    )
    on conflict(credit_note_id,supplier_invoice_id)
    do update set
      allocated_amount = public.supplier_credit_allocations.allocated_amount
                         + excluded.allocated_amount,
      allocation_method = excluded.allocation_method,
      notes = excluded.notes;

    v_remaining := greatest(v_remaining - v_allocate,0);
  end loop;

  update public.supplier_credit_notes
  set status = case
    when v_remaining <= 1 then 'applied'
    when v_remaining < total_amount then 'partially_applied'
    else 'available'
  end
  where id = v_credit.id;
end;
$$;

revoke all on function public.auto_allocate_supplier_credit(uuid) from public;
grant execute on function public.auto_allocate_supplier_credit(uuid)
  to authenticated, service_role;

create or replace function public.allocate_new_supplier_credit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.auto_allocate_supplier_credit(new.id);
  return new;
end;
$$;

drop trigger if exists supplier_credit_note_auto_allocate
  on public.supplier_credit_notes;
create trigger supplier_credit_note_auto_allocate
after insert on public.supplier_credit_notes
for each row execute function public.allocate_new_supplier_credit();

create or replace function public.apply_available_credits_to_new_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credit_id uuid;
begin
  for v_credit_id in
    select cn.id
    from public.supplier_credit_notes cn
    left join (
      select credit_note_id,sum(allocated_amount) allocated
      from public.supplier_credit_allocations
      group by credit_note_id
    ) ca on ca.credit_note_id = cn.id
    where cn.supplier_id = new.supplier_id
      and cn.deleted_at is null
      and cn.status <> 'void'
      and cn.total_amount - coalesce(ca.allocated,0) > 0
    order by cn.issue_date,cn.id
  loop
    perform public.auto_allocate_supplier_credit(v_credit_id);
  end loop;

  return new;
end;
$$;

drop trigger if exists supplier_invoice_apply_available_credits
  on public.supplier_invoices;
create trigger supplier_invoice_apply_available_credits
after insert on public.supplier_invoices
for each row execute function public.apply_available_credits_to_new_invoice();

create or replace view public.supplier_invoice_summary
with (security_invoker=true)
as
select
  i.id,
  i.supplier_id,
  i.document_type,
  i.folio,
  i.issue_date,
  i.received_date,
  i.due_date,
  i.net_amount,
  i.exempt_amount,
  i.tax_amount,
  i.other_taxes,
  i.total_amount,
  i.currency,
  i.category_id,
  i.cost_center_id,
  i.related_client_rut,
  i.related_service,
  i.project_reference,
  i.accounting_month,
  i.purchase_order,
  i.description,
  i.reception_channel,
  i.storage_path,
  i.xml_storage_path,
  i.internal_notes,
  i.approved_by,
  i.approved_at,
  i.created_by,
  i.created_at,
  i.updated_at,
  s.legal_name as supplier_name,
  s.rut as supplier_rut,
  c.name as category_name,
  cc.name as cost_center_name,
  coalesce(pa.paid_amount,0)::numeric(18,2) as paid_amount,
  greatest(
    i.total_amount
    - coalesce(pa.paid_amount,0)
    - coalesce(ca.credited_amount,0),
    0
  )::numeric(18,2) as balance_due,
  case
    when i.status in ('void','rejected') then i.status
    when coalesce(pa.paid_amount,0) + coalesce(ca.credited_amount,0) >= i.total_amount
      and coalesce(ca.credited_amount,0) > 0
      and coalesce(pa.paid_amount,0) = 0
      then 'credit_compensated'
    when coalesce(pa.paid_amount,0) + coalesce(ca.credited_amount,0) >= i.total_amount
      then 'paid'
    when coalesce(pa.paid_amount,0) + coalesce(ca.credited_amount,0) > 0
      then 'partial'
    when i.due_date is not null and i.due_date < current_date
      then 'overdue'
    when i.status in ('approved','received','under_review','observed')
      then i.status
    else 'pending_payment'
  end as status,
  i.dte_type_code,
  i.sii_receiver_rut,
  i.source_filename,
  i.source_row_number,
  coalesce(ca.credited_amount,0)::numeric(18,2) as credited_amount
from public.supplier_invoices i
join public.suppliers s on s.id = i.supplier_id
left join public.expense_categories c on c.id = i.category_id
left join public.cost_centers cc on cc.id = i.cost_center_id
left join (
  select
    pa.supplier_invoice_id,
    sum(pa.allocated_amount) paid_amount
  from public.payment_allocations pa
  join public.payments p on p.id = pa.payment_id
  where p.reversed_at is null
  group by pa.supplier_invoice_id
) pa on pa.supplier_invoice_id = i.id
left join (
  select
    supplier_invoice_id,
    sum(allocated_amount) credited_amount
  from public.supplier_credit_allocations
  group by supplier_invoice_id
) ca on ca.supplier_invoice_id = i.id
where i.deleted_at is null;

create or replace view public.supplier_credit_note_summary
with (security_invoker=true)
as
select
  cn.id,
  cn.supplier_id,
  cn.document_type,
  cn.dte_type_code,
  cn.folio,
  cn.issue_date,
  cn.received_date,
  cn.net_amount,
  cn.exempt_amount,
  cn.tax_amount,
  cn.other_taxes,
  cn.total_amount,
  cn.currency,
  cn.description,
  cn.reception_channel,
  cn.sii_receiver_rut,
  cn.source_filename,
  cn.source_row_number,
  cn.internal_notes,
  cn.created_at,
  cn.updated_at,
  s.legal_name as supplier_name,
  s.rut as supplier_rut,
  coalesce(a.applied_amount,0)::numeric(18,2) as applied_amount,
  greatest(cn.total_amount - coalesce(a.applied_amount,0),0)::numeric(18,2)
    as available_amount,
  case
    when cn.status = 'void' then 'void'
    when coalesce(a.applied_amount,0) >= cn.total_amount then 'applied'
    when coalesce(a.applied_amount,0) > 0 then 'partially_applied'
    else cn.status
  end as status,
  coalesce(a.allocations,'[]'::jsonb) as allocations
from public.supplier_credit_notes cn
join public.suppliers s on s.id = cn.supplier_id
left join (
  select
    ca.credit_note_id,
    sum(ca.allocated_amount) applied_amount,
    jsonb_agg(
      jsonb_build_object(
        'invoice_id',i.id,
        'document_type',i.document_type,
        'folio',i.folio,
        'allocated_amount',ca.allocated_amount
      )
      order by i.issue_date,i.id
    ) allocations
  from public.supplier_credit_allocations ca
  join public.supplier_invoices i on i.id = ca.supplier_invoice_id
  group by ca.credit_note_id
) a on a.credit_note_id = cn.id
where cn.deleted_at is null;

create or replace view public.supplier_account_summary
with (security_invoker=true)
as
with invoice_totals as (
  select
    supplier_id,
    count(id)::integer as invoice_count,
    coalesce(sum(total_amount),0)::numeric(18,2) as total_invoiced,
    coalesce(sum(paid_amount),0)::numeric(18,2) as total_paid,
    coalesce(sum(balance_due),0)::numeric(18,2) as invoice_balance,
    coalesce(
      sum(case when status='overdue' then balance_due else 0 end),
      0
    )::numeric(18,2) as overdue_balance,
    coalesce(
      sum(
        case
          when balance_due > 0
            and due_date between current_date and current_date + 30
          then balance_due
          else 0
        end
      ),
      0
    )::numeric(18,2) as due_next_30_days,
    max(issue_date) as last_invoice_date
  from public.supplier_invoice_summary
  group by supplier_id
),
credit_totals as (
  select
    supplier_id,
    count(id)::integer as credit_note_count,
    coalesce(sum(total_amount),0)::numeric(18,2) as total_credits,
    coalesce(sum(applied_amount),0)::numeric(18,2) as applied_credits,
    coalesce(sum(available_amount),0)::numeric(18,2) as available_credit
  from public.supplier_credit_note_summary
  where status <> 'void'
  group by supplier_id
)
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
  coalesce(i.invoice_count,0)::integer as invoice_count,
  coalesce(i.total_invoiced,0)::numeric(18,2) as total_invoiced,
  coalesce(i.total_paid,0)::numeric(18,2) as total_paid,
  greatest(
    coalesce(i.invoice_balance,0) - coalesce(c.available_credit,0),
    0
  )::numeric(18,2) as balance_due,
  greatest(
    coalesce(i.overdue_balance,0) - coalesce(c.available_credit,0),
    0
  )::numeric(18,2) as overdue_balance,
  greatest(
    coalesce(i.due_next_30_days,0) - coalesce(c.available_credit,0),
    0
  )::numeric(18,2) as due_next_30_days,
  i.last_invoice_date,
  coalesce(c.credit_note_count,0)::integer as credit_note_count,
  coalesce(c.total_credits,0)::numeric(18,2) as total_credits,
  coalesce(c.applied_credits,0)::numeric(18,2) as applied_credits,
  coalesce(c.available_credit,0)::numeric(18,2) as available_credit
from public.suppliers s
left join invoice_totals i on i.supplier_id = s.id
left join credit_totals c on c.supplier_id = s.id
where s.deleted_at is null;

grant select on public.supplier_invoice_summary to authenticated;
grant select on public.supplier_credit_note_summary to authenticated;
grant select on public.supplier_account_summary to authenticated;

commit;
