import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { audit, errorResponse, handleOptions, HttpError, json, requireIdentity, text } from "../_shared/platform.ts";
const states = ["Nuevo","Asignado","En análisis","En terreno","Esperando cliente","Esperando proveedor","Resuelto","Cerrado","Reabierto"];
serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== "POST") return json(req, { error: "Método no permitido." }, 405);
  try {
    const { user, admin } = await requireIdentity(req, ["superadmin","admin","support"]); const body = await req.json(); const ticketId = Number(body.ticketId); const status = text(body.status, 40);
    if (!Number.isInteger(ticketId) || !states.includes(status)) throw new HttpError(400, "Estado inválido.");
    const { data, error } = await admin.from("tickets").update({ estado: status }).eq("id", ticketId).select("id,asunto").single(); if (error) throw error;
    await audit(admin, user, "status_change", "support", { record_type: "tickets", record_id: ticketId, record_label: data.asunto, status });
    return json(req, { success: true });
  } catch (cause) { return errorResponse(req, cause); }
});
