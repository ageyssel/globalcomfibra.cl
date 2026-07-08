import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { authenticatedClient, audit, errorResponse, handleOptions, HttpError, json, requireIdentity, text } from "../_shared/platform.ts";
serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== "POST") return json(req, { error: "Método no permitido." }, 405);
  try {
    const { user, admin } = await requireIdentity(req, ["superadmin","admin","finance"]); const body = await req.json(); const invoiceId = text(body.invoiceId, 50); const amount = Number(body.amount);
    if (!/^[0-9a-f-]{36}$/i.test(invoiceId) || !Number.isFinite(amount) || amount <= 0) throw new HttpError(400, "Datos de pago inválidos.");
    const caller = authenticatedClient(req); const { data, error } = await caller.rpc("register_supplier_payment", { p_invoice_id: invoiceId, p_payment_date: text(body.paymentDate, 10), p_amount: amount, p_method: text(body.method, 60), p_bank: text(body.bank, 100) || null, p_source_account: text(body.sourceAccount, 100) || null, p_operation_number: text(body.operationNumber, 100) || null, p_receipt_storage_path: text(body.receiptPath, 600) || null, p_notes: text(body.notes, 1000) || null });
    if (error) throw error;
    await audit(admin, user, "payment", "finance", { record_type: "supplier_invoices", record_id: invoiceId, payment_id: data, amount });
    return json(req, { success: true, paymentId: data }, 201);
  } catch (cause) { return errorResponse(req, cause); }
});
