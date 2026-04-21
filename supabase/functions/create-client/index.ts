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
    
    const supabaseAdmin = createClient(
      Deno.env.get('GLOBALCOM_URL') ?? '',
      Deno.env.get('GLOBALCOM_KEY') ?? ''
    )

    // 1. Crear usuario en Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true
    })
    if (authError) throw authError

    // 2. Insertar en tabla clientes
    const { error: dbError } = await supabaseAdmin.from('clientes').upsert({ email, ...clientData })
    if (dbError) throw dbError

    // 3. ENVIAR CORREO DE BIENVENIDA (Vía Resend)
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    
    const emailHtml = `
      <div style="font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
        
        <div style="background-color: #1a1f2e; padding: 40px 20px; text-align: center; border-bottom: 4px solid #3b82f6;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 1px;">GLOBALCOM</h1>
          <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 3px; font-weight: 600;">NOC & Portal de Clientes</p>
        </div>

        <div style="padding: 40px 30px; color: #334155; line-height: 1.6;">
          <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 600;">Bienvenido, equipo de ${clientData.empresa}</h2>
          <p style="font-size: 15px;">Nos complace darle la bienvenida a nuestra red B2B. Su infraestructura tecnológica ahora está respaldada por nuestra red, y su cuenta en el <strong>Portal de Clientes Globalcom</strong> ya se encuentra activa.</p>

          <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 25px; margin: 35px 0; border-radius: 0 8px 8px 0;">
            <h3 style="margin: 0 0 15px 0; font-size: 12px; color: #475569; text-transform: uppercase; letter-spacing: 1px;">Credenciales de Acceso Exclusivo</h3>
            <p style="margin: 8px 0; font-size: 15px;"><strong>URL del Portal:</strong> <a href="https://globalcomfibra.cl/login" style="color: #3b82f6; text-decoration: none; font-weight: 600;">globalcomfibra.cl/login</a></p>
            <p style="margin: 8px 0; font-size: 15px;"><strong>Usuario (Email):</strong> ${email}</p>
            <p style="margin: 8px 0; font-size: 15px;"><strong>Contraseña:</strong> <em style="color: #64748b;">La contraseña temporal asignada por su ejecutivo</em></p>
          </div>

          <p style="font-size: 15px;">Desde su portal privado podrá monitorear las métricas de su enlace en tiempo real, descargar sus contratos vigentes y acceder a su historial de facturación mensual.</p>

          <div style="text-align: center; margin: 45px 0 20px 0;">
            <a href="https://globalcomfibra.cl/login" style="background-color: #1a1f2e; color: #ffffff; padding: 16px 36px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; transition: background-color 0.3s;">Acceder al Portal NOC</a>
          </div>
        </div>

        <div style="background-color: #f1f5f9; padding: 25px 20px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #475569; font-size: 12px; margin: 0 0 12px 0;">
            <strong>Servicio de Telecomunicaciones Globalcom Ltda.</strong><br>
            <span style="color: #64748b; font-size: 11px;">Infraestructura de Fibra Óptica | Región Metropolitana a Los Ríos</span>
          </p>
          <p style="color: #94a3b8; font-size: 10px; margin: 0; text-transform: uppercase; letter-spacing: 1px;">
            Desarrollo y Tecnología © FocusFrame Media SpA
          </p>
        </div>
      </div>
    `;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Globalcom <onboarding@resend.dev>', // Luego puedes usar tu propio dominio
        to: [email, clientData.correo_facturacion],
        subject: `Bienvenido a Globalcom - Activación de Cuenta: ${clientData.empresa}`,
        html: emailHtml,
      }),
    });

    return new Response(JSON.stringify({ message: "Cliente creado y correos enviados" }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 
    })

  } catch (error) {
    
    console.error("🔥 ERROR DETECTADO:", error.message);

    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 
    })
  }
})