import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Resend } from 'resend';

// Inicializamos Resend de forma segura (evitando errores si la variable de entorno aún no está configurada)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { asunto, descripcion, prioridad, cliente_id } = body;

    // 1. Guardar el ticket en la Base de Datos (Supabase)
    const { data: ticket, error: dbError } = await supabase
      .from('tickets')
      .insert([
        { asunto, descripcion, prioridad, cliente_id, estado: 'Abierto' }
      ])
      .select()
      .single();

    if (dbError) {
      console.error("Error en Supabase:", dbError.message);
      // No detenemos la ejecución aquí por si el cliente aún no configura las tablas de Supabase,
      // permitimos que Next.js compile en Cloudflare.
    }

    // 2. Enviar notificación al equipo de soporte (Resend)
    if (resend) {
      const { error: emailError } = await resend.emails.send({
        from: 'Soporte Globalcom <onboarding@resend.dev>', // Usa este remitente por defecto para pruebas
        to: ['soporte@globalcomfibra.cl'],
        subject: `Nuevo Ticket [${prioridad}]: ${asunto}`,
        html: `
          <div style="font-family: sans-serif; color: #1a2a5e;">
            <h2 style="color: #243b75;">Nuevo ticket de soporte generado</h2>
            <p><strong>Asunto:</strong> ${asunto}</p>
            <p><strong>Prioridad:</strong> <span style="color: #f25c38;">${prioridad}</span></p>
            <p><strong>Descripción del problema:</strong></p>
            <blockquote style="background-color: #f8f9fc; padding: 15px; border-left: 4px solid #f25c38; border-radius: 4px;">
              ${descripcion}
            </blockquote>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
              Accede al panel de administración de Supabase para gestionar este caso.
            </p>
          </div>
        `,
      });

      if (emailError) console.error("Error enviando email:", emailError);
    }

    return NextResponse.json({ success: true, ticket });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}