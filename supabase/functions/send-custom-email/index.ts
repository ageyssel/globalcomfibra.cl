import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EMAIL_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { to, subject, htmlBody, deptoNombre } = await req.json()

    // Soporte inteligente para 1 o múltiples destinatarios simultáneos
    const destinatarios = Array.isArray(to) ? to : [to];

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EMAIL_API_KEY}`
      },
      body: JSON.stringify({
        from: `Globalcom | ${deptoNombre} <contacto@globalcomfibra.cl>`,
        to: destinatarios,
        bcc: ['contacto@globalcomfibra.cl'],
        reply_to: 'contacto@globalcomfibra.cl',
        subject: subject,
        html: htmlBody,
        headers: {
          "Disposition-Notification-To": "contacto@globalcomfibra.cl"
        }
      })
    })

    if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Error enviando correo custom: ${errText}`)
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
