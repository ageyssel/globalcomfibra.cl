import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { audit, errorResponse, handleOptions, HttpError, json, requireIdentity, text } from "../_shared/platform.ts";

serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json(req, { error: "Método no permitido." }, 405);

  try {
    const { user, admin } = await requireIdentity(req, ["superadmin", "admin", "finance"]);
    const body = await req.json();
    const amount = Number(body.amount);
    const allocations = Array.isArray(body.allocations) ? body.allocations : [];

    if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, "Monto inválido.");
    if (!allocations.length) throw new HttpError(400, "Debe seleccionar al menos una factura.");

    const normalized = allocations.map((item: Record<string, unknown>) => ({
      invoiceId: text(item.invoiceId, 80),
      amount: Number(item.amount),
    }));

    if (normalized.some((item) => !item.invoiceId || !Number.isFinite(item.amount) || item.amount <= 0)) {
      throw new HttpError(400, "La distribución del pago es inválida.");
    }

    const { data, error } = await admin.rpc("register_supplier_payment_v2", {
      p_payment_date: text(body.paymentDate, 10),
      p_amount: amount,
      p_method: text(body.method, 80),
      p_allocations: normalized,
      p_bank: text(body.bank, 120) || null,
      p_source_account: text(body.sourceAccount, 120) || null,
      p_operation_number: text(body.operationNumber, 180) || null,
      p_accounting_reference: text(body.accountingReference, 180) || null,
      p_provider_reference: text(body.providerReference, 180) || null,
      p_receipt_storage_path: text(body.receiptPath, 700) || null,
      p_notes: text(body.notes, 1000) || null,
      p_payment_code: text(body.paymentCode, 80) || null,
    });

    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;

    await audit(admin, user, "register_payment", "finance", {
      record_type: "payments",
      record_id: result?.payment_id,
      record_label: result?.payment_code,
      amount,
      allocations: normalized,
      method: body.method,
    });

    return json(req, {
      success: true,
      paymentId: result?.payment_id,
      paymentCode: result?.payment_code,
    }, 201);
  } catch (cause) {
    return errorResponse(req, cause);
  }
});
