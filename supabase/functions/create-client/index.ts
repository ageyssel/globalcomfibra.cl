import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { audit, email, errorResponse, handleOptions, HttpError, json, normalizeRut, requireIdentity, text } from "../_shared/platform.ts";

serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== "POST") return json(req, { error: "Método no permitido." }, 405);
  try {
    const { user, admin } = await requireIdentity(req, ["superadmin", "admin", "commercial"]);
    const payload = await req.json(); const clientEmail = email(payload.email); const password = text(payload.password, 200); const clientData = payload.clientData ?? {};
    if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) throw new HttpError(400, "La contraseña temporal debe tener al menos 10 caracteres, mayúsculas, minúsculas y números.");
    const empresa = text(clientData.empresa, 180); const rut = normalizeRut(clientData.rut);
    if (empresa.length < 2) throw new HttpError(400, "La razón social es obligatoria.");
    const { data: duplicate } = await admin.from("clientes").select("rut,email").or(`rut.eq.${rut},email.eq.${clientEmail}`).limit(1);
    if (duplicate?.length) throw new HttpError(409, "Ya existe un cliente con el mismo RUT o correo.");
    let createdUserId: string | null = null;
    const { data: existingProfile } = await admin.from("app_users").select("user_id,email").eq("email", clientEmail).maybeSingle();
    let authUserId = existingProfile?.user_id as string | undefined;
    if (!authUserId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({ email: clientEmail, password, email_confirm: true, user_metadata: { full_name: text(clientData.contacto, 160), company: empresa } });
      if (createError || !created.user) throw new HttpError(400, `No fue posible crear el acceso: ${createError?.message ?? "error desconocido"}`);
      authUserId = created.user.id; createdUserId = created.user.id;
    }
    const allowed = ["empresa","contacto","contacto_facturacion","correo_facturacion","direccion","plan","ip","estado","dias_pago","id_cliente","fecha_inicio","contrato_meses","url_dashboard","url_contrato"];
    const record: Record<string, unknown> = { email: clientEmail, rut };
    for (const key of allowed) if (clientData[key] !== undefined) record[key] = typeof clientData[key] === "string" ? text(clientData[key], 500) || null : clientData[key];
    const { error: insertError } = await admin.from("clientes").insert(record);
    if (insertError) { if (createdUserId) await admin.auth.admin.deleteUser(createdUserId); throw insertError; }
    await admin.from("app_users").upsert({ user_id: authUserId, email: clientEmail, full_name: text(clientData.contacto, 160) || null, role: "client", active: true });
    await audit(admin, user, "create", "clients", { record_type: "clientes", record_id: rut, record_label: empresa });
    return json(req, { success: true }, 201);
  } catch (cause) { return errorResponse(req, cause); }
});
