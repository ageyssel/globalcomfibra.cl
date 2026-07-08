import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { audit, errorResponse, handleOptions, HttpError, json, normalizeRut, requireIdentity, text } from "../_shared/platform.ts";

serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== "POST") return json(req, { error: "Método no permitido." }, 405);
  try {
    const { user, admin } = await requireIdentity(req, ["superadmin","admin","finance"]);
    const body = await req.json(); const rut = normalizeRut(body.rut); const net = Number(body.neto); const total = Number(body.total); const month = text(body.mes, 20); const issueDate = text(body.fecha, 10); const base64 = text(body.fileBase64, 25_000_000);
    if (!Number.isFinite(net) || !Number.isFinite(total) || total <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(issueDate) || !/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, "Datos de factura inválidos.");
    if (!base64) throw new HttpError(400, "El PDF es obligatorio.");
    const { data: clients, error: clientError } = await admin.from("clientes").select("email,empresa,rut,correo_facturacion,dias_pago"); if (clientError) throw clientError;
    const normalized = rut.replace(/[^0-9K]/g, ""); const client = clients?.find((item) => String(item.rut ?? "").toUpperCase().replace(/[^0-9K]/g, "") === normalized);
    if (!client) throw new HttpError(404, `No existe un cliente con RUT ${rut}.`);
    let bytes: Uint8Array;
    try { const binary = atob(base64.replace(/^data:application\/pdf;base64,/, "")); bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0)); } catch { throw new HttpError(400, "El PDF no tiene un formato válido."); }
    if (bytes.byteLength > 15 * 1024 * 1024) throw new HttpError(413, "El PDF supera el máximo de 15 MB.");
    const path = `${String(client.rut).replace(/[^0-9K]/gi, "")}/${month}/${crypto.randomUUID()}.pdf`;
    const { error: uploadError } = await admin.storage.from("customer-invoices").upload(path, bytes, { contentType: "application/pdf", upsert: false }); if (uploadError) throw uploadError;
    const days = Math.max(0, Number(client.dias_pago ?? 30)); const due = new Date(`${issueDate}T12:00:00Z`); due.setUTCDate(due.getUTCDate() + days); const state = due.getTime() < Date.now() ? "Vencida" : "Pendiente";
    const { data: invoice, error: insertError } = await admin.from("facturas").insert({ email_cliente: client.email, mes_anio: month, url_archivo: path, storage_path: path, valor_neto: net, valor_total: total, fecha_emision: issueDate, estado: state }).select("id").single();
    if (insertError) { await admin.storage.from("customer-invoices").remove([path]); throw insertError; }
    await audit(admin, user, "create", "finance", { record_type: "facturas", record_id: invoice.id, record_label: `${client.empresa} ${month}`, due_date: due.toISOString().slice(0,10) });
    return json(req, { success: true, company: client.empresa, invoiceId: invoice.id }, 201);
  } catch (cause) { return errorResponse(req, cause); }
});
