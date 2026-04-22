import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { fileName, fileBase64, rut, neto, total, mes, fecha } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ¡EL BLINDAJE ESTÁ AQUÍ! Ahora limpia Puntos, Guiones y Espacios (\s)
    const rutLimpio = rut.replace(/[\.\-\s]/g, '').toUpperCase()
    
    const { data: clientes } = await supabaseAdmin.from('clientes').select('email, empresa, rut, correo_facturacion, dias_pago')
    
    const cliente = clientes?.find(c => c.rut?.replace(/[\.\-\s]/g, '').toUpperCase() === rutLimpio)

    if (!cliente) throw new Error(`RUT ${rut} no encontrado en el sistema. Asegúrate de que exista en tu lista de clientes.`)

    // Resto del código intacto...
    const binaryString = atob(fileBase64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)

    const storageName = `factura_${cliente.email}_${Date.now()}.pdf`
    await supabaseAdmin.storage.from('facturas').upload(storageName, bytes.buffer, { contentType: 'application/pdf' })
    const { data: { publicUrl } } = supabaseAdmin.storage.from('facturas').getPublicUrl(storageName)

    const diasPago = cliente.dias_pago || 30
    const fEmision = new Date(fecha || new Date())
    const fVencimiento = new Date(fEmision)
    fVencimiento.setDate(fVencimiento.getDate() + diasPago)
    const estado = (new Date() > fVencimiento) ? 'Vencida' : 'Pendiente'

    const { error: dbError } = await supabaseAdmin.from('facturas').insert({
      email_cliente: cliente.email,
      mes_anio: mes,
      url_archivo: publicUrl,
      valor_neto: neto,
      valor_total: total,
      fecha_emision: fEmision.toISOString().split('T')[0],
      estado: estado
    })
    if (dbError) throw dbError

    await supabaseAdmin.functions.invoke('send-invoice-notification', {
      body: { emailCliente: cliente.email, correoFacturacion: cliente.correo_facturacion || cliente.email, mesAnio: mes, urlArchivo: publicUrl, empresa: cliente.empresa, tipo: 'mensual' }
    })

    return new Response(JSON.stringify({ success: true, empresa: cliente.empresa }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  }
})
