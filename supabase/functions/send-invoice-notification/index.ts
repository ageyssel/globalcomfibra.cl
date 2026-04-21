import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Recibimos la nueva variable "tipo"
    const { emailCliente, correoFacturacion, mesAnio, urlArchivo, empresa, tipo } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    // Lógica condicional de textos
    const esHabilitacion = tipo === 'habilitacion';
    
    const tituloCorreo = esHabilitacion 
        ? `Factura por Habilitación de Servicio - ${empresa}` 
        : `Factura de Servicio Globalcom - ${mesAnio}`;
        
    const textoCuerpo = esHabilitacion
        ? `Junto con saludar, adjuntamos la Factura correspondiente al <strong>Costo de Habilitación y Puesta en Marcha</strong> de su servicio de conectividad dedicado.`
        : `Junto con saludar, adjuntamos la Factura correspondiente a la renta de los servicios del mes de <strong>${mesAnio}</strong>.`;

    const textoAcuerdo = esHabilitacion
        ? `Recordarle que este cobro de instalación debe ser pagado mediante <strong>depósito o transferencia bancaria</strong> para dar inicio a la activación técnica, conforme a lo estipulado en nuestro acuerdo comercial.`
        : `Recordarle que la renta mensual convenida debe ser pagada mediante <strong>depósito o transferencia bancaria</strong> conforme a lo estipulado en nuestro acuerdo.`;

    const emailHtml = `
      <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        
        <div style="background-color: #1a1f2e; padding: 30px; text-align: center; border-bottom: 4px solid #3b82f6;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 1px;">GLOBALCOM</h1>
          <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 10px; text-transform: uppercase; letter-spacing: 2px;">Departamento de Facturación</p>
        </div>

        <div style="padding: 40px 30px; color: #334155; line-height: 1.6;">
          <p style="font-size: 15px; font-weight: 600;">Estimados equipo de ${empresa},</p>
          
          <p style="font-size: 14px;">${textoCuerpo}</p>
          <p style="font-size: 14px;">${textoAcuerdo}</p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 25px; margin: 30px 0; border-radius: 12px;">
            <h3 style="margin: 0 0 15px 0; font-size: 11px; color: #3b82f6; text-transform: uppercase; letter-spacing: 1px;">Datos para Transferencia</h3>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Nombre:</strong> Servicio de Telecomunicaciones Globalcom Ltda.</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Banco:</strong> Scotiabank / Cuenta Corriente</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>RUT:</strong> 77.812.215-4</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>N° de cuenta:</strong> 987836121</p>
          </div>

          <p style="font-size: 14px;">Agradecemos su gestión para concretar el pago a la brevedad. Si ya realizó la transferencia, por favor envíe el comprobante a <a href="mailto:contacto@globalcomfibra.cl" style="color: #3b82f6; text-decoration: none;">contacto@globalcomfibra.cl</a>.</p>

          <div style="text-align: center; margin: 35px 0;">
            <a href="${urlArchivo}" style="background-color: #1a1f2e; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 13px; display: inline-block;">DESCARGAR FACTURA PDF</a>
          </div>
        </div>

        <div style="background-color: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 9px; margin: 0; text-transform: uppercase; letter-spacing: 1px;">
            Desarrollo y Tecnología © FocusFrame Media SpA
          </p>
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
        from: 'Facturación Globalcom <no-reply@globalcomfibra.cl>',
        to: [correoFacturacion],
        bcc: ['contacto@globalcomfibra.cl'], // Con copia a tu empresa
        subject: tituloCorreo,
        html: emailHtml,
      }),
    });

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 
    })
  }
})