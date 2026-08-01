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
  if (unique.length > MAX_EMAILS) throw new Error(`Máximo ${MAX_EMAILS} destinatarios de cobranza.`)
  if (!unique.length && EMAIL_RE.test(fallback)) unique.push(fallback.toLowerCase())
  if (!unique.length) throw new Error('El cliente no tiene correos de facturación válidos.')
  return unique
}

function normalizeRut(value: unknown): string {
  return String(value ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!EMAIL_API_KEY) throw new Error('RESEND_API_KEY no está configurada.')

    const { emailCliente, empresa, rut, deudaTotal, facturas } = await req.json()
    const portalEmail = String(emailCliente ?? '').trim().toLowerCase()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: clientes, error: clientesError } = await supabaseAdmin
      .from('clientes')
      .select('email, rut, correo_facturacion, correos_facturacion')
      .eq('email', portalEmail)

    if (clientesError) throw clientesError

    const rutObjetivo = normalizeRut(rut)
    const cliente = (clientes || []).find(item => normalizeRut(item.rut) === rutObjetivo) || clientes?.[0]

    const destinatarios = parseEmails(
      cliente?.correos_facturacion?.length ? cliente.correos_facturacion : cliente?.correo_facturacion,
      portalEmail
    )

    const fm = (v: number) => new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(v)

    let tablaHTML = `<table style="width:100%;border-collapse:collapse;margin-top:15px;margin-bottom:20px;font-family:Arial,sans-serif;font-size:13px;">
      <thead><tr style="background-color:#f8fafc;border-bottom:2px solid #e2e8f0;text-align:left;">
        <th style="padding:10px;">Período / Servicio</th>
        <th style="padding:10px;">Vencimiento</th>
        <th style="padding:10px;">Estado</th>
        <th style="padding:10px;text-align:right;">Monto</th>
      </tr></thead><tbody>`

    for (const factura of Array.isArray(facturas) ? facturas : []) {
      const colorEstado = factura.estado === 'Vencida'
        ? 'color:#dc2626;font-weight:bold;'
        : 'color:#2563eb;'
      const link = factura.link
        ? `<br><a href="${factura.link}" style="font-size:10px;color:#2563eb;text-decoration:none;">Descargar PDF</a>`
        : ''
      const atraso = factura.diasAtraso > 0
        ? `<br><span style="font-size:10px;color:#dc2626;">(${factura.diasAtraso} días atraso)</span>`
        : ''

      tablaHTML += `<tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px;"><strong>${factura.mes}</strong>${link}</td>
        <td style="padding:10px;">${factura.vencimiento}</td>
        <td style="padding:10px;${colorEstado}">${factura.estado}${atraso}</td>
        <td style="padding:10px;text-align:right;font-weight:bold;">${fm(Number(factura.monto || 0))}</td>
      </tr>`
    }

    tablaHTML += `<tr style="background-color:#f8fafc;">
      <td colspan="3" style="padding:12px;text-align:right;font-weight:bold;font-size:14px;">Total a Regularizar:</td>
      <td style="padding:12px;text-align:right;font-weight:900;font-size:18px;color:#dc2626;">${fm(Number(deudaTotal || 0))}</td>
    </tr></tbody></table>`

    const htmlContent = `
      <div style="font-family:Arial,sans-serif;color:#334155;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,.1);">
        <div style="background-color:#1a1f2e;padding:20px;text-align:center;"><h1 style="color:#fff;margin:0;font-size:20px;letter-spacing:1px;">GLOBALCOM</h1></div>
        <div style="padding:30px;">
          <h2 style="color:#1e293b;margin-top:0;font-size:18px;">Estado de Cuenta de Servicios</h2>
          <p>Estimado cliente <strong>${empresa}</strong> (RUT: ${rut}),</p>
          <p style="line-height:1.6;">Junto con saludar cordialmente, informamos el estado actual de su facturación.</p>
          <p style="line-height:1.6;">A continuación detallamos los documentos pendientes de pago:</p>
          ${tablaHTML}
          <h3 style="color:#1e293b;font-size:15px;margin-top:25px;">Formas de Pago</h3>
          <div style="background-color:#f8fafc;padding:15px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;line-height:1.6;">
            <p style="margin:0 0 10px;">Puede realizar su pago mediante transferencia bancaria:</p>
            <ul style="margin:0;padding-left:20px;color:#475569;">
              <li><strong>Razón Social:</strong> Servicio de Telecomunicaciones Globalcom LTDA.</li>
              <li><strong>RUT:</strong> 77.812.215-4</li>
              <li><strong>Banco:</strong> Scotiabank</li>
              <li><strong>Tipo de Cuenta:</strong> Cuenta Corriente</li>
              <li><strong>Número de Cuenta:</strong> 987836121</li>
              <li><strong>Email comprobantes:</strong> contacto@globalcomfibra.cl</li>
            </ul>
          </div>
          <div style="background-color:#fef2f2;padding:15px;border-radius:8px;border-left:4px solid #ef4444;margin-top:25px;">
            <p style="color:#991b1b;font-size:13px;margin:0;line-height:1.6;"><strong>Aviso Importante:</strong> Para garantizar la continuidad del servicio, solicitamos regularizar los montos vencidos a la brevedad. Si ya realizó el pago, omita este mensaje.</p>
          </div>
          <p style="font-size:13px;line-height:1.6;margin-top:25px;color:#64748b;">Quedamos disponibles ante cualquier consulta administrativa.</p>
          <p style="font-size:13px;margin-top:30px;">Atentamente,<br><strong style="color:#1e293b;">Equipo de Facturación y Cobranza</strong><br>Globalcom Telecomunicaciones</p>
        </div>
        <div style="background-color:#f1f5f9;padding:15px;text-align:center;font-size:11px;color:#94a3b8;">Mensaje generado automáticamente.</div>
      </div>`

    const payload = destinatarios.map(destinatario => ({
      from: 'Cobranza Globalcom <contacto@globalcomfibra.cl>',
      to: [destinatario],
      ...(destinatario === 'contacto@globalcomfibra.cl' ? {} : { bcc: ['contacto@globalcomfibra.cl'] }),
      reply_to: 'contacto@globalcomfibra.cl',
      subject: `Aviso de Cobro y Estado de Cuenta - ${empresa}`,
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

    if (!res.ok) throw new Error(`Error enviando cobranza: ${await res.text()}`)

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
