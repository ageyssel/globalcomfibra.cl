# Cambios implementados

## Arquitectura y frontend

- Aplicación real migrada a Next.js App Router con TypeScript estricto.
- Separación de páginas públicas, autenticación, portal de clientes y administración.
- Componentes reutilizables para navegación, formularios, tablas, modales, estados y alertas.
- Sitio público conservado en contenido y propósito, con jerarquía, conversión, SEO, responsive y accesibilidad mejorados.
- Páginas de privacidad, términos, FAQ, recuperación de contraseña, errores y acceso denegado.
- Cabeceras de seguridad: CSP, anti-framing, nosniff, referrer policy y permissions policy.

## Administración

- Dashboard operacional con clientes, tickets, cuentas por cobrar, cuentas por pagar y actividad reciente.
- Gestión de clientes con búsqueda, filtros, paginación, exportación CSV, creación segura y edición.
- Soporte con filtros, conversación, adjuntos privados y control de estados.
- Vista de auditoría restringida.
- Navegación lateral responsive y permisos por rol.

## Portal financiero

- Proveedores con detección única por RUT.
- Facturas recibidas con folio, fechas, impuestos, total, categoría, centro de costo, cliente/servicio relacionado y documento privado.
- Restricción de duplicados por proveedor, tipo, folio y total.
- Flujo de aprobación y observación.
- Pagos totales o parciales, comprobantes, saldo automático y cambio de estado.
- Dashboard de pendiente, vencido, pagado del mes y próximos 30 días.
- Filtros y exportación CSV respetando la vista aplicada.

## Seguridad y datos

- Roles: superadmin, admin, finanzas, comercial, soporte, solo lectura y cliente.
- RLS en tablas nuevas y endurecimiento condicionado de tablas heredadas.
- Funciones Edge con validación JWT, rol, payload, CORS allowlist y códigos HTTP correctos.
- Buckets privados y enlaces firmados de cinco minutos.
- Exclusión explícita de `pass_noc` y `user_noc` de los permisos de lectura de clientes.
- Eliminación física bloqueada para clientes, facturas y tickets desde roles normales.
- Auditoría de cambios financieros, permisos, proveedores, leads y pagos.
- Rate limit y honeypot en formulario público.

## Calidad

- Build de producción corregido.
- TypeScript y ESLint sin errores ni advertencias.
- Siete pruebas automatizadas aprobadas.
- Smoke HTTP aprobado en siete rutas públicas.
- Dependencias de producción actualizadas; sin avisos altos o críticos en auditoría final.

## Finanzas y comunicaciones v2

- Recuperación de facturación de clientes con historial, carga masiva, estados de pago, referencia de pago, descarga y reenvío.
- Nueva central de comunicaciones con plantillas compartidas, variables por cliente, firma Globalcom, historial y copia oculta corporativa.
- Estado de cuenta consolidado por proveedor.
- Registro de pagos parciales o múltiples con código `PAG-AAAA-NNNNNN`, método, operación bancaria, referencia contable, comprobante y reversa auditada.
- Importación conciliable desde CSV/TSV exportado desde Excel o Registro de Compras.
- Preparación de lotes de importación, detección de duplicados y creación opcional de proveedores.

## Importación directa de historial DTE del SII

- Carga nativa del archivo `.xlsx` original descargado desde el SII.
- Lectura de bloques repetidos `TipoDTE` y consolidación de filas `DETALLE`.
- Vista previa obligatoria antes de insertar.
- Detección de duplicados contra el portal.
- Creación opcional de proveedores faltantes.
- Facturas tipo 30, 32, 33, 34, 45 y 46 generan cuentas por pagar.
- Notas de crédito tipo 60 y 61 se registran como documentos financieros separados.
- Las notas de crédito se asignan automáticamente a facturas abiertas del mismo proveedor, priorizando coincidencia exacta de saldo y cercanía de fecha.
- Todo crédito no asignado queda como saldo disponible y también reduce la deuda consolidada del proveedor.
- Las guías de despacho tipo 50 y 52 se excluyen de deuda.
- Las facturas sin vencimiento pueden quedar pendientes de revisión o usar una regla configurable de días.
- El saldo por factura muestra total, créditos aplicados, pagos y saldo restante.

## Marcación rápida de facturas de proveedores pagadas

- Botón `Marcar pagada` disponible en cada factura con saldo pendiente.
- Utiliza el saldo real después de notas de crédito y pagos parciales.
- Solicita confirmación antes de registrar el movimiento.
- Registra un pago completo con fecha del día y método `Marcación rápida`.
- Conserva código de pago, auditoría e historial.
- El movimiento puede reversarse desde `Historial de pagos`.
- Las facturas compensadas íntegramente con notas de crédito muestran el estado `Compensada con crédito`.

## Reportes de estados de pago en PDF y Excel

- Reportes disponibles en `Facturación de clientes` y `Cuentas por pagar`.
- Exportación en formato PDF y Excel `.xlsx`.
- Reporte general de todos los clientes o proveedores.
- Reporte individual por cliente o proveedor.
- Histórico completo o rango de fechas.
- Rango configurable por fecha de emisión, vencimiento o pago.
- Filtro adicional por estado del documento.
- Totales de documentos, facturado, notas de crédito, pagado y saldo.
- Detalle de folio, fechas, método, referencia y descripción.
- En proveedores incluye las notas de crédito como movimientos propios y los créditos aplicados por factura.
- Los archivos se generan en el navegador respetando los permisos y datos visibles del usuario autenticado.
