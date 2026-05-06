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

    // Soporte inteligente: Convierte todo en un Array
    const destinatarios = Array.isArray(to) ? to : [to];

    // Crea un paquete de correos INDIVIDUALES para evitar el "Spam Look"
    const emails = destinatarios.map(dest => ({
        from: `Globalcom | ${deptoNombre} <contacto@globalcomfibra.cl>`,
        to: [dest],
        bcc: ['contacto@globalcomfibra.cl'], // Tu respaldo
        reply_to: 'contacto@globalcomfibra.cl',
        subject: subject,
        html: htmlBody,
        headers: { "Disposition-Notification-To": "contacto@globalcomfibra.cl" }
    }));

    // Envía usando la Batch API de Resend (hasta 100 por segundo)
    for (let i = 0; i < emails.length; i += 100) {
        const batch = emails.slice(i, i + 100);
        const res = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${EMAIL_API_KEY}`
          },
          body: JSON.stringify(batch)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Error enviando lote masivo: ${errText}`);
        }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
