"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, LoaderCircle, MessageSquare, RefreshCw, Search, Send } from "@/components/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { TicketMessage, TicketRecord } from "@/lib/types";
import { formatDate } from "@/lib/format";

function safeFileName(name: string) { return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120); }

export function SupportManager({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<TicketRecord[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [search, setSearch] = useState(""); const [state, setState] = useState("Todos"); const [selected, setSelected] = useState<TicketRecord | null>(null); const [reply, setReply] = useState(""); const [file, setFile] = useState<File | null>(null); const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const supabase = getSupabaseBrowserClient();
    const { data, error: loadError } = await supabase.from("tickets").select("id,email_cliente,empresa,asunto,descripcion,prioridad,estado,seguimiento,created_at").order("created_at", { ascending: false }).limit(250);
    if (loadError) setError(loadError.message); else setRows((data ?? []) as TicketRecord[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => rows.filter((row) => {
    const term = search.trim().toLowerCase(); const matchesText = !term || `${row.id} ${row.empresa ?? ""} ${row.email_cliente} ${row.asunto}`.toLowerCase().includes(term); const matchesState = state === "Todos" || row.estado === state; return matchesText && matchesState;
  }), [rows, search, state]);

  async function uploadAttachment(ticketId: number) {
    if (!file) return null;
    if (file.size > 10 * 1024 * 1024) throw new Error("El archivo supera el máximo de 10 MB.");
    const supabase = getSupabaseBrowserClient(); const { data: userData } = await supabase.auth.getUser(); if (!userData.user) throw new Error("Sesión expirada.");
    const path = `${userData.user.id}/${ticketId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage.from("ticket-attachments").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (uploadError) throw uploadError; return path;
  }

  async function sendReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || !reply.trim()) return; setSending(true); setError("");
    try {
      const attachmentPath = await uploadAttachment(selected.id);
      const supabase = getSupabaseBrowserClient(); const { data, error: invokeError } = await supabase.functions.invoke("ticket-message", { body: { ticketId: selected.id, message: reply.trim(), attachmentPath } });
      if (invokeError || data?.error) throw new Error(data?.error ?? invokeError?.message ?? "No fue posible enviar la respuesta.");
      setReply(""); setFile(null); await load();
      const { data: refreshed } = await supabase.from("tickets").select("id,email_cliente,empresa,asunto,descripcion,prioridad,estado,seguimiento,created_at").eq("id", selected.id).single();
      setSelected(refreshed as TicketRecord);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible responder."); }
    finally { setSending(false); }
  }

  async function changeState(nextState: string) {
    if (!selected) return; setSending(true); setError("");
    try { const supabase = getSupabaseBrowserClient(); const { data, error: invokeError } = await supabase.functions.invoke("ticket-status", { body: { ticketId: selected.id, status: nextState } }); if (invokeError || data?.error) throw new Error(data?.error ?? invokeError?.message ?? "No fue posible actualizar el ticket."); setSelected({ ...selected, estado: nextState }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible actualizar."); }
    finally { setSending(false); }
  }

  async function openAttachment(path: string) {
    if (/^https?:\/\//i.test(path)) { window.open(path, "_blank", "noopener,noreferrer"); return; }
    const { data, error: signedError } = await getSupabaseBrowserClient().storage.from("ticket-attachments").createSignedUrl(path, 300);
    if (signedError || !data?.signedUrl) { setError("No fue posible abrir el archivo adjunto."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const messages = (selected?.seguimiento ?? []) as TicketMessage[];
  return <div className="admin-page">
    <div className="admin-heading"><div><h1>Soporte e incidencias</h1><p>Seguimiento centralizado de tickets y cambios de estado.</p></div><button className="button-secondary !w-auto" onClick={() => void load()}><RefreshCw size={17} /> Actualizar</button></div>
    {error && <div className="alert alert-error">{error}</div>}
    <section className="surface p-4"><div className="grid gap-3 md:grid-cols-[1fr_220px]"><div className="field"><label htmlFor="ticket-search">Buscar</label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input id="ticket-search" className="!pl-10" placeholder="ID, empresa, correo o asunto" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div><div className="field"><label htmlFor="ticket-state">Estado</label><select id="ticket-state" value={state} onChange={(e) => setState(e.target.value)}><option>Todos</option><option>Nuevo</option><option>Asignado</option><option>En análisis</option><option>En terreno</option><option>Esperando cliente</option><option>Esperando proveedor</option><option>Resuelto</option><option>Cerrado</option><option>Reabierto</option></select></div></div></section>
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Ticket</th><th>Cliente</th><th>Asunto</th><th>Prioridad</th><th>Estado</th><th>Creación</th></tr></thead><tbody>{loading ? Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={6}><div className="skeleton h-10" /></td></tr>) : filtered.length === 0 ? <tr><td colSpan={6} className="py-12 text-center text-slate-500">No hay tickets para los filtros seleccionados.</td></tr> : filtered.map((ticket) => <tr key={ticket.id} className="cursor-pointer" onClick={() => setSelected(ticket)}><td><strong className="font-mono text-blue-700">#{ticket.id}</strong></td><td><strong className="block">{ticket.empresa || ticket.email_cliente}</strong><span className="mt-1 block text-xs text-slate-500">{ticket.email_cliente}</span></td><td><span className="font-bold">{ticket.asunto}</span><span className="mt-1 block text-xs text-slate-500">{ticket.seguimiento?.length ?? 0} respuesta(s)</span></td><td><span className={`badge ${ticket.prioridad === "Alta" || ticket.prioridad === "Crítica" ? "badge-red" : ticket.prioridad === "Media" ? "badge-orange" : "badge-blue"}`}>{ticket.prioridad}</span></td><td><span className={`badge ${["Resuelto","Cerrado"].includes(ticket.estado) ? "badge-green" : "badge-slate"}`}>{ticket.estado}</span></td><td className="text-sm text-slate-500">{formatDate(ticket.created_at)}</td></tr>)}</tbody></table></div>
    {selected && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Ticket ${selected.id}`}><div className="modal-card !max-w-4xl"><div className="modal-header"><div><p className="eyebrow">Ticket #{selected.id}</p><h2 className="mt-2 text-2xl font-black">{selected.asunto}</h2><p className="mt-2 text-sm text-slate-500">{selected.empresa || selected.email_cliente}</p></div><button className="button-secondary !w-auto !px-3 !py-2" onClick={() => setSelected(null)}>Cerrar</button></div><div className="modal-body grid gap-5">
      <div className="grid gap-3 md:grid-cols-[1fr_220px]"><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-500">Descripción inicial</p><p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">{selected.descripcion || "Sin descripción."}</p></div>{canEdit ? <div className="field"><label htmlFor="support-state">Estado</label><select id="support-state" value={selected.estado} disabled={sending} onChange={(e) => void changeState(e.target.value)}><option>Nuevo</option><option>Asignado</option><option>En análisis</option><option>En terreno</option><option>Esperando cliente</option><option>Esperando proveedor</option><option>Resuelto</option><option>Cerrado</option><option>Reabierto</option></select></div> : <div><span className="badge badge-slate">{selected.estado}</span></div>}</div>
      <section><h3 className="flex items-center gap-2 text-lg font-black"><MessageSquare size={19} /> Conversación</h3><div className="mt-3 grid max-h-[340px] gap-3 overflow-y-auto rounded-xl bg-slate-50 p-3">{messages.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">Aún no hay respuestas.</p> : messages.map((message, index) => <article key={`${message.fecha}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><strong className="text-sm">{message.autor}</strong><time className="text-xs text-slate-400">{formatDate(message.fecha)}</time></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{message.mensaje}</p>{message.adjunto && <button type="button" className="mt-3 inline-flex items-center gap-2 text-xs font-black text-blue-700" onClick={() => void openAttachment(message.adjunto!)}>Abrir adjunto <ExternalLink size={14} /></button>}</article>)}</div></section>
      {canEdit && <form className="grid gap-3 border-t border-slate-200 pt-5" onSubmit={sendReply}><div className="field"><label htmlFor="support-reply">Respuesta técnica</label><textarea id="support-reply" rows={3} required maxLength={4000} value={reply} onChange={(e) => setReply(e.target.value)} /></div><div className="field"><label htmlFor="support-file">Adjunto opcional</label><input id="support-file" type="file" accept="image/*,.pdf,.doc,.docx,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /><small>Máximo 10 MB. El archivo se almacena de forma privada.</small></div><button className="button-primary md:w-fit" disabled={sending || !reply.trim()}>{sending ? <><LoaderCircle className="animate-spin" size={18} /> Enviando…</> : <><Send size={17} /> Enviar respuesta</>}</button></form>}
    </div></div></div>}
  </div>;
}
