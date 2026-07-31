import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EMAIL_API_KEY = Deno.env.get('RESEND_API_KEY')
const MAX_EMAILS = 10
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

function parseEmails(value: unknown, fallback = ''): string[] {
  const source = Array.isArray(value) ? value : String(value ?? '').split(/[;,\n\s]+/)
  const cleaned = source.map(item => String(item ?? '').trim().toLowerCase()).filter(Boolean)
  const invalid = cleaned.filter(email => !EMAIL_RE.test(email))
  if (invalid.length) throw new Error(`Correo(s) inválido(s): ${invalid.join(', ')}`)

  const unique = [...new Set(cleaned)]
  if (unique.length > MAX_EMAILS) throw new Error(`Máximo ${MAX_EMAILS} destinatarios de soporte.`)
  if (!unique.length && EMAIL_RE.test(fallback)) unique.push(fallback.toLowerCase())
  if (!unique.length) throw new Error('El cliente no tiene correos de soporte válidos.')
  return unique
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!EMAIL_API_KEY) throw new Error('RESEND_API_KEY no está configurada.')

    const { idTicket, emailCliente, empresa, asunto, mensaje, nuevoEstado, autor, tipo } = await req.json()
    const portalEmail = String(emailCliente ?? '').trim().toLowerCase()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from('clientes')
      .select('email, correos_soporte')
      .eq('email', portalEmail)
      .maybeSingle()

    if (clienteError) throw clienteError

    const destinatarios = parseEmails(cliente?.correos_soporte, portalEmail)

    let subject = ''
    let htmlContent = ''

    if (tipo === 'creacion') {
      subject = `[Ticket] Nuevo requerimiento de Soporte - ${asunto}`
      htmlContent = `
        <h2>Nuevo ticket de Soporte</h2>
        <p><strong>Cliente:</strong> ${empresa || portalEmail}</p>
        <p><strong>Asunto:</strong> ${asunto}</p>
        <p><strong>Descripción:</strong><br>${mensaje}</p>
        <hr>
        <p style="font-size:11px;color:#666;">Este es un correo automático de Globalcom.</p>`
    } else if (tipo === 'respuesta') {
      subject = `[Ticket #${idTicket}] Nueva respuesta de ${autor}`
      htmlContent = `
        <h2>Actualización en su ticket de Soporte</h2>
        <p><strong>Asunto original:</strong> ${asunto}</p>
        <p><strong>Respuesta de ${autor}:</strong><br>${mensaje}</p>
        <hr>
        <p style="font-size:11px;color:#666;">Revise su panel privado para responder.</p>`
    } else if (tipo === 'estado') {
      subject = `[Ticket #${idTicket}] Cambio de Estado: ${nuevoEstado}`
      htmlContent = `
        <h2>Actualización de Estado de Ticket</h2>
        <p>El ticket <strong>${asunto}</strong> ha sido marcado como: <strong style="color:blue;">${nuevoEstado}</strong> por ${autor}.</p>
        <hr>
        <p style="font-size:11px;color:#666;">Plataforma de Soporte Técnico Globalcom.</p>`
    } else {
      throw new Error('Tipo de notificación de ticket no reconocido.')
    }

    const payload = destinatarios.map(destinatario => ({
      from: 'Soporte Globalcom <soporte@globalcomfibra.cl>',
      to: [destinatario],
      bcc: destinatario === 'contacto@globalcomfibra.cl' ? [] : ['contacto@globalcomfibra.cl'],
      reply_to: 'soporte@globalcomfibra.cl',
      subject,
      html: htmlContent
    }))

    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EMAIL_API_KEY}`
      },
      body: JSON.stringify(payload)
    })

    if (!res.ok) throw new Error(`Error del servidor de correos: ${await res.text()}`)

    return new Response(JSON.stringify({
      success: true,
      enviados: destinatarios.length,
      destinatarios
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
