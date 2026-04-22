import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { fileName, fileBase64 } = await req.json()
    if (!fileBase64) throw new Error("El archivo PDF no llegó correctamente al servidor.")

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) throw new Error("API Key de Gemini no encontrada en Supabase.")

    // 1. Pedirle a Gemini que lea el PDF
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Eres un contador experto. Extrae de esta factura: RUT del cliente al que se le cobra (sin puntos ni guion), Monto Neto (solo número entero sin signos), Monto Total (solo número entero sin signos), Fecha de Emisión (YYYY-MM-DD) y Mes del servicio (ej: Abril 2026). Responde SOLO un JSON válido con las llaves exactas: rut, neto, total, fecha, mes." },
            { inline_data: { mime_type: "application/pdf", data: fileBase64 } }
          ]
        }],
        generationConfig: { response_mime_type: "application/json" }
      })
    })

    const geminiResult = await response.json()
    if (!response.ok) throw new Error("Gemini no pudo procesar este PDF.")

    const dataString = geminiResult.candidates[0].content.parts[0].text
    const invoiceData = JSON.parse(dataString)

    // Limpiamos el RUT entregado por la IA
    const rutLimpioIA = invoiceData.rut.toString().replace(/[\.\-]/g, '').toUpperCase()

    // 2. Traer a todos los clientes para cruzar RUTs sin importar cómo estén escritos
    const { data: clientes, error: errCliente } = await supabaseAdmin.from('clientes').select('email, empresa, rut, correo_facturacion')
    if (errCliente) throw new Error("Error conectando con la tabla de clientes.")

    const cliente = clientes.find(c => {
      if(!c.rut) return false;
      const rutLimpioDB = c.rut.replace(/[\.\-]/g, '').toUpperCase();
      return rutLimpioDB === rutLimpioIA;
    })

    if (!cliente) throw new Error(`El RUT ${invoiceData.rut} extraído del PDF no coincide con ningún cliente registrado.`)

    // 3. Transformar Base64 de vuelta a PDF para guardarlo
    const binaryString = atob(fileBase64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)

    const storageName = `factura_${cliente.email}_${Date.now()}.pdf`
    const { error: uploadError } = await supabaseAdmin.storage.from('facturas').upload(storageName, bytes.buffer, { contentType: 'application/pdf' })
    if (uploadError) throw new Error(`Error subiendo PDF: ${uploadError.message}`)

    const { data: { publicUrl } } = supabaseAdmin.storage.from('facturas').getPublicUrl(storageName)

    // 4. Guardar en la Base de Datos
    const { error: dbError } = await supabaseAdmin.from('facturas').insert({
      email_cliente: cliente.email,
      mes_anio: invoiceData.mes,
      url_archivo: publicUrl,
      valor_neto: invoiceData.neto,
      valor_total: invoiceData.total,
      fecha_emision: invoiceData.fecha,
      estado: 'Pendiente'
    })
    if (dbError) throw new Error(`Error guardando registro: ${dbError.message}`)

    // 5. Notificar al cliente
    await supabaseAdmin.functions.invoke('send-invoice-notification', {
      body: { emailCliente: cliente.email, correoFacturacion: cliente.correo_facturacion || cliente.email, mesAnio: invoiceData.mes, urlArchivo: publicUrl, empresa: cliente.empresa, tipo: 'mensual' }
    })

    return new Response(JSON.stringify({ success: true, data: invoiceData, empresa: cliente.empresa }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    // Devolvemos status 200 pero con success: false para poder LEER el error en el frontend
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  }
})
