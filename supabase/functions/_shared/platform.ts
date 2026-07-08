import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.8";

export type Role = "superadmin" | "admin" | "finance" | "commercial" | "support" | "readonly" | "client";

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://globalcomfibra.cl,https://www.globalcomfibra.cl,http://localhost:3000")
  .split(",").map((value) => value.trim()).filter(Boolean);

export function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? "https://globalcomfibra.cl";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Vary": "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

export function handleOptions(req: Request) {
  return req.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders(req) }) : null;
}

export function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) throw new Error("Configuración de Supabase incompleta.");
  return createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function authenticatedClient(req: Request) {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = req.headers.get("authorization") ?? "";
  if (!url || !anonKey || !authorization) throw new HttpError(401, "Sesión requerida.");
  return createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
}

export async function requireIdentity(req: Request, allowedRoles?: Role[]): Promise<{ user: User; role: Role; admin: SupabaseClient }> {
  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Sesión requerida.");
  const admin = adminClient();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) throw new HttpError(401, "Sesión inválida o expirada.");
  const { data: profile, error: profileError } = await admin.from("app_users").select("role,active").eq("user_id", userData.user.id).maybeSingle();
  if (profileError) throw new Error("No fue posible validar el perfil.");
  const role = (profile?.role ?? "client") as Role;
  if (profile && profile.active === false) throw new HttpError(403, "Usuario desactivado.");
  if (allowedRoles && !allowedRoles.includes(role)) throw new HttpError(403, "No tienes permisos para realizar esta acción.");
  return { user: userData.user, role, admin };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function errorResponse(req: Request, cause: unknown) {
  const status = cause instanceof HttpError ? cause.status : 500;
  const message = cause instanceof HttpError ? cause.message : cause instanceof Error && status < 500 ? cause.message : "Ocurrió un error interno.";
  if (status >= 500) console.error(cause);
  return json(req, { error: message }, status);
}

export function text(value: unknown, max = 500) {
  return String(value ?? "").trim().replace(/[\u0000-\u001F\u007F]/g, " ").slice(0, max);
}

export function email(value: unknown) {
  const normalized = text(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new HttpError(400, "Correo electrónico inválido.");
  return normalized;
}

export function normalizeRut(value: unknown) {
  const compact = text(value, 20).toUpperCase().replace(/[^0-9K]/g, "");
  if (compact.length < 8 || compact.length > 9) throw new HttpError(400, "RUT inválido.");
  return `${compact.slice(0, -1)}-${compact.slice(-1)}`;
}

export function htmlEscape(value: unknown) {
  return text(value, 5000).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export async function audit(admin: SupabaseClient, user: User | null, action: string, module: string, details: Record<string, unknown>) {
  await admin.from("audit_logs").insert({ user_id: user?.id ?? null, user_email: user?.email ?? null, action, module, record_type: details.record_type ?? null, record_id: String(details.record_id ?? "") || null, record_label: details.record_label ?? null, context: details });
}

export async function sendEmail(message: { to: string | string[]; subject: string; html: string; replyTo?: string }) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return { skipped: true };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: Deno.env.get("MAIL_FROM") ?? "Globalcom Fibra <contacto@globalcomfibra.cl>", to: message.to, subject: message.subject, html: message.html, reply_to: message.replyTo }),
  });
  if (!response.ok) throw new Error(`Proveedor de correo respondió ${response.status}.`);
  return await response.json();
}
