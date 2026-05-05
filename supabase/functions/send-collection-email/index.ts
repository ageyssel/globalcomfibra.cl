import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EMAIL_API_KEY = Deno.env.get('RESEND_API_KEY') 

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { emailCliente, empresa, rut, deudaTotal, facturas } = await req.json()

    // Formateador de moneda CLP
    const fm = (v) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(v);

    // Construcción de la tabla dinámica
    let tablaHTML = `<table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; font-family: Arial, sans-serif; font-size: 13px;">
        <thead>
            <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left;">
                <th style="padding: 10px;">Período / Servicio</th>
                <th style="padding: 10px;">Vencimiento</th>
                <th style="padding: 10px;">Estado</th>
                <th style="padding: 10px; text-align: right;">Monto</th>
            </tr>
        </thead>
        <tbody>`;
    
    facturas.forEach(f => {
        const colorEstado = f.estado === 'Vencida' ? 'color: #dc2626; font-weight: bold;' : 'color: #2563eb;';
        const linkA = f.link ? `<br><a href="${f.link}" style="font-size: 10px; color: #2563eb; text-decoration: none;">📄 Descargar PDF</a>` : '';
        const txtAtraso = f.diasAtraso > 0 ? `<br><span style="font-size: 10px; color: #dc2626;">(${f.diasAtraso} días atraso)</span>` : '';
        
        tablaHTML += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px;"><strong>${f.mes}</strong>${linkA}</td>
                <td style="padding: 10px;">${f.vencimiento}</td>
                <td style="padding: 10px; ${colorEstado}">${f.estado}${txtAtraso}</td>
                <td style="padding: 10px; text-align: right; font-weight: bold;">${fm(f.monto)}</td>
            </tr>
        `;
    });
    
    tablaHTML += `
        <tr style="background-color: #f8fafc;">
            <td colspan="3" style="padding: 12px; text-align: right; font-weight: bold; font-size: 14px;">Total a Regularizar:</td>
            <td style="padding: 12px; text-align: right; font-weight: black; font-size: 18px; color: #dc2626;">${fm(deudaTotal)}</td>
        </tr>
    </tbody></table>`;

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; color: #334155; max-w: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background-color: #1a1f2e; padding: 20px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 20px; letter-spacing: 1px;">GLOBALCOM</h1>
            </div>
            
            <div style="padding: 30px;">
                <h2 style="color: #1e293b; margin-top: 0; font-size: 18px;">Estado de Cuenta de Servicios</h2>
                <p>Estimado cliente <strong>${empresa}</strong> (RUT: ${rut}),</p>
                
                <p style="line-height: 1.6;">Junto con saludar cordialmente y esperando que se encuentre muy bien, nos dirigimos a usted para informarle sobre el estado actual de su facturación.</p>
                
                <p style="line-height: 1.6;">En Globalcom valoramos profundamente nuestra relación comercial y su preferencia. A continuación, le detallamos los documentos que se encuentran actualmente pendientes de pago en su cuenta:</p>
                
                ${tablaHTML}
                
                <h3 style="color: #1e293b; font-size: 15px; margin-top: 25px;">Formas de Pago</h3>
                <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px; line-height: 1.6;">
                    <p style="margin: 0 0 10px 0;">Puede realizar su pago mediante transferencia bancaria a la siguiente cuenta:</p>
                    <ul style="margin: 0; padding-left: 20px; color: #475569;">
                        <li><strong>Razón Social:</strong> Servicio de Telecomunicaciones Globalcom LTDA.</li>
                        <li><strong>RUT:</strong> 77.812.215-4</li>
                        <li><strong>Banco:</strong> Scotiabank</li>
                        <li><strong>Tipo de Cuenta:</strong> Cuenta Corriente</li>
                        <li><strong>Número de Cuenta:</strong> 987836121</li>
                        <li><strong>Email comprobantes:</strong> contacto@globalcomfibra.cl</li>
                    </ul>
                </div>

                <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444; margin-top: 25px;">
                    <p style="color: #991b1b; font-size: 13px; margin: 0; line-height: 1.6;">
                        <strong>Aviso Importante:</strong> Le recordamos amablemente que, para garantizar la continuidad ininterrumpida de su servicio y evitar la <strong>suspensión automática del sistema</strong>, es necesario regularizar los montos vencidos a la brevedad posible. <em>Si usted ya realizó el pago en las últimas horas, por favor omita este mensaje.</em>
                    </p>
                </div>

                <p style="font-size: 13px; line-height: 1.6; margin-top: 25px; color: #64748b;">Quedamos a su entera disposición ante cualquier duda o consulta administrativa. Puede responder directamente a este correo para obtener asistencia.</p>

                <p style="font-size: 13px; margin-top: 30px;">Atentamente,<br><strong style="color: #1e293b;">Equipo de Facturación y Cobranza</strong><br>Globalcom Telecomunicaciones</p>
            </div>
            
            <div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 11px; color: #94a3b8;">
                Este es un mensaje generado automáticamente. Por favor no responda si no requiere asistencia adicional.
            </div>
        </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EMAIL_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Cobranza Globalcom <contacto@globalcomfibra.cl>',
        to: [emailCliente],
        bcc: ['contacto@globalcomfibra.cl'], 
        subject: `Aviso de Cobro y Estado de Cuenta - ${empresa}`,
        html: htmlContent
      })
    })

    if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Error enviando correo: ${errText}`)
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
