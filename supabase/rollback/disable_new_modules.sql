-- Rollback operativo no destructivo.
-- Conserva todos los datos y deshabilita escrituras de los módulos nuevos.
-- No restaura políticas heredadas: use el inventario guardado por scripts/supabase-preflight.sql.

begin;
revoke execute on function public.approve_supplier_invoice(uuid,text,text) from authenticated;
revoke execute on function public.register_supplier_payment(uuid,date,numeric,text,text,text,text,text,text) from authenticated;
revoke insert, update, delete on public.suppliers, public.supplier_invoices, public.commercial_leads from authenticated;
revoke insert, update, delete on public.payments, public.payment_allocations, public.approval_history from authenticated;
update public.app_users set active=false where role in ('finance','commercial','support','readonly') and lower(email) <> 'contacto@globalcomfibra.cl';
commit;

-- Para reactivar, vuelva a aplicar la migración principal y reactive usuarios tras revisión.
