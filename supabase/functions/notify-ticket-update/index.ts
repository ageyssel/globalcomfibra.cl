import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Asegúrate de tener configurada tu API Key de envío de correos (Resend, SendGrid, etc.) en Supabase
const EMAIL_API_KEY = Deno.env.get('RESEND_API_KEY') // Cambia a tu proveedor si es necesario

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { idTicket, emailCliente, empresa, asunto, mensaje, nuevoEstado, autor, tipo } = await req.json()

    let subject = ""
    let htmlContent = ""

    // 1. TICKET NUEVO CREADO POR EL CLIENTE
    if (tipo === 'creacion') {
        subject = `[Ticket] Nuevo requerimiento de Soporte - ${asunto}`
        htmlContent = `
            <h2>Nuevo ticket de Soporte</h2>
            <p><strong>Cliente:</strong> ${empresa || emailCliente}</p>
            <p><strong>Asunto:</strong> ${asunto}</p>
            <p><strong>Descripción:</strong><br>${mensaje}</p>
            <hr>
            <p style="font-size:11px; color:#666;">Este es un correo automático de Globalcom.</p>
        `
    } 
    // 2. RESPUESTA AL TICKET (DE ADMIN O CLIENTE)
    else if (tipo === 'respuesta') {
        subject = `[Ticket #${idTicket}] Nueva respuesta de ${autor}`
        htmlContent = `
            <h2>Actualización en su ticket de Soporte</h2>
            <p><strong>Asunto original:</strong> ${asunto}</p>
            <p><strong>Respuesta de ${autor}:</strong><br>${mensaje}</p>
            <hr>
            <p style="font-size:11px; color:#666;">Revise su panel privado para responder.</p>
        `
    } 
    // 3. CAMBIO DE ESTADO (EJ: RESUELTO)
    else if (tipo === 'estado') {
        subject = `[Ticket #${idTicket}] Cambio de Estado: ${nuevoEstado}`
        htmlContent = `
            <h2>Actualización de Estado de Ticket</h2>
            <p>El ticket <strong>${asunto}</strong> ha sido marcado como: <strong style="color:blue;">${nuevoEstado}</strong> por ${autor}.</p>
            <hr>
            <p style="font-size:11px; color:#666;">Plataforma de Soporte Técnico Globalcom.</p>
        `
    }

    // LÓGICA DE ENVÍO DE CORREOS
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EMAIL_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Soporte Globalcom <soporte@globalcomfibra.cl>',
        to: [emailCliente],
        bcc: ['contacto@globalcomfibra.cl'], // <--- COPIA OCULTA RESPALDO
        subject: subject,
        html: htmlContent
      })
    })

    if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Error del servidor de correos: ${errText}`)
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
