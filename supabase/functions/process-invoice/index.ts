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
    if (!fileBase64) throw new Error("El archivo no llegó correctamente.")

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) throw new Error("La API Key no existe en el servidor.")

    const promptText = "Eres un contador experto. Extrae de esta factura chilena: RUT del cliente (sin puntos ni guion, termina en K o numero), Monto Neto (solo numero entero), Monto Total (solo numero entero), Fecha de Emision (YYYY-MM-DD) y Mes del servicio (ej: Abril 2026). Responde estrictamente un JSON puro con las llaves: rut, neto, total, fecha, mes."

    // --- SISTEMA ANTI-SATURACIÓN ---
    let response;
    let geminiResult;
    let intentos = 0;
    const maxIntentos = 3;

    while (intentos < maxIntentos) {
        // Usamos el modelo 2.0 (Ultra estable y de producción)
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
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

        geminiResult = await response.json()

        if (response.ok) {
            break; // Google respondió con éxito, salimos del bucle.
        } else {
            const errMsg = geminiResult.error?.message || 'Error desconocido';
            // Si hay alta demanda (saturación), esperamos y reintentamos en silencio
            if (errMsg.includes("high demand") || response.status === 429 || response.status === 503) {
                intentos++;
                if (intentos < maxIntentos) {
                    await new Promise(resolve => setTimeout(resolve, 2500 * intentos)); // Espera progresiva
                    continue;
                }
            }
            throw new Error(`Error de Google: ${errMsg}`);
        }
    }

    if (!geminiResult.candidates || geminiResult.candidates.length === 0) {
        throw new Error("Gemini no pudo extraer ningún dato.")
    }

    const dataString = geminiResult.candidates[0].content.parts[0].text
    let invoiceData;
    try {
        invoiceData = JSON.parse(dataString)
    } catch(e) {
        throw new Error(`Error de formato IA: ${dataString}`)
    }

    const rutLimpioIA = invoiceData.rut.toString().replace(/[\.\-]/g, '').toUpperCase()

    const { data: clientes, error: errCliente } = await supabaseAdmin.from('clientes').select('email, empresa, rut, correo_facturacion, dias_pago')
    if (errCliente) throw new Error(`Error BD: ${errCliente.message}`)

    const cliente = clientes.find(c => {
      if(!c.rut) return false;
      return c.rut.replace(/[\.\-]/g, '').toUpperCase() === rutLimpioIA;
    })

    if (!cliente) throw new Error(`El RUT extraído de la factura (${invoiceData.rut}) no coincide con ningún cliente registrado.`)

    const binaryString = atob(fileBase64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)

    const storageName = `factura_${cliente.email}_${Date.now()}.pdf`
    const { error: uploadError } = await supabaseAdmin.storage.from('facturas').upload(storageName, bytes.buffer, { contentType: 'application/pdf' })
    if (uploadError) throw new Error(`Error Subida: ${uploadError.message}`)

    const { data: { publicUrl } } = supabaseAdmin.storage.from('facturas').getPublicUrl(storageName)

    const diasPago = cliente.dias_pago || 30;
    const fechaEmision = new Date(invoiceData.fecha);
    const fechaVencimiento = new Date(fechaEmision);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + diasPago);
    fechaVencimiento.setHours(23, 59, 59, 999);
    const estadoInicial = (new Date() > fechaVencimiento) ? 'Vencida' : 'Pendiente';

    const { error: dbError } = await supabaseAdmin.from('facturas').insert({
      email_cliente: cliente.email,
      mes_anio: invoiceData.mes,
      url_archivo: publicUrl,
      valor_neto: invoiceData.neto,
      valor_total: invoiceData.total,
      fecha_emision: invoiceData.fecha,
      estado: estadoInicial
    })
    if (dbError) throw new Error(`Error guardando en BD: ${dbError.message}`)

    await supabaseAdmin.functions.invoke('send-invoice-notification', {
      body: { emailCliente: cliente.email, correoFacturacion: cliente.correo_facturacion || cliente.email, mesAnio: invoiceData.mes, urlArchivo: publicUrl, empresa: cliente.empresa, tipo: 'mensual' }
    })

    return new Response(JSON.stringify({ success: true, data: invoiceData, empresa: cliente.empresa }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  }
})
