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
    if (!fileBase64) throw new Error("El archivo PDF no llegó correctamente al servidor de Supabase.")

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) throw new Error("La API Key de Gemini NO se encontró. Vuelve a ejecutar el comando 'supabase secrets set'")

    const promptText = "Eres un contador experto. Extrae de esta factura chilena: RUT del cliente al que se le cobra (sin puntos ni guion, termina en K o numero), Monto Neto (solo numero entero), Monto Total (solo numero entero), Fecha de Emision (YYYY-MM-DD) y Mes del servicio (ej: Abril 2026). Responde estrictamente con un JSON valido con las llaves: rut, neto, total, fecha, mes."

    // CAMBIO APLICADO AQUÍ: gemini-1.5-flash-latest
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            { inline_data: { mime_type: "application/pdf", data: fileBase64 } }
          ]
        }],
        generationConfig: { response_mime_type: "application/json" }
      })
    })

    const geminiResult = await response.json()

    if (!response.ok) {
        throw new Error(`Google rechazó la conexión: ${geminiResult.error?.message || 'Error desconocido'}`)
    }

    if (!geminiResult.candidates || geminiResult.candidates.length === 0) {
        throw new Error("Gemini leyó el archivo pero no pudo extraer ningún dato.")
    }

    const dataString = geminiResult.candidates[0].content.parts[0].text
    let invoiceData;
    try {
        invoiceData = JSON.parse(dataString)
    } catch(e) {
        throw new Error(`Gemini no devolvió un formato válido. Respuesta obtenida: ${dataString}`)
    }

    const rutLimpioIA = invoiceData.rut.toString().replace(/[\.\-]/g, '').toUpperCase()

    const { data: clientes, error: errCliente } = await supabaseAdmin.from('clientes').select('email, empresa, rut, correo_facturacion')
    if (errCliente) throw new Error(`Error en Base de Datos: ${errCliente.message}`)

    const cliente = clientes.find(c => {
      if(!c.rut) return false;
      return c.rut.replace(/[\.\-]/g, '').toUpperCase() === rutLimpioIA;
    })

    if (!cliente) throw new Error(`El RUT extraído de la factura (${invoiceData.rut}) no coincide con ningún cliente registrado en el sistema.`)

    const binaryString = atob(fileBase64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)

    const storageName = `factura_${cliente.email}_${Date.now()}.pdf`
    const { error: uploadError } = await supabaseAdmin.storage.from('facturas').upload(storageName, bytes.buffer, { contentType: 'application/pdf' })
    if (uploadError) throw new Error(`Error subiendo PDF a Supabase: ${uploadError.message}`)

    const { data: { publicUrl } } = supabaseAdmin.storage.from('facturas').getPublicUrl(storageName)

    const { error: dbError } = await supabaseAdmin.from('facturas').insert({
      email_cliente: cliente.email,
      mes_anio: invoiceData.mes,
      url_archivo: publicUrl,
      valor_neto: invoiceData.neto,
      valor_total: invoiceData.total,
      fecha_emision: invoiceData.fecha,
      estado: 'Pendiente'
    })
    if (dbError) throw new Error(`Error guardando en historial: ${dbError.message}`)

    await supabaseAdmin.functions.invoke('send-invoice-notification', {
      body: { emailCliente: cliente.email, correoFacturacion: cliente.correo_facturacion || cliente.email, mesAnio: invoiceData.mes, urlArchivo: publicUrl, empresa: cliente.empresa, tipo: 'mensual' }
    })

    return new Response(JSON.stringify({ success: true, data: invoiceData, empresa: cliente.empresa }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  }
})
