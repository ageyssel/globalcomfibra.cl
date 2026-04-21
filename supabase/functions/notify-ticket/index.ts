import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { empresa, emailCliente, asunto, prioridad, descripcion } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    // Determinamos el color según la prioridad
    const colorPrioridad = prioridad === 'Alta' ? '#ef4444' : prioridad === 'Media' ? '#f97316' : '#3b82f6';

    const emailHtml = `
      <div style="font-family: 'Inter', Helvetica, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #1a1f2e; padding: 20px; text-align: center; border-bottom: 4px solid ${colorPrioridad};">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800;">NUEVO TICKET DE SOPORTE</h1>
          <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 11px; text-transform: uppercase;">Globalcom NOC System</p>
        </div>

        <div style="padding: 30px; color: #334155; line-height: 1.6;">
          <p style="margin: 0 0 20px 0;">Se ha generado un nuevo requerimiento desde el Portal de Clientes.</p>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold; width: 30%;">Cliente:</td>
              <td style="padding: 10px 0; font-weight: 600;">${empresa} <br><span style="font-size: 12px; font-weight: normal; color: #64748b;">${emailCliente}</span></td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Asunto:</td>
              <td style="padding: 10px 0; font-weight: 600;">${asunto}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Prioridad:</td>
              <td style="padding: 10px 0;"><span style="background-color: ${colorPrioridad}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">${prioridad}</span></td>
            </tr>
          </table>

          <div style="margin-top: 25px; background-color: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #cbd5e1;">
            <p style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold; margin: 0 0 10px 0;">Descripción del Problema:</p>
            <p style="margin: 0; font-size: 14px; white-space: pre-wrap;">${descripcion}</p>
          </div>
        </div>
      </div>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Globalcom Tickets <no-reply@globalcomfibra.cl>',
        to: ['soporte@globalcomfibra.cl'], // AQUÍ SE NOTIFICA A TU EQUIPO TÉCNICO
        subject: `[${prioridad}] Nuevo Ticket - ${empresa}: ${asunto}`,
        html: emailHtml,
      }),
    });

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders, status: 200 })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 })
  }
})