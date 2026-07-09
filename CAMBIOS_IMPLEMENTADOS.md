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
