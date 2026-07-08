# Matriz de roles y permisos

| Módulo / acción | Superadmin | Admin | Finanzas | Comercial | Soporte | Solo lectura | Cliente |
|---|---:|---:|---:|---:|---:|---:|---:|
| Dashboard interno | Sí | Sí | Sí | Sí | Sí | Sí | No |
| Ver clientes | Sí | Sí | Sí | Sí | Sí | Sí | Solo propios |
| Crear/editar clientes | Sí | Sí | No | Sí | No | No | No |
| Eliminar clientes | No directo | No | No | No | No | No | No |
| Ver tickets | Sí | Sí | No | No | Sí | Sí | Solo propios |
| Responder/cambiar ticket | Sí | Sí | No | No | Sí | No | Responder propios |
| Proveedores y facturas recibidas | Sí | Sí | Sí | No | No | Lectura autorizada | No |
| Aprobar facturas | Sí | Sí | Sí | No | No | No | No |
| Registrar pagos | Sí | Sí | Sí | No | No | No | No |
| Ver auditoría | Sí | Sí | No | No | No | No | No |
| Gestionar roles | Sí | No | No | No | No | No | No |
| Descargar documentos | Todos autorizados por módulo | Según módulo | Según módulo | Según módulo | Según módulo | Lectura | Solo propios |

Las políticas se aplican en base de datos y servidor; no dependen de la visibilidad de botones.
