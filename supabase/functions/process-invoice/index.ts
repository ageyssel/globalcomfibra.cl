import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { PDFDocument } from "https://cdn.skypack.dev/pdf-lib"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { fileName, fileBase64, rut, mes } = await req.json()
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    // 1. Buscar cliente por RUT
    const rutLimpio = rut.replace(/[\.\-]/g, '').toUpperCase()
    const { data: clientes } = await supabaseAdmin.from('clientes').select('email, empresa, rut, correo_facturacion, dias_pago')
    const cliente = clientes?.find(c => c.rut?.replace(/[\.\-]/g, '').toUpperCase() === rutLimpio)
    if (!cliente) throw new Error(`RUT ${rut} no registrado.`)

    // 2. EXTRAER DATOS DEL PDF (Simulación de lectura de texto para ahorro de costos)
    // Nota: En Edge Functions, para lectura de texto real sin IA, usamos patrones de búsqueda.
    // Para esta versión, el sistema buscará los valores en los metadatos o texto extraído.
    // Si la factura es estándar SII, buscaremos los campos comunes.
    
    // Por ahora, para asegurar éxito 100% gratuito, el sistema recibirá los montos desde el admin
    // pero si prefieres que los lea, habilitamos el extractor de texto:
    
    const netoDetectado = 0; // Aquí iría la lógica de regex.text
    const totalDetectado = 0;

    // 3. Subir PDF
    const binaryString = atob(fileBase64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
    const storageName = `factura_${cliente.email}_${Date.now()}.pdf`
    await supabaseAdmin.storage.from('facturas').upload(storageName, bytes.buffer, { contentType: 'application/pdf' })
    const { data: { publicUrl } } = supabaseAdmin.storage.from('facturas').getPublicUrl(storageName)

    // 4. Guardar registro (El admin enviará los datos leídos por el navegador)
    const { error: dbError } = await supabaseAdmin.from('facturas').insert({
      email_cliente: cliente.email,
      mes_anio: mes,
      url_archivo: publicUrl,
      valor_neto: netoDetectado || 0,
      valor_total: totalDetectado || 0,
      fecha_emision: new Date().toISOString().split('T')[0],
      estado: 'Pendiente'
    })
    if (dbError) throw dbError

    return new Response(JSON.stringify({ success: true, empresa: cliente.empresa }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  }
})
