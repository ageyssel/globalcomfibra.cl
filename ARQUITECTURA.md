# Arquitectura

## Capas

1. **Next.js App Router**: renderizado público, autenticación, layouts y paneles.
2. **Supabase Auth**: identidad y sesiones.
3. **PostgreSQL + RLS**: autorización por registro, integridad y lógica financiera transaccional.
4. **Supabase Storage**: documentos privados con políticas y enlaces temporales.
5. **Edge Functions**: operaciones privilegiadas, correo, alta de clientes, tickets y firma de documentos.
6. **Cloudflare/OpenNext**: despliegue del frontend y runtime Next.js.

## Rutas principales

- `/`: sitio público y formulario de factibilidad.
- `/login`: acceso único.
- `/portal`: clientes.
- `/admin`: dashboard interno.
- `/admin/clientes`: clientes.
- `/admin/soporte`: tickets.
- `/admin/finanzas`: cuentas por pagar.
- `/admin/auditoria`: trazabilidad.

## Modelo de autorización

- La interfaz oculta acciones según rol, pero la seguridad real se aplica en RLS, RPC y Edge Functions.
- `app_users` vincula `auth.users` con el rol operacional.
- Las operaciones financieras sensibles se ejecutan mediante funciones PostgreSQL transaccionales.
- El service role solo se usa dentro de Edge Functions después de validar identidad/propiedad.

## Datos financieros

Tablas principales:

- `suppliers`
- `supplier_invoices`
- `payments`
- `payment_allocations`
- `approval_history`
- `expense_categories`
- `cost_centers`
- `audit_logs`

La vista `supplier_invoice_summary` calcula pagado, saldo y estado efectivo. Los montos usan `numeric(18,2)`.

## Compatibilidad heredada

Las tablas `clientes`, `facturas`, `tickets` y `registro_accesos` se mantienen. La migración aplica cambios solo cuando existen, evita borrados automáticos y agrega seguridad sin reemplazar datos. El código heredado no se publica ni se incluye en el paquete optimizado; la compatibilidad se mantiene a nivel de tablas y datos.
