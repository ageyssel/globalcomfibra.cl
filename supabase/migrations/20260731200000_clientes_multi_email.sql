-- Permite hasta 10 destinatarios por categoría manteniendo compatibilidad
-- con el campo histórico correo_facturacion y con el email único de acceso.

alter table public.clientes
    add column if not exists correos_generales text[] not null default '{}'::text[],
    add column if not exists correos_facturacion text[] not null default '{}'::text[],
    add column if not exists correos_soporte text[] not null default '{}'::text[];

-- Migración retrocompatible de los clientes existentes.
update public.clientes
set correos_generales = array[lower(trim(email))]
where cardinality(correos_generales) = 0
  and email is not null
  and trim(email) <> '';

update public.clientes
set correos_facturacion = array[
    lower(trim(coalesce(nullif(correo_facturacion, ''), email)))
]
where cardinality(correos_facturacion) = 0
  and coalesce(nullif(trim(correo_facturacion), ''), nullif(trim(email), '')) is not null;

update public.clientes
set correos_soporte = array[lower(trim(email))]
where cardinality(correos_soporte) = 0
  and email is not null
  and trim(email) <> '';

-- Conserva el campo histórico sincronizado con el primer correo de facturación.
update public.clientes
set correo_facturacion = correos_facturacion[1]
where cardinality(correos_facturacion) > 0
  and (correo_facturacion is null or trim(correo_facturacion) = '');

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'clientes_correos_generales_max_10'
    ) then
        alter table public.clientes
            add constraint clientes_correos_generales_max_10
            check (cardinality(correos_generales) <= 10);
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'clientes_correos_facturacion_max_10'
    ) then
        alter table public.clientes
            add constraint clientes_correos_facturacion_max_10
            check (cardinality(correos_facturacion) <= 10);
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'clientes_correos_soporte_max_10'
    ) then
        alter table public.clientes
            add constraint clientes_correos_soporte_max_10
            check (cardinality(correos_soporte) <= 10);
    end if;
end $$;

comment on column public.clientes.correos_generales is
    'Hasta 10 correos generales o administrativos del cliente.';
comment on column public.clientes.correos_facturacion is
    'Hasta 10 correos para facturación y cobranza.';
comment on column public.clientes.correos_soporte is
    'Hasta 10 correos para notificaciones de soporte técnico.';
