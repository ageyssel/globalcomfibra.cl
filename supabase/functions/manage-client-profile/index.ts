/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i
const MAX_EMAILS = 10

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function normalizeEmails(value: unknown, fallback = ''): string[] {
  const source = Array.isArray(value) ? value : String(value ?? '').split(/[;,\n\s]+/)
  const cleaned = source
    .map(item => String(item ?? '').trim().toLowerCase())
    .filter(Boolean)

  const invalid = cleaned.filter(email => !EMAIL_RE.test(email))
  if (invalid.length) throw new Error(`Correo(s) inválido(s): ${invalid.join(', ')}`)

  const unique = [...new Set(cleaned)]
  if (!unique.length && fallback && EMAIL_RE.test(fallback)) unique.push(fallback.toLowerCase())
  if (unique.length > MAX_EMAILS) {
    throw new Error(`Máximo ${MAX_EMAILS} correos por categoría.`)
  }
  return unique
}

function cleanText(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text || null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) throw new Error('Sesión no válida.')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !userData.user) throw new Error('No fue posible validar la sesión.')

    const { data: appUser, error: roleError } = await supabaseAdmin
      .from('app_users')
      .select('role,active')
      .eq('user_id', userData.user.id)
      .single()

    if (roleError || !appUser?.active) throw new Error('Usuario administrativo no habilitado.')

    const role = String(appUser.role || '')
    const canRead = ['superadmin', 'admin', 'commercial', 'support', 'finance', 'readonly'].includes(role)
    const canWrite = ['superadmin', 'admin', 'commercial'].includes(role)
    if (!canRead) throw new Error('Acceso denegado a la ficha del cliente.')

    const body = await req.json()
    const action = String(body?.action || 'get')
    const rut = cleanText(body?.rut || body?.rutOriginal)
    if (!rut) throw new Error('RUT del cliente no informado.')

    if (action === 'get') {
      const { data: cliente, error } = await supabaseAdmin
        .from('clientes')
        .select('*')
        .eq('rut', rut)
        .is('deleted_at', null)
        .single()

      if (error || !cliente) throw new Error(error?.message || 'Cliente no encontrado.')

      return new Response(JSON.stringify({ success: true, cliente }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action !== 'update') throw new Error('Acción no soportada.')
    if (!canWrite) throw new Error('No tienes permisos para editar clientes.')

    const input = body?.clientData || {}
    const portalEmail = String(input.email || body?.portalEmail || '').trim().toLowerCase()
    const facturacion = normalizeEmails(input.correos_facturacion, portalEmail)
    const generales = normalizeEmails(input.correos_generales, portalEmail)
    const soporte = normalizeEmails(input.correos_soporte, portalEmail)

    const updateData: Record<string, unknown> = {
      empresa: cleanText(input.empresa),
      rut: cleanText(input.rut),
      contacto: cleanText(input.contacto),
      contacto_facturacion: cleanText(input.contacto_facturacion),
      correo_facturacion: facturacion[0] || portalEmail || null,
      correos_generales: generales,
      correos_facturacion: facturacion,
      correos_soporte: soporte,
      fecha_inicio: cleanText(input.fecha_inicio),
      direccion: cleanText(input.direccion),
      dias_pago: Number(input.dias_pago) || 30,
      contrato_meses: Number(input.contrato_meses) || 12,
      ip: cleanText(input.ip),
      plan: cleanText(input.plan),
      url_dashboard: cleanText(input.url_dashboard),
      user_noc: cleanText(input.user_noc),
      pass_noc: cleanText(input.pass_noc),
      estado: cleanText(input.estado) || 'Activo',
      id_cliente: cleanText(input.id_cliente)
    }

    if (input.url_contrato !== undefined) {
      updateData.url_contrato = cleanText(input.url_contrato)
    }

    const { data: cliente, error } = await supabaseAdmin
      .from('clientes')
      .update(updateData)
      .eq('rut', rut)
      .select('*')
      .single()

    if (error || !cliente) throw new Error(error?.message || 'No fue posible actualizar el cliente.')

    return new Response(JSON.stringify({ success: true, cliente }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: errorMessage(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})
