begin;

-- Las columnas multi-email fueron creadas después del grant por columnas del
-- esquema legado, por lo que authenticated no heredó permisos sobre ellas.
grant select (
  correos_generales,
  correos_facturacion,
  correos_soporte
) on public.clientes to authenticated;

grant insert (
  correos_generales,
  correos_facturacion,
  correos_soporte
) on public.clientes to authenticated;

grant update (
  correos_generales,
  correos_facturacion,
  correos_soporte
) on public.clientes to authenticated;

-- Totales financieros agregados en base de datos. Evita descargar cientos o
-- miles de registros al navegador y elimina el límite de 1.000 filas de la API.
create or replace function public.admin_finance_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clients jsonb;
  v_suppliers jsonb;
begin
  if not public.has_role(
    array['superadmin','admin','finance','readonly']::public.app_role[]
  ) then
    raise exception 'Acceso denegado al dashboard financiero';
  end if;

  select jsonb_build_object(
    'invoice_count', count(*),
    'total_invoiced', coalesce(sum(coalesce(valor_total,0)),0),
    'total_paid', coalesce(sum(
      case
        when lower(trim(coalesce(estado,''))) in ('pagada','pagado','paid')
          then coalesce(valor_total,0)
        else 0
      end
    ),0),
    'balance_due', coalesce(sum(
      case
        when lower(trim(coalesce(estado,''))) not in ('pagada','pagado','paid')
          then coalesce(valor_total,0)
        else 0
      end
    ),0),
    'overdue_balance', coalesce(sum(
      case
        when lower(trim(coalesce(estado,''))) not in ('pagada','pagado','paid')
          and (
            lower(trim(coalesce(estado,''))) in ('vencida','vencido','overdue')
            or coalesce(fecha_vencimiento, fecha_emision + 30) < current_date
          )
          then coalesce(valor_total,0)
        else 0
      end
    ),0),
    'current_month_invoiced', coalesce(sum(
      case
        when date_trunc('month',coalesce(fecha_emision,created_at::date)) = date_trunc('month',current_date)
          then coalesce(valor_total,0)
        else 0
      end
    ),0)
  )
  into v_clients
  from public.facturas
  where deleted_at is null;

  select jsonb_build_object(
    'invoice_count', count(*),
    'total_invoiced', coalesce(sum(coalesce(total_amount,0)),0),
    'total_paid', coalesce(sum(coalesce(paid_amount,0)),0),
    'balance_due', coalesce(sum(coalesce(balance_due,0)),0),
    'overdue_balance', coalesce(sum(
      case
        when status = 'overdue' or (coalesce(balance_due,0) > 0 and due_date < current_date)
          then coalesce(balance_due,0)
        else 0
      end
    ),0),
    'current_month_invoiced', coalesce(sum(
      case
        when date_trunc('month',issue_date) = date_trunc('month',current_date)
          then coalesce(total_amount,0)
        else 0
      end
    ),0)
  )
  into v_suppliers
  from public.supplier_invoice_summary;

  return jsonb_build_object(
    'clients', coalesce(v_clients,'{}'::jsonb),
    'suppliers', coalesce(v_suppliers,'{}'::jsonb),
    'generated_at', now()
  );
end;
$$;

grant execute on function public.admin_finance_dashboard() to authenticated;

commit;
