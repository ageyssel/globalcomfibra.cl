import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { errorResponse, handleOptions, HttpError, json, requireIdentity, text } from "../_shared/platform.ts";
serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== "POST") return json(req, { error: "Método no permitido." }, 405);
  try {
    const { user, role, admin } = await requireIdentity(req); const body = await req.json(); const bucket = text(body.bucket, 80); const path = text(body.path, 700);
    if (!path || !["contracts","customer-invoices","ticket-attachments"].includes(bucket)) throw new HttpError(400, "Documento inválido.");
    const staff = ["superadmin","admin","finance","commercial","support","readonly"].includes(role);
    if (!staff) {
      if (!user.email) throw new HttpError(403, "Acceso denegado.");
      if (bucket === "contracts") {
        const { data } = await admin.from("clientes").select("rut").eq("email", user.email).eq("url_contrato", path).limit(1).maybeSingle(); if (!data) throw new HttpError(403, "El documento no pertenece a tu cuenta.");
      } else if (bucket === "customer-invoices") {
        const { data } = await admin.from("facturas").select("id").eq("email_cliente", user.email).or(`storage_path.eq.${path},url_archivo.eq.${path}`).limit(1).maybeSingle(); if (!data) throw new HttpError(403, "El documento no pertenece a tu cuenta.");
      } else {
        const { data } = await admin.from("tickets").select("id,url_archivo,seguimiento").eq("email_cliente", user.email).limit(250); const found = data?.some((ticket) => ticket.url_archivo === path || (Array.isArray(ticket.seguimiento) && ticket.seguimiento.some((item: { adjunto?: string }) => item.adjunto === path))); if (!found) throw new HttpError(403, "El documento no pertenece a tu cuenta.");
      }
    }
    const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 300); if (error || !data?.signedUrl) throw new HttpError(404, "No fue posible generar el enlace temporal.");
    return json(req, { signedUrl: data.signedUrl });
  } catch (cause) { return errorResponse(req, cause); }
});
