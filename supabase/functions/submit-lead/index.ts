import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { adminClient, email, errorResponse, handleOptions, htmlEscape, HttpError, json, sendEmail, text } from "../_shared/platform.ts";

async function fingerprint(req: Request) {
  const value = `${req.headers.get("x-forwarded-for") ?? "unknown"}|${req.headers.get("user-agent") ?? "unknown"}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== "POST") return json(req, { error: "Método no permitido." }, 405);
  try {
    const payload = await req.json();
    if (text(payload.website, 100)) return json(req, { success: true });
    const company = text(payload.company, 160); const name = text(payload.name, 120); const contactEmail = email(payload.email);
    const phone = text(payload.phone, 40); const commune = text(payload.commune, 100); const service = text(payload.service, 120); const message = text(payload.message, 1500);
    if (company.length < 2 || name.length < 2 || phone.length < 6 || commune.length < 2) throw new HttpError(400, "Completa correctamente los campos obligatorios.");
    const admin = adminClient(); const key = await fingerprint(req); const now = Date.now();
    const { data: rate } = await admin.from("public_form_rate_limits").select("attempts,window_started_at").eq("fingerprint", key).maybeSingle();
    const started = rate?.window_started_at ? new Date(rate.window_started_at).getTime() : 0;
    if (rate && now - started < 60 * 60 * 1000 && rate.attempts >= 5) throw new HttpError(429, "Has enviado varias solicitudes. Intenta nuevamente más tarde.");
    if (!rate || now - started >= 60 * 60 * 1000) await admin.from("public_form_rate_limits").upsert({ fingerprint: key, attempts: 1, window_started_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    else await admin.from("public_form_rate_limits").update({ attempts: rate.attempts + 1, updated_at: new Date().toISOString() }).eq("fingerprint", key);
    const { data, error: insertError } = await admin.from("commercial_leads").insert({ company_name: company, contact_name: name, email: contactEmail, phone, commune, requested_service: service, message: message || null, source: text(payload.source, 80) || "website" }).select("id").single();
    if (insertError) throw insertError;
    await sendEmail({ to: Deno.env.get("LEADS_NOTIFICATION_EMAIL") ?? "contacto@globalcomfibra.cl", subject: `Nueva solicitud de factibilidad: ${company}`, replyTo: contactEmail, html: `<h2>Nueva solicitud comercial</h2><p><strong>Empresa:</strong> ${htmlEscape(company)}</p><p><strong>Contacto:</strong> ${htmlEscape(name)}</p><p><strong>Correo:</strong> ${htmlEscape(contactEmail)}</p><p><strong>Teléfono:</strong> ${htmlEscape(phone)}</p><p><strong>Comuna:</strong> ${htmlEscape(commune)}</p><p><strong>Servicio:</strong> ${htmlEscape(service)}</p><p>${htmlEscape(message)}</p>` });
    return json(req, { success: true, leadId: data.id }, 201);
  } catch (cause) { return errorResponse(req, cause); }
});
