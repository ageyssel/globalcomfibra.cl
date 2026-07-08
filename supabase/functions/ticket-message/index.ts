import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { audit, errorResponse, handleOptions, htmlEscape, HttpError, json, requireIdentity, sendEmail, text } from "../_shared/platform.ts";

serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== "POST") return json(req, { error: "Método no permitido." }, 405);
  try {
    const { user, role, admin } = await requireIdentity(req);
    const body = await req.json(); const ticketId = Number(body.ticketId); const message = text(body.message, 4000); const attachmentPath = text(body.attachmentPath, 600) || null;
    if (!Number.isInteger(ticketId) || ticketId <= 0 || message.length < 1) throw new HttpError(400, "Datos de respuesta inválidos.");
    if (attachmentPath && !attachmentPath.startsWith(`${user.id}/`)) throw new HttpError(400, "Adjunto inválido.");
    const { data: ticket, error: readError } = await admin.from("tickets").select("id,email_cliente,empresa,asunto,seguimiento,estado").eq("id", ticketId).single();
    if (readError || !ticket) throw new HttpError(404, "Ticket no encontrado.");
    const staff = ["superadmin","admin","support"].includes(role);
    if (!staff && ticket.email_cliente?.toLowerCase() !== user.email?.toLowerCase()) throw new HttpError(403, "No puedes responder este ticket.");
    const tracking = Array.isArray(ticket.seguimiento) ? ticket.seguimiento : [];
    tracking.push({ autor: staff ? "Soporte Globalcom" : "Cliente", mensaje: message, fecha: new Date().toISOString(), adjunto: attachmentPath });
    const { error: updateError } = await admin.from("tickets").update({ seguimiento: tracking, estado: staff ? ticket.estado : (ticket.estado === "Cerrado" ? "Reabierto" : ticket.estado) }).eq("id", ticketId);
    if (updateError) throw updateError;
    await audit(admin, user, "message", "support", { record_type: "tickets", record_id: ticketId, record_label: ticket.asunto });
    await sendEmail({ to: staff ? ticket.email_cliente : (Deno.env.get("SUPPORT_NOTIFICATION_EMAIL") ?? "contacto@globalcomfibra.cl"), subject: `Actualización ticket #${ticketId}: ${ticket.asunto}`, html: `<p>${htmlEscape(message)}</p>` });
    return json(req, { success: true });
  } catch (cause) { return errorResponse(req, cause); }
});
