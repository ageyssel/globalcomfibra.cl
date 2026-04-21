import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Configuración de CORS para que tu web pueda comunicarse con la función
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de la petición previa de seguridad (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password, clientData } = await req.json()

    // Creamos el cliente administrativo usando las variables de entorno de Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('GLOBALCOM_URL') ?? '',
      Deno.env.get('GLOBALCOM_KEY') ?? ''
    )

    // PASO A: Crear el usuario en la sección "Auth" (Sin confirmar correo)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    })

    if (authError) throw authError

    // PASO B: Guardar los datos comerciales en la tabla "clientes"
    const { error: dbError } = await supabaseAdmin
      .from('clientes')
      .upsert({ email, ...clientData })

    if (dbError) throw dbError

    return new Response(
      JSON.stringify({ message: "Cliente y cuenta creados con éxito" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})