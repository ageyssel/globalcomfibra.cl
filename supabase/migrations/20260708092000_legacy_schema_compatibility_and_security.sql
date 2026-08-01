-- Globalcom legacy schema compatibility and security hardening.
-- Apply after 20260708090000_platform_core_and_finance.sql.
-- This migration preserves existing UUID/bigint primary keys and legacy data.

begin;
-- Required functions/types are created by the core migration.
do $$
begin
  if to_regprocedure('public.touch_updated_at()') is null then
    raise exception 'Missing public.touch_updated_at(). Apply 20260708090000 first.';
  end if;
  if to_regprocedure('public.write_audit_log()') is null then
    raise exception 'Missing public.write_audit_log(). Apply 20260708090000 first.';
  end if;
  if to_regprocedure('public.has_role(public.app_role[])') is null then
    raise exception 'Missing public.has_role(app_role[]). Apply 20260708090000 first.';
  end if;
end $$;
-- Preserve the existing legacy tables and add only columns required by the new UI.
alter table public.clientes
  add column if not exists deleted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();
alter table public.facturas
  add column if not exists storage_path text,
  add column if not exists fecha_vencimiento date,
  add column if not exists deleted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();
alter table public.tickets
  add column if not exists empresa text,
  add column if not exists deleted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();
-- Map the legacy open state to the state used by the new support workflow.
update public.tickets
set estado = 'Nuevo'
where estado = 'Abierto';
-- Keep timestamps consistent without changing existing primary-key types.
drop trigger if exists clientes_touch_updated_at on public.clientes;
create trigger clientes_touch_updated_at
before update on public.clientes
for each row execute function public.touch_updated_at();
drop trigger if exists facturas_touch_updated_at on public.facturas;
create trigger facturas_touch_updated_at
before update on public.facturas
for each row execute function public.touch_updated_at();
drop trigger if exists tickets_touch_updated_at on public.tickets;
create trigger tickets_touch_updated_at
before update on public.tickets
for each row execute function public.touch_updated_at();
-- Useful non-unique indexes. We intentionally avoid unique constraints because
-- the legacy database can contain multiple services/companies sharing an email.
create index if not exists clientes_email_lower_idx
  on public.clientes (lower(email));
create index if not exists clientes_rut_normalized_idx
  on public.clientes ((regexp_replace(upper(coalesce(rut,'')), '[^0-9K]', '', 'g')));
create index if not exists clientes_estado_empresa_idx
  on public.clientes (estado, empresa);
create index if not exists facturas_cliente_fecha_idx
  on public.facturas (lower(email_cliente), fecha_emision desc);
create index if not exists facturas_estado_fecha_idx
  on public.facturas (estado, fecha_emision desc);
create index if not exists tickets_cliente_fecha_idx
  on public.tickets (lower(email_cliente), created_at desc);
create index if not exists tickets_estado_prioridad_fecha_idx
  on public.tickets (estado, prioridad, created_at desc);
-- Redact legacy NOC credentials from audit payloads before attaching audit triggers.
create or replace function public.write_audit_log()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  row_id text;
  row_label text;
  old_payload jsonb;
  new_payload jsonb;
  effective_payload jsonb;
begin
  old_payload := case when tg_op in ('UPDATE','DELETE')
    then to_jsonb(old) - 'pass_noc' - 'user_noc'
    else null end;
  new_payload := case when tg_op in ('INSERT','UPDATE')
    then to_jsonb(new) - 'pass_noc' - 'user_noc'
    else null end;
  effective_payload := coalesce(new_payload, old_payload, '{}'::jsonb);
  row_id := coalesce(effective_payload->>'id', '');
  row_label := coalesce(
    effective_payload->>'legal_name',
    effective_payload->>'empresa',
    effective_payload->>'folio',
    row_id
  );

  insert into public.audit_logs(
    user_id,user_email,action,module,record_type,record_id,record_label,
    old_values,new_values
  )
  values(
    auth.uid(), auth.jwt()->>'email', lower(tg_op), tg_argv[0], tg_table_name,
    row_id, row_label, old_payload, new_payload
  );

  return case when tg_op='DELETE' then old else new end;
end;
$$;
-- Remove every legacy policy on the operational tables. This is necessary because
-- policies are OR-combined, and the old "Permitir lectura a todos" policies expose data.
do $$
declare
  p record;
