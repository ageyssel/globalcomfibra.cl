# Evidencia de pruebas

Fecha: 8 de julio de 2026

## Resultado

| Prueba | Resultado |
|---|---|
| `npm run lint` | Aprobada, 0 errores y 0 advertencias |
| `npm run typecheck` | Aprobada |
| `npm test` | 7/7 aprobadas |
| `npm run build` | Compilación de producción aprobada |
| Smoke HTTP | 7/7 rutas aprobadas |
| `npm audit --omit=dev` | 0 críticas, 0 altas, 2 moderadas |

## Rutas verificadas

- `/`
- `/faq`
- `/login`
- `/privacidad`
- `/terminos`
- `/robots.txt`
- `/sitemap.xml`

## Pruebas automatizadas

- Normalización de RUT.
- Sanitización de texto.
- Manejo de fechas inválidas.
- Contraseña robusta para alta de cliente.
- Contrato de lead comercial.
- Presencia de RLS, buckets privados y bloqueo de credenciales NOC.
- Verificación de identidad en todas las funciones privilegiadas.

## Limitaciones de la evidencia

No se ejecutaron migraciones ni E2E autenticados contra la base remota porque no se entregó acceso a Supabase de producción/staging. Estos flujos deben ejecutarse en staging antes del despliegue, siguiendo `PLAN_DESPLIEGUE_PRODUCCION.md`.
