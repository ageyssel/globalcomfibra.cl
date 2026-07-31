import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_EMAILS = 10
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

function parseEmails(value: unknown, fallback = ''): string[] {
  const source = Array.isArray(value) ? value : String(value ?? '').split(/[;,\n\s]+/)
  const cleaned = source.map(item => String(item ?? '').trim().toLowerCase()).filter(Boolean)
  const invalid = cleaned.filter(email => !EMAIL_RE.test(email))
  if (invalid.length) throw new Error(`Correo(s) inválido(s): ${invalid.join(', ')}`)

  const unique = [...new Set(cleaned)]
  if (unique.length > MAX_EMAILS) throw new Error(`Máximo ${MAX_EMAILS} correos de facturación.`)

  if (!unique.length && EMAIL_RE.test(fallback)) unique.push(fallback.toLowerCase())
  return unique
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { fileName, fileBase64, rut, neto, total, mes, fecha } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const rutLimpio = String(rut ?? '').replace(/[\.\-\s]/g, '').toUpperCase()

    const { data: clientes, error: clientesError } = await supabaseAdmin
      .from('clientes')
      .select('email, empresa, rut, correo_facturacion, correos_facturacion, dias_pago')

    if (clientesError) throw clientesError

    const cliente = clientes?.find(c => c.rut?.replace(/[\.\-\s]/g, '').toUpperCase() === rutLimpio)
    if (!cliente) {
      throw new Error(`RUT ${rut} no encontrado en el sistema. Asegúrate de que exista en tu lista de clientes.`)
    }

    const destinatarios = parseEmails(
      cliente.correos_facturacion?.length ? cliente.correos_facturacion : cliente.correo_facturacion,
      cliente.email
    )

    const binaryString = atob(fileBase64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)

    const storageName = `factura_${cliente.email}_${Date.now()}.pdf`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('facturas')
      .upload(storageName, bytes.buffer, { contentType: 'application/pdf' })
    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabaseAdmin.storage.from('facturas').getPublicUrl(storageName)

    const diasPago = cliente.dias_pago || 30
    const fEmision = new Date(fecha || new Date())
    const fVencimiento = new Date(fEmision)
    fVencimiento.setDate(fVencimiento.getDate() + diasPago)
    const estado = new Date() > fVencimiento ? 'Vencida' : 'Pendiente'

    const { error: dbError } = await supabaseAdmin.from('facturas').insert({
      email_cliente: cliente.email,
      mes_anio: mes,
      url_archivo: publicUrl,
      valor_neto: neto,
      valor_total: total,
      fecha_emision: fEmision.toISOString().split('T')[0],
      estado
    })
    if (dbError) throw dbError

    const { data: notificationData, error: notificationError } = await supabaseAdmin.functions.invoke(
      'send-invoice-notification',
      {
        body: {
          emailCliente: cliente.email,
          correosFacturacion: destinatarios,
          mesAnio: mes,
          urlArchivo: publicUrl,
          empresa: cliente.empresa,
          tipo: 'mensual'
        }
      }
    )

    if (notificationError) throw notificationError
    if (notificationData?.error) throw new Error(notificationData.error)

    return new Response(JSON.stringify({
      success: true,
      empresa: cliente.empresa,
      destinatarios: destinatarios.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: errorMessage(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  }
})
