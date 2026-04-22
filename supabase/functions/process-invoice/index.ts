import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) throw new Error("No se recibió el archivo")

    const supabaseAdmin = createClient(
      Deno.env.get('GLOBALCOM_URL') ?? '',
      Deno.env.get('GLOBALCOM_KEY') ?? ''
    )

    // 1. Convertir PDF a Base64 para Gemini
    const arrayBuffer = await file.arrayBuffer()
    const base64File = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    // 2. Llamar a Gemini 1.5 Flash (Rápido y económico)
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Eres un experto contable chileno. Extrae los siguientes datos de esta factura: RUT del receptor (sin puntos ni guion), Monto Neto (solo número), Monto Total (solo número), Fecha de Emisión (YYYY-MM-DD) y el Mes al que corresponde el servicio. Responde estrictamente en formato JSON." },
            { inline_data: { mime_type: "application/pdf", data: base64File } }
          ]
        }],
        generationConfig: { response_mime_type: "application/json" }
      })
    })

    const geminiResult = await response.json()
    const dataString = geminiResult.candidates[0].content.parts[0].text
    const invoiceData = JSON.parse(dataString) // { rut, neto, total, fecha, mes }

    // 3. Buscar al cliente en la base de datos por RUT
    const { data: cliente } = await supabaseAdmin
      .from('clientes')
      .select('email, empresa, correo_facturacion')
      .ilike('rut', `%${invoiceData.rut}%`)
      .single()

    if (!cliente) throw new Error(`Cliente con RUT ${invoiceData.rut} no encontrado.`)

    // 4. Subir el archivo original al Storage
    const fileName = `factura_${cliente.email}_${Date.now()}.pdf`
    await supabaseAdmin.storage.from('facturas').upload(fileName, file)
    const { data: { publicUrl } } = supabaseAdmin.storage.from('facturas').getPublicUrl(fileName)

    // 5. Registrar en la tabla Facturas
    const { data: nuevaFactura, error: dbError } = await supabaseAdmin.from('facturas').insert({
      email_cliente: cliente.email,
      mes_anio: invoiceData.mes,
      url_archivo: publicUrl,
      valor_neto: invoiceData.neto,
      valor_total: invoiceData.total,
      fecha_emision: invoiceData.fecha,
      estado: 'Pendiente'
    }).select().single()

    if (dbError) throw dbError

    // 6. Notificar al cliente (Reusamos tu función anterior)
    await supabaseAdmin.functions.invoke('send-invoice-notification', {
      body: { 
        emailCliente: cliente.email, 
        correoFacturacion: cliente.correo_facturacion || cliente.email, 
        mesAnio: invoiceData.mes, 
        urlArchivo: publicUrl, 
        empresa: cliente.empresa,
        tipo: 'mensual' 
      }
    })

    return new Response(JSON.stringify({ success: true, data: invoiceData }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 
    })
  }
})