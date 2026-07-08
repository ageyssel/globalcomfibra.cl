# Manual resumido de uso

## Acceso

Todos ingresan por `/login`. El sistema consulta `app_users` y dirige al usuario a `/admin` o `/portal` según el rol.

## Dashboard administrativo

Muestra clientes activos, tickets abiertos, cuentas por cobrar, cuentas por pagar, alertas y actividad reciente. Cada indicador abre su módulo.

## Clientes

- Buscar por empresa, RUT, correo o ID.
- Filtrar por estado y plan.
- Crear cliente con acceso al portal mediante la función segura `create-client`.
- Editar información sin eliminar físicamente el registro.
- Exportar la vista filtrada a CSV.

## Soporte

- Abrir un ticket para ver descripción, conversación y estado.
- Responder con texto y adjunto.
- Cambiar entre Nuevo, Asignado, En análisis, En terreno, Esperando cliente/proveedor, Resuelto, Cerrado y Reabierto.
- Los documentos se almacenan de forma privada.

## Finanzas

1. Registrar proveedor; el RUT no puede repetirse.
2. Registrar factura con fechas, montos, categoría, centro de costo y documento.
3. El sistema advierte duplicados exactos.
4. Aprobar la factura para dejarla pendiente de pago.
5. Registrar pago total o parcial con comprobante.
6. Revisar saldo, vencimiento y estado automático.
7. Exportar la tabla filtrada a CSV.

## Auditoría

Disponible para superadministrador y administrador. Permite revisar usuario, acción, módulo, registro, fecha e IP cuando exista.

## Portal de clientes

El cliente ve únicamente información asociada a su correo:

- Servicios y estado.
- Facturas y documentos propios.
- Tickets y seguimiento.
- Creación de nueva solicitud con adjunto.

Las credenciales NOC históricas no se exponen en el portal.
