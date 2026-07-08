"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, LoaderCircle, Pencil, Plus, RefreshCw, Search } from "@/components/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ClientRecord } from "@/lib/types";
import { normalizeRut } from "@/lib/format";

const pageSize = 25;
const emptyForm = { empresa: "", rut: "", email: "", password: "", contacto: "", correo_facturacion: "", direccion: "", plan: "Internet Dedicado", dias_pago: "30", estado: "Activo" };

function escapeSearch(value: string) { return value.replace(/[(),.%]/g, " ").trim(); }
function csvValue(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

export function ClientsManager({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<ClientRecord[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const [search, setSearch] = useState(""); const [status, setStatus] = useState("Todos"); const [page, setPage] = useState(0); const [count, setCount] = useState(0);
  const [modal, setModal] = useState<"create" | "edit" | null>(null); const [selected, setSelected] = useState<ClientRecord | null>(null); const [form, setForm] = useState(emptyForm); const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const supabase = getSupabaseBrowserClient();
    let query = supabase.from("clientes").select("id,empresa,rut,email,contacto,correo_facturacion,direccion,plan,estado,dias_pago,id_cliente,fecha_inicio,contrato_meses,url_dashboard,url_contrato,created_at", { count: "exact" });
    const clean = escapeSearch(search);
    if (clean) query = query.or(`empresa.ilike.%${clean}%,rut.ilike.%${clean}%,email.ilike.%${clean}%`);
    if (status !== "Todos") query = query.eq("estado", status);
    const { data, error: loadError, count: total } = await query.order("empresa", { ascending: true }).range(page * pageSize, page * pageSize + pageSize - 1);
    if (loadError) setError(loadError.message); else { setRows((data ?? []) as ClientRecord[]); setCount(total ?? 0); }
    setLoading(false);
  }, [page, search, status]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(0); }, [search, status]);
  const pages = Math.max(1, Math.ceil(count / pageSize));

  function openCreate() { setSelected(null); setForm(emptyForm); setModal("create"); setError(""); setSuccess(""); }
  function openEdit(row: ClientRecord) { setSelected(row); setForm({ empresa: row.empresa ?? "", rut: row.rut ?? "", email: row.email ?? "", password: "", contacto: row.contacto ?? "", correo_facturacion: row.correo_facturacion ?? "", direccion: row.direccion ?? "", plan: row.plan ?? "", dias_pago: String(row.dias_pago ?? 30), estado: row.estado ?? "Activo" }); setModal("edit"); setError(""); setSuccess(""); }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    const supabase = getSupabaseBrowserClient();
    try {
      const payload = { empresa: form.empresa.trim(), rut: normalizeRut(form.rut), email: form.email.trim().toLowerCase(), contacto: form.contacto.trim() || null, correo_facturacion: (form.correo_facturacion.trim() || form.email.trim()).toLowerCase(), direccion: form.direccion.trim() || null, plan: form.plan.trim() || null, dias_pago: Number(form.dias_pago) || 30, estado: form.estado };
      if (modal === "create") {
        if (form.password.length < 10) throw new Error("La contraseña inicial debe tener al menos 10 caracteres.");
        const { data, error: invokeError } = await supabase.functions.invoke("create-client", { body: { email: payload.email, password: form.password, clientData: payload } });
        if (invokeError || data?.error) throw new Error(data?.error ?? invokeError?.message ?? "No fue posible crear el cliente.");
        setSuccess("Cliente creado y acceso habilitado.");
      } else if (selected) {
        const { error: updateError } = await supabase.from("clientes").update({ empresa: payload.empresa, rut: payload.rut, contacto: payload.contacto, correo_facturacion: payload.correo_facturacion, direccion: payload.direccion, plan: payload.plan, dias_pago: payload.dias_pago, estado: payload.estado }).eq("rut", selected.rut);
        if (updateError) throw updateError;
        setSuccess("Cliente actualizado.");
      }
      setModal(null); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible guardar."); }
    finally { setSaving(false); }
  }

  function exportCsv() {
    const headers = ["ID","Empresa","RUT","Email","Contacto","Correo facturación","Dirección","Plan","Estado","Días pago"];
    const body = rows.map((row) => [row.id_cliente,row.empresa,row.rut,row.email,row.contacto,row.correo_facturacion,row.direccion,row.plan,row.estado,row.dias_pago].map(csvValue).join(","));
    const blob = new Blob(["\uFEFF" + [headers.map(csvValue).join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `clientes-globalcom-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  const rangeLabel = useMemo(() => count ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, count)} de ${count}` : "0 clientes", [count, page]);
  return <div className="admin-page">
    <div className="admin-heading"><div><h1>Gestión de clientes</h1><p>Consulta y administración sin eliminación definitiva.</p></div><div className="flex flex-wrap gap-2">{rows.length > 0 && <button className="button-secondary !w-auto" onClick={exportCsv}><Download size={17} /> Exportar vista</button>}{canEdit && <button className="button-primary !w-auto" onClick={openCreate}><Plus size={18} /> Nuevo cliente</button>}</div></div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}{success && <div className="alert alert-success" role="status">{success}</div>}
    <section className="surface p-4"><div className="grid gap-3 md:grid-cols-[1fr_220px_auto]"><div className="field"><label htmlFor="client-search">Buscar</label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input id="client-search" className="!pl-10" placeholder="Empresa, RUT o correo" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div><div className="field"><label htmlFor="client-status">Estado</label><select id="client-status" value={status} onChange={(e) => setStatus(e.target.value)}><option>Todos</option><option>Activo</option><option>Suspendido</option><option>Archivado</option></select></div><button className="button-secondary self-end !w-auto" onClick={() => void load()}><RefreshCw size={17} /> Actualizar</button></div></section>
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Cliente</th><th>RUT</th><th>Plan</th><th>Facturación</th><th>Estado</th><th className="text-right">Acción</th></tr></thead><tbody>{loading ? Array.from({ length: 6 }).map((_, index) => <tr key={index}><td colSpan={6}><div className="skeleton h-10" /></td></tr>) : rows.length === 0 ? <tr><td colSpan={6} className="py-12 text-center text-slate-500">No existen clientes para los filtros seleccionados.</td></tr> : rows.map((row) => <tr key={`${row.rut}-${row.email}`}><td><strong className="block">{row.empresa}</strong><span className="mt-1 block text-xs text-slate-500">{row.email}</span></td><td className="font-mono text-sm">{row.rut}</td><td>{row.plan || "—"}</td><td><span className="text-sm">{row.correo_facturacion || row.email}</span><span className="mt-1 block text-xs text-slate-500">{row.dias_pago ?? 30} días</span></td><td><span className={`badge ${row.estado === "Activo" ? "badge-green" : row.estado === "Suspendido" ? "badge-red" : "badge-slate"}`}>{row.estado || "Activo"}</span></td><td className="text-right">{canEdit ? <button className="button-secondary !w-auto !px-3 !py-2" onClick={() => openEdit(row)}><Pencil size={15} /> Editar</button> : <span className="text-xs text-slate-400">Solo lectura</span>}</td></tr>)}</tbody></table></div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500"><span>{rangeLabel}</span><div className="flex gap-2"><button className="button-secondary !w-auto !px-3 !py-2" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Anterior</button><span className="grid min-w-24 place-items-center rounded-xl border border-slate-200 bg-white px-3">Página {page + 1} de {pages}</span><button className="button-secondary !w-auto !px-3 !py-2" disabled={page + 1 >= pages} onClick={() => setPage((value) => value + 1)}>Siguiente</button></div></div>
    {modal && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={modal === "create" ? "Crear cliente" : "Editar cliente"}><div className="modal-card"><div className="modal-header"><div><p className="eyebrow">{modal === "create" ? "Alta segura" : "Actualización"}</p><h2 className="mt-2 text-2xl font-black">{modal === "create" ? "Nuevo cliente" : selected?.empresa}</h2></div><button className="button-secondary !w-auto !px-3 !py-2" onClick={() => setModal(null)}>Cerrar</button></div><form className="modal-body grid gap-4" onSubmit={save}><div className="grid gap-4 md:grid-cols-2"><div className="field"><label htmlFor="c-company">Razón social</label><input id="c-company" required minLength={2} value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} /></div><div className="field"><label htmlFor="c-rut">RUT</label><input id="c-rut" required value={form.rut} onChange={(e) => setForm({ ...form, rut: e.target.value })} /></div><div className="field"><label htmlFor="c-email">Correo de acceso</label><input id="c-email" type="email" required disabled={modal === "edit"} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>{modal === "create" && <div className="field"><label htmlFor="c-password">Contraseña inicial</label><input id="c-password" type="password" minLength={10} required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><small>Debe cambiarse mediante recuperación cuando corresponda.</small></div>}<div className="field"><label htmlFor="c-contact">Contacto</label><input id="c-contact" value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} /></div><div className="field"><label htmlFor="c-billing-email">Correo facturación</label><input id="c-billing-email" type="email" value={form.correo_facturacion} onChange={(e) => setForm({ ...form, correo_facturacion: e.target.value })} /></div><div className="field md:col-span-2"><label htmlFor="c-address">Dirección</label><input id="c-address" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} /></div><div className="field"><label htmlFor="c-plan">Plan</label><input id="c-plan" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} /></div><div className="field"><label htmlFor="c-days">Días de pago</label><input id="c-days" type="number" min={0} max={180} value={form.dias_pago} onChange={(e) => setForm({ ...form, dias_pago: e.target.value })} /></div>{modal === "edit" && <div className="field md:col-span-2"><label htmlFor="c-state">Estado</label><select id="c-state" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}><option>Activo</option><option>Suspendido</option><option>Archivado</option></select><small>El archivado conserva historial y evita eliminaciones accidentales.</small></div>}</div><div className="flex justify-end gap-3"><button type="button" className="button-secondary !w-auto" onClick={() => setModal(null)}>Cancelar</button><button className="button-primary !w-auto" disabled={saving}>{saving ? <><LoaderCircle className="animate-spin" size={18} /> Guardando…</> : "Guardar cliente"}</button></div></form></div></div>}
  </div>;
}
