import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { audit, errorResponse, handleOptions, HttpError, json, requireIdentity, text } from "../_shared/platform.ts";

serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json(req, { error: "Método no permitido." }, 405);

  try {
    const { user, admin } = await requireIdentity(req, ["superadmin", "admin", "finance"]);
    const body = await req.json();
    const paymentId = text(body.paymentId, 80);
    const reason = text(body.reason, 500);

    if (!paymentId) throw new HttpError(400, "Pago inválido.");
    if (reason.length < 5) throw new HttpError(400, "Debe informar el motivo de la reversa.");

    const { error } = await admin.rpc("reverse_supplier_payment", {
      p_payment_id: paymentId,
      p_reason: reason,
    });
    if (error) throw error;

    await audit(admin, user, "reverse_payment", "finance", {
      record_type: "payments",
      record_id: paymentId,
      reason,
    });

    return json(req, { success: true });
  } catch (cause) {
    return errorResponse(req, cause);
  }
});
