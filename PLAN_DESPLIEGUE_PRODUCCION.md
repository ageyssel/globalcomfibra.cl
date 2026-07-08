# Plan de despliegue seguro

## 1. Preparación

- Congelar cambios funcionales durante la ventana.
- Crear respaldo verificable de PostgreSQL y Storage.
- Rotar secretos expuestos históricamente.
- Crear proyecto/branch de staging con copia anonimizada.
- Ejecutar `scripts/supabase-preflight.sql`.

## 2. Staging

1. Aplicar migración y seed.
2. Desplegar funciones Edge y secretos.
3. Crear usuarios de prueba para cada rol.
4. Validar RLS intentando accesos permitidos y denegados.
5. Probar: login, clientes, ticket, adjunto, proveedor, duplicado, aprobación, pago parcial, pago total y descarga privada.
6. Migrar una muestra de documentos públicos a buckets privados.
7. Ejecutar build, pruebas y smoke contra staging.

## 3. Producción

1. Activar modo de mantenimiento o limitar escrituras.
2. Realizar respaldo final.
3. Aplicar migración.
4. Desplegar funciones.
5. Desplegar frontend Cloudflare.
6. Ejecutar smoke y flujos críticos con cuentas controladas.
7. Confirmar logs, correos y auditoría.
8. Reactivar operación.

## 4. Reversión

- Revertir frontend a la versión anterior de Cloudflare.
- Desactivar funciones nuevas si existe un fallo crítico.
- No ejecutar `DROP` sobre tablas financieras. La migración es aditiva.
- Restaurar base solo si existe corrupción confirmada; preferir correcciones hacia adelante.

## 5. Validación posterior

- Monitorear errores 4xx/5xx, Auth, Storage y Edge Functions por 48 horas.
- Revisar duplicados, documentos faltantes y saldos.
- Confirmar que ningún usuario normal puede consultar `pass_noc` o `user_noc`.
- Completar migración de documentos históricos públicos.
