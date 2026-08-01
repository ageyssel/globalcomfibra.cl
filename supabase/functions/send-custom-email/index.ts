import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EMAIL_API_KEY = Deno.env.get('RESEND_API_KEY')
const MAX_EMAILS = 30
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

function parseEmails(value: unknown): string[] {
  const source = Array.isArray(value) ? value : String(value ?? '').split(/[;,\n\s]+/)
  const cleaned = source.map(item => String(item ?? '').trim().toLowerCase()).filter(Boolean)
  const invalid = cleaned.filter(email => !EMAIL_RE.test(email))
  if (invalid.length) throw new Error(`Correo(s) inválido(s): ${invalid.join(', ')}`)

  const unique = [...new Set(cleaned)]
  if (!unique.length) throw new Error('Debes indicar al menos un destinatario.')
  if (unique.length > MAX_EMAILS) throw new Error(`Máximo ${MAX_EMAILS} destinatarios por envío.`)
  return unique
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!EMAIL_API_KEY) throw new Error('RESEND_API_KEY no está configurada.')

    const { to, subject, htmlBody, deptoNombre } = await req.json()
    const destinatarios = parseEmails(to)

    if (!String(subject ?? '').trim()) throw new Error('El asunto es obligatorio.')
    if (!String(htmlBody ?? '').trim()) throw new Error('El contenido del correo es obligatorio.')

    const emails = destinatarios.map(destinatario => ({
      from: `Globalcom | ${deptoNombre || 'Comunicaciones'} <contacto@globalcomfibra.cl>`,
      to: [destinatario],
      bcc: destinatario === 'contacto@globalcomfibra.cl' ? [] : ['contacto@globalcomfibra.cl'],
      reply_to: 'contacto@globalcomfibra.cl',
      subject: String(subject).trim(),
      html: htmlBody,
      headers: { 'Disposition-Notification-To': 'contacto@globalcomfibra.cl' }
    }))

    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EMAIL_API_KEY}`
      },
      body: JSON.stringify(emails)
    })

    if (!res.ok) throw new Error(`Error enviando correos: ${await res.text()}`)

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
