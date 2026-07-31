import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_EMAILS = 10
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

function parseEmails(value: unknown): string[] {
  const source = Array.isArray(value) ? value : String(value ?? '').split(/[;,\n\s]+/)
  const cleaned = source.map(item => String(item ?? '').trim().toLowerCase()).filter(Boolean)
  const invalid = cleaned.filter(email => !EMAIL_RE.test(email))
  if (invalid.length) throw new Error(`Correo(s) inválido(s): ${invalid.join(', ')}`)

  const unique = [...new Set(cleaned)]
  if (unique.length > MAX_EMAILS) throw new Error(`Máximo ${MAX_EMAILS} correos por categoría.`)
  return unique
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { email, password, clientData = {} } = await req.json()
    const portalEmail = String(email ?? '').trim().toLowerCase()

    if (!EMAIL_RE.test(portalEmail)) throw new Error('El Email Portal no es válido.')
    if (!password || password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.')

    const correosGenerales = parseEmails(clientData.correos_generales)
    const correosFacturacion = parseEmails(
      clientData.correos_facturacion ?? clientData.correo_facturacion
    )
    const correosSoporte = parseEmails(clientData.correos_soporte)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: portalEmail,
      password,
      email_confirm: true
    })

    if (authError && !authError.message.toLowerCase().includes('already')) {
      throw new Error(`Error de cuenta: ${authError.message}`)
    }

    const { error: dbError } = await supabaseAdmin.from('clientes').insert({
      email: portalEmail,
      ...clientData,
      correo_facturacion: correosFacturacion[0] || portalEmail,
      correos_generales: correosGenerales,
      correos_facturacion: correosFacturacion,
      correos_soporte: correosSoporte
    })

    if (dbError) throw new Error(`Error de base de datos: ${dbError.message}`)

    return new Response(JSON.stringify({
      success: true,
      destinatarios: {
        generales: correosGenerales.length,
        facturacion: correosFacturacion.length,
        soporte: correosSoporte.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: errorMessage(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})
