# Migración de documentos históricos públicos

Los registros heredados pueden contener URLs públicas en `url_archivo` o `url_contrato`. La migración principal vuelve privados los buckets nuevos, pero no descarga ni mueve automáticamente archivos históricos porque hacerlo sin inventario podría perder referencias.

## Procedimiento recomendado

1. Exportar inventario de `facturas`, `clientes`, `tickets` y Storage.
2. Identificar cada URL pública y su propietario.
3. Descargar el archivo desde un entorno seguro.
4. Subirlo al bucket privado correspondiente:
   - `customer-invoices`
   - `contracts`
   - `ticket-attachments`
5. Actualizar el registro con el `storage_path` privado.
6. Verificar descarga mediante `document-sign`.
7. Revocar acceso público al bucket anterior.
8. Conservar bitácora de hash, origen, destino, usuario y fecha.

No elimines el archivo anterior hasta comprobar que el nuevo documento abre desde el portal correcto.
