import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { emailCliente, empresa, asunto, idTicket } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    const emailHtml = `
      <div style="font-family: 'Inter', Helvetica, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #1a1f2e; padding: 25px; text-align: center; border-bottom: 4px solid #10b981;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800;">TICKET RESUELTO</h1>
          <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 11px; text-transform: uppercase;">Soporte Técnico Globalcom</p>
        </div>

        <div style="padding: 35px 30px; color: #334155; line-height: 1.6;">
          <p style="font-size: 15px; font-weight: 600;">Estimados equipo de ${empresa},</p>
          <p style="font-size: 14px;">Nos complace informarle que el ticket de soporte <strong>#${idTicket}</strong> ha sido marcado como <strong>RESUELTO</strong> por nuestro Centro de Operaciones de Red (NOC).</p>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; margin: 25px 0; border-radius: 8px;">
            <p style="margin: 0; font-size: 13px; color: #64748b; text-transform: uppercase; font-weight: bold;">Asunto del Requerimiento:</p>
            <p style="margin: 5px 0 0 0; font-size: 15px; font-weight: 600; color: #0f172a;">${asunto}</p>
          </div>

          <p style="font-size: 14px;">Si considera que el problema persiste o requiere asistencia adicional respecto a este mismo caso, por favor responda directamente a este correo o genere un nuevo requerimiento desde su Portal Privado.</p>

          <div style="text-align: center; margin-top: 35px;">
            <a href="https://globalcomfibra.cl/login" style="background-color: #1a1f2e; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 13px; display: inline-block;">IR AL PORTAL DE CLIENTES</a>
          </div>
        </div>

        <div style="background-color: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 10px; margin: 0;">Servicio de Telecomunicaciones Globalcom Ltda.</p>
        </div>
      </div>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'Soporte Globalcom <no-reply@globalcomfibra.cl>',
        to: [emailCliente],
        subject: `[Resuelto] Ticket #${idTicket}: ${asunto}`,
        html: emailHtml,
      }),
    });

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders, status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 })
  }
})