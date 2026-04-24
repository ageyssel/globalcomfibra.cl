import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { email, password, clientData } = await req.json()

    if (!password || password.length < 6) {
        throw new Error("La contraseña debe tener al menos 6 caracteres.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Intentar crear la cuenta en Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    })

    // Si arroja error y NO es porque el correo ya existe, bloqueamos.
    // Si el correo ya existe (already registered), lo dejamos pasar silenciosamente.
    if (authError && !authError.message.toLowerCase().includes('already')) {
        throw new Error(`Error de cuenta: ${authError.message}`);
    }

    // 2. Guardar la nueva empresa en la base de datos
    const { error: dbError } = await supabaseAdmin.from('clientes').insert({
      email: email,
      ...clientData
    })

    if (dbError) {
        throw new Error(`Error de base de datos: ${dbError.message}`)
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
