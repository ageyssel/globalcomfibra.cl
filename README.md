# Globalcom Fibra — plataforma web y operacional

Reestructuración segura del sitio público, portal administrativo, portal de clientes y módulo financiero de cuentas por pagar.

## Estado de esta entrega

- Sitio público reconstruido con Next.js App Router y diseño responsive.
- Acceso único para clientes y equipo interno, con redirección según rol.
- Administración de clientes, soporte, auditoría y dashboard operacional.
- Portal financiero con proveedores, facturas recibidas, duplicados, aprobaciones, pagos parciales, saldos, vencimientos y exportación CSV.
- Portal de clientes con servicios, facturas y creación de tickets.
- Migración Supabase versionada con RLS, permisos, auditoría y buckets privados.
- Funciones Edge protegidas por JWT y rol; solo el formulario comercial es público y tiene honeypot y rate limit.
- Build, lint, TypeScript, pruebas unitarias/contratos y smoke HTTP aprobados localmente.

> Antes de producción, aplica la migración en un proyecto Supabase de staging y ejecuta la validación con una copia anonimizada de los datos reales. Esta entrega no tuvo acceso a la base de datos remota.

## Requisitos

- Node.js 22 o superior.
- npm 10 o superior.
- Supabase CLI.
- Proyecto Supabase y cuenta Cloudflare configurados.

## Instalación

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Completa `.env.local` sin guardar secretos en Git. Para las funciones Edge, configura los secretos con Supabase CLI:

```bash
supabase secrets set \
  SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
  RESEND_API_KEY=<RESEND_API_KEY>
  ALLOWED_ORIGINS="https://globalcomfibra.cl,https://www.globalcomfibra.cl" \
  MAIL_FROM="Globalcom Fibra <contacto@globalcomfibra.cl>" \
  LEADS_NOTIFICATION_EMAIL="contacto@globalcomfibra.cl" \
  SUPPORT_NOTIFICATION_EMAIL="contacto@globalcomfibra.cl"
```

## Base de datos

1. Crea un respaldo de producción.
2. Ejecuta `scripts/supabase-preflight.sql` en el SQL Editor y guarda el resultado.
3. Prueba la migración en staging:

```bash
supabase link --project-ref TU_PROJECT_REF_STAGING
supabase db push --dry-run
supabase db push
supabase db seed
```

4. Verifica roles, RLS, clientes, facturas, tickets y documentos.
5. Repite en producción dentro de una ventana controlada.

Migración principal:

```text
supabase/migrations/20260708090000_platform_core_and_finance.sql
```

## Funciones Edge

```bash
supabase functions deploy submit-lead --no-verify-jwt
supabase functions deploy create-client
supabase functions deploy process-invoice
supabase functions deploy ticket-create
supabase functions deploy ticket-message
supabase functions deploy ticket-status
supabase functions deploy approve-supplier-invoice
supabase functions deploy register-payment
supabase functions deploy document-sign
supabase functions deploy send-custom-email
supabase functions deploy send-collection-email
supabase functions deploy send-invoice-notification
supabase functions deploy notify-ticket
supabase functions deploy notify-ticket-update
supabase functions deploy notify-ticket-resolved
```

## Comandos de calidad

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm start
npm run test:e2e
npm run security:audit
```

El smoke test espera la aplicación en `http://127.0.0.1:3000`. Para otra URL:

```bash
BASE_URL=https://staging.globalcomfibra.cl npm run test:e2e
```

## Despliegue en Cloudflare

Configura las variables públicas en Cloudflare y luego:

```bash
npm run preview
npm run deploy
```

Variables públicas necesarias:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL
```

Los secretos de Supabase Edge Functions no deben cargarse en Cloudflare ni en variables `NEXT_PUBLIC_*`.

## Documentación incluida

- `AUDITORIA_INICIAL.md`
- `CAMBIOS_IMPLEMENTADOS.md`
- `ARQUITECTURA.md`
- `MATRIZ_ROLES_PERMISOS.md`
- `PLAN_DESPLIEGUE_PRODUCCION.md`
- `EVIDENCIA_PRUEBAS.md`
- `MIGRACION_DOCUMENTOS_PUBLICOS.md`

El código heredado inseguro no se incluye en el paquete optimizado; el ZIP original del usuario permanece como respaldo independiente.
