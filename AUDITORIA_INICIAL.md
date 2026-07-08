# Auditoría inicial — Globalcom Fibra

Fecha: 8 de julio de 2026

## Resumen ejecutivo

El proyecto recibido combinaba un `package.json` de Next.js con una aplicación real basada en archivos HTML monolíticos y JavaScript embebido. El comando de producción no podía compilar porque no existía un directorio `app/` ni `pages/`. La operación administrativa dependía principalmente del navegador, con controles de autorización insuficientes y documentos sensibles publicados mediante URLs públicas.

## Hallazgos críticos

1. **Build de producción roto.** `npm run build` fallaba al no existir una aplicación Next.js válida.
2. **Autorización administrativa en cliente.** El acceso administrativo dependía de comparar el correo con una dirección escrita en JavaScript; ocultar interfaz no protege datos ni operaciones.
3. **Funciones Edge privilegiadas sin autorización robusta.** Varias funciones usaban `SUPABASE_SERVICE_ROLE_KEY`, CORS abierto y aceptaban instrucciones del navegador sin validar identidad y rol.
4. **Documentos sensibles públicos.** Facturas, contratos y adjuntos se obtenían con `getPublicUrl`, permitiendo acceso a cualquiera que conociera el enlace.
5. **Credenciales NOC almacenadas en texto plano.** Las columnas `user_noc` y `pass_noc` se consultaban y mostraban desde el portal.
6. **Ausencia de migraciones y esquema versionado.** No era posible reproducir ni auditar RLS, índices, restricciones o cambios de base de datos.
7. **Secretos y metadatos dentro del ZIP.** La entrega incluía `.env.local`, `.git`, `.DS_Store` y datos temporales de Supabase.

## Hallazgos altos

- Uso extendido de `innerHTML` con datos provenientes de base de datos, con riesgo de XSS almacenado.
- Eliminación física de facturas desde una acción simple, sin trazabilidad ni recuperación.
- Formularios y operaciones sin protección consistente ante duplicados o doble envío.
- Carga de archivos sin política privada uniforme ni validación central de propiedad.
- Errores de funciones devueltos con HTTP 200, dificultando monitoreo y reintentos correctos.
- Sin RBAC centralizado, auditoría inmutable ni separación real entre finanzas, soporte y comercial.
- Consultas con `select('*')`, cargas completas y filtrado en el navegador, sin paginación confiable.

## Hallazgos medios

- Componentes administrativos monolíticos y duplicación de lógica.
- Estados, textos, plantillas y reglas escritos directamente en HTML o `localStorage`.
- Falta de estados vacíos, skeletons, feedback uniforme y manejo consistente de errores.
- SEO técnico incompleto y estructura de metadatos no centralizada.
- Dependencias con avisos de seguridad y sin proceso de actualización documentado.
- Sin pruebas automatizadas ni evidencia reproducible de los flujos críticos.

## Hallazgos bajos

- Archivos de sistema y configuración de editor dentro del repositorio.
- Convenciones de nombres y estados inconsistentes entre portal y administración.
- Accesibilidad parcial en formularios, modales y navegación.
- Ausencia de bitácora consolidada de cambios y manual operativo.

## Riesgos que requieren intervención de producción

- Rotar `RESEND_API_KEY` y cualquier secreto que haya estado en `.env.local` o en el historial Git.
- Revisar manualmente políticas RLS existentes antes de aplicar la migración.
- Migrar documentos históricos desde buckets públicos hacia los buckets privados nuevos.
- Mover las credenciales NOC a un gestor de secretos o sistema externo y luego eliminar las columnas históricas mediante una migración separada, tras validar que ningún proceso las usa.
- Confirmar el esquema real de tablas heredadas en staging antes de producción.

## Dependencias

La entrega actual utiliza versiones actualizadas disponibles durante la intervención. `npm audit --omit=dev` mantiene dos avisos moderados asociados a Next.js/PostCSS sin una corrección estable compatible indicada por npm al momento de la prueba. No hay avisos altos ni críticos en dependencias de producción después de la actualización.
