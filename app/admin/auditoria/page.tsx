import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ modulo?: string }> }) {
  const params = await searchParams;
  const supabase = await getSupabaseServerClient();
  let query = supabase.from("audit_logs").select("id,user_email,action,module,record_type,record_id,record_label,created_at,ip_address,context").order("created_at", { ascending: false }).limit(250);
  if (params.modulo) query = query.eq("module", params.modulo);
  const { data, error } = await query;
  return <div className="admin-page"><div className="admin-heading"><div><h1>Auditoría y trazabilidad</h1><p>Registro de acciones sensibles y cambios operacionales.</p></div></div>{error && <div className="alert alert-error">{error.message}</div>}<section className="surface p-4"><form className="grid gap-3 md:grid-cols-[260px_auto]"><div className="field"><label htmlFor="audit-module">Módulo</label><select id="audit-module" name="modulo" defaultValue={params.modulo ?? ""}><option value="">Todos</option><option value="auth">Autenticación</option><option value="clients">Clientes</option><option value="support">Soporte</option><option value="finance">Finanzas</option><option value="storage">Documentos</option><option value="permissions">Permisos</option></select></div><button className="button-primary self-end md:w-fit">Filtrar</button></form></section><div className="table-wrap"><table className="data-table"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Módulo</th><th>Registro</th><th>IP</th></tr></thead><tbody>{data?.length ? data.map((entry) => <tr key={entry.id}><td className="whitespace-nowrap text-sm">{formatDate(entry.created_at)}</td><td><strong>{entry.user_email || "Sistema"}</strong></td><td>{entry.action}</td><td><span className="badge badge-blue">{entry.module}</span></td><td><strong className="block">{entry.record_label || entry.record_type || "—"}</strong>{entry.record_id && <span className="mt-1 block font-mono text-xs text-slate-500">{entry.record_id}</span>}</td><td className="font-mono text-xs text-slate-500">{entry.ip_address || "—"}</td></tr>) : <tr><td colSpan={6} className="py-12 text-center text-slate-500">No hay eventos para los filtros seleccionados.</td></tr>}</tbody></table></div></div>;
}
