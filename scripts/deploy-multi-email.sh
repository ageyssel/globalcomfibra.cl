#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-eejsdoeuovcrjicrgxmo}"
SUPABASE=(npx --yes supabase@latest)
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
"${SUPABASE[@]}" --version

echo
echo "Verificando sesión de Supabase..."
if ! "${SUPABASE[@]}" projects list >/dev/null 2>&1; then
  echo "No existe una sesión activa. Se abrirá el inicio de sesión de Supabase."
  "${SUPABASE[@]}" login
fi

echo
echo "Vinculando el repositorio al proyecto remoto..."
"${SUPABASE[@]}" link --project-ref "${PROJECT_REF}"

echo
echo "Aplicando migración de base de datos..."
"${SUPABASE[@]}" db push

echo
echo "Desplegando funciones Edge..."
for function_name in "${FUNCTIONS[@]}"; do
  echo "- ${function_name}"
  "${SUPABASE[@]}" functions deploy "${function_name}" --project-ref "${PROJECT_REF}"
done

echo
echo "Despliegue multi-email completado."
echo "No se modificó la rama main ni se ejecutó el deploy del sitio web."
