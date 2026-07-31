#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-eejsdoeuovcrjicrgxmo}"
FUNCTIONS=(
  create-client
  process-invoice
  send-invoice-notification
  send-custom-email
  send-collection-email
  notify-ticket-update
)

echo "Proyecto Supabase: ${PROJECT_REF}"
echo "Verificando Supabase CLI..."
npx --yes supabase@latest --version

echo
echo "Vinculando el repositorio al proyecto remoto..."
npx --yes supabase@latest link --project-ref "${PROJECT_REF}"

echo
echo "Aplicando migración de base de datos..."
npx --yes supabase@latest db push

echo
echo "Desplegando funciones Edge..."
for function_name in "${FUNCTIONS[@]}"; do
  echo "- ${function_name}"
  npx --yes supabase@latest functions deploy "${function_name}" --project-ref "${PROJECT_REF}"
done

echo
echo "Despliegue multi-email completado."
echo "No se modificó la rama main ni se ejecutó el deploy del sitio web."
