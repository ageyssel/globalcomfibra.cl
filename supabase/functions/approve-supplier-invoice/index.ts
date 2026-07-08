import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { authenticatedClient, audit, errorResponse, handleOptions, HttpError, json, requireIdentity, text } from "../_shared/platform.ts";
serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== "POST") return json(req, { error: "Método no permitido." }, 405);
  try {
    const { user, admin } = await requireIdentity(req, ["superadmin","admin","finance"]); const body = await req.json(); const invoiceId = text(body.invoiceId, 50); const action = text(body.action, 30); const status = action === "approve" ? "pending_payment" : action === "observe" ? "observed" : action === "reject" ? "rejected" : "";
    if (!/^[0-9a-f-]{36}$/i.test(invoiceId) || !status) throw new HttpError(400, "Acción inválida.");
    const caller = authenticatedClient(req); const { error } = await caller.rpc("approve_supplier_invoice", { p_invoice_id: invoiceId, p_status: status, p_notes: text(body.notes, 1000) || null }); if (error) throw error;
    await audit(admin, user, "approve", "finance", { record_type: "supplier_invoices", record_id: invoiceId, status });
    return json(req, { success: true });
  } catch (cause) { return errorResponse(req, cause); }
});