begin
  for p in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(array['clientes','facturas','tickets','registro_accesos'])
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
alter table public.clientes enable row level security;
alter table public.facturas enable row level security;
alter table public.tickets enable row level security;
alter table public.registro_accesos enable row level security;
-- CLIENTES
create policy clientes_staff_read
on public.clientes for select to authenticated
using (
  deleted_at is null
  and public.has_role(array['superadmin','admin','finance','commercial','support','readonly']::public.app_role[])
);
create policy clientes_self_read
on public.clientes for select to authenticated
using (
  deleted_at is null
  and lower(email) = lower(coalesce(auth.jwt()->>'email',''))
);
create policy clientes_staff_insert
on public.clientes for insert to authenticated
with check (
  deleted_at is null
  and public.has_role(array['superadmin','admin','commercial']::public.app_role[])
);
create policy clientes_staff_update
on public.clientes for update to authenticated
using (
  deleted_at is null
  and public.has_role(array['superadmin','admin','commercial']::public.app_role[])
)
with check (
  public.has_role(array['superadmin','admin','commercial']::public.app_role[])
);
-- FACTURAS DE CLIENTES
create policy facturas_staff_read
on public.facturas for select to authenticated
using (
  deleted_at is null
  and public.has_role(array['superadmin','admin','finance','readonly']::public.app_role[])
);
create policy facturas_self_read
on public.facturas for select to authenticated
using (
  deleted_at is null
  and lower(email_cliente) = lower(coalesce(auth.jwt()->>'email',''))
);
create policy facturas_staff_insert
on public.facturas for insert to authenticated
with check (
  deleted_at is null
  and public.has_role(array['superadmin','admin','finance']::public.app_role[])
);
create policy facturas_staff_update
on public.facturas for update to authenticated
using (
  deleted_at is null
  and public.has_role(array['superadmin','admin','finance']::public.app_role[])
)
with check (
  public.has_role(array['superadmin','admin','finance']::public.app_role[])
);
-- SOPORTE
create policy tickets_staff_read
on public.tickets for select to authenticated
using (
  deleted_at is null
  and public.has_role(array['superadmin','admin','support','readonly']::public.app_role[])
);
create policy tickets_self_read
on public.tickets for select to authenticated
using (
  deleted_at is null
  and lower(email_cliente) = lower(coalesce(auth.jwt()->>'email',''))
);
create policy tickets_self_insert
on public.tickets for insert to authenticated
with check (
  deleted_at is null
  and lower(email_cliente) = lower(coalesce(auth.jwt()->>'email',''))
);
create policy tickets_staff_insert
on public.tickets for insert to authenticated
with check (
  deleted_at is null
  and public.has_role(array['superadmin','admin','support']::public.app_role[])
);
create policy tickets_staff_update
on public.tickets for update to authenticated
using (
  deleted_at is null
  and public.has_role(array['superadmin','admin','support']::public.app_role[])
)
with check (
  public.has_role(array['superadmin','admin','support']::public.app_role[])
);
-- ACCESS LOG
create policy access_log_admin_read
on public.registro_accesos for select to authenticated
using (public.has_role(array['superadmin','admin']::public.app_role[]));
create policy access_log_self_insert
on public.registro_accesos for insert to authenticated
with check (lower(email_cliente) = lower(coalesce(auth.jwt()->>'email','')));
-- Revoke broad legacy API privileges and grant only what the application uses.
revoke all on public.clientes from anon, authenticated;
revoke all on public.facturas from anon, authenticated;
revoke all on public.tickets from anon, authenticated;
revoke all on public.registro_accesos from anon, authenticated;
-- Client credentials remain inaccessible to authenticated API users.
do $$
declare
  readable_cols text;
  writable_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into readable_cols
  from information_schema.columns
  where table_schema='public'
    and table_name='clientes'
    and column_name not in ('pass_noc','user_noc');

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into writable_cols
  from information_schema.columns
  where table_schema='public'
    and table_name='clientes'
    and column_name not in ('id','created_at','updated_at','pass_noc','user_noc');

  if readable_cols is not null then
    execute 'grant select (' || readable_cols || ') on public.clientes to authenticated';
  end if;
  if writable_cols is not null then
    execute 'grant insert (' || writable_cols || ') on public.clientes to authenticated';
    execute 'grant update (' || writable_cols || ') on public.clientes to authenticated';
  end if;
end $$;
grant select, insert, update on public.facturas to authenticated;
grant select, insert, update on public.tickets to authenticated;
grant select, insert on public.registro_accesos to authenticated;
grant all on public.clientes to service_role;
grant all on public.facturas to service_role;
grant all on public.tickets to service_role;
grant all on public.registro_accesos to service_role;
-- Identity sequence privileges are conditional because facturas uses UUID in the legacy schema.
do $$
declare
  seq_name text;
begin
  seq_name := pg_get_serial_sequence('public.tickets','id');
  if seq_name is not null then
    execute format('grant usage, select on sequence %s to authenticated, service_role', seq_name);
  end if;

  seq_name := pg_get_serial_sequence('public.registro_accesos','id');
  if seq_name is not null then
    execute format('grant usage, select on sequence %s to authenticated, service_role', seq_name);
  end if;
end $$;
-- Attach auditing only after redaction is active.
drop trigger if exists clientes_audit on public.clientes;
create trigger clientes_audit
after insert or update or delete on public.clientes
for each row execute function public.write_audit_log('clients');
drop trigger if exists facturas_audit on public.facturas;
create trigger facturas_audit
after insert or update or delete on public.facturas
for each row execute function public.write_audit_log('customer_finance');
drop trigger if exists tickets_audit on public.tickets;
create trigger tickets_audit
after insert or update or delete on public.tickets
for each row execute function public.write_audit_log('support');
commit;
