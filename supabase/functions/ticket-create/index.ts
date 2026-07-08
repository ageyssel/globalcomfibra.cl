import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { audit, errorResponse, handleOptions, htmlEscape, HttpError, json, requireIdentity, sendEmail, text } from "../_shared/platform.ts";

serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== "POST") return json(req, { error: "Método no permitido." }, 405);
  try {
    const { user, admin } = await requireIdentity(req);
    if (!user.email) throw new HttpError(400, "Tu usuario no tiene correo asociado.");
    const body = await req.json(); const subject = text(body.asunto, 140); const description = text(body.descripcion, 4000); const priority = text(body.prioridad, 20); const attachmentPath = text(body.attachmentPath, 600) || null;
    if (subject.length < 5 || description.length < 10) throw new HttpError(400, "El asunto y la descripción son obligatorios.");
    if (!["Baja","Media","Alta"].includes(priority)) throw new HttpError(400, "Prioridad inválida.");
    if (attachmentPath && !attachmentPath.startsWith(`${user.id}/`)) throw new HttpError(400, "Adjunto inválido.");
    const { data: client } = await admin.from("clientes").select("empresa,email").eq("email", user.email).limit(1).maybeSingle();
    if (!client) throw new HttpError(404, "No encontramos un cliente asociado a tu correo.");
    const { data: ticket, error: insertError } = await admin.from("tickets").insert({ email_cliente: user.email, empresa: client.empresa, asunto: subject, descripcion: description, prioridad: priority, estado: "Nuevo", url_archivo: attachmentPath, seguimiento: [] }).select("id").single();
    if (insertError) throw insertError;
    await audit(admin, user, "create", "support", { record_type: "tickets", record_id: ticket.id, record_label: subject });
    await sendEmail({ to: Deno.env.get("SUPPORT_NOTIFICATION_EMAIL") ?? "contacto@globalcomfibra.cl", subject: `Nuevo ticket #${ticket.id}: ${subject}`, replyTo: user.email, html: `<h2>Nuevo ticket de soporte</h2><p><strong>Cliente:</strong> ${htmlEscape(client.empresa)}</p><p><strong>Prioridad:</strong> ${htmlEscape(priority)}</p><p>${htmlEscape(description)}</p>` });
    return json(req, { success: true, ticketId: ticket.id }, 201);
  } catch (cause) { return errorResponse(req, cause); }
});
