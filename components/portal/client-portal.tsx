"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileText, Headphones, LoaderCircle, LogOut, MessageSquarePlus, RefreshCw, Send, Wifi } from "@/components/icons";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatClp, formatDate } from "@/lib/format";
import type { ClientRecord, TicketMessage, TicketRecord } from "@/lib/types";

type CustomerInvoice = {
  id?: string | number;
  mes_anio?: string | null;
  fecha_emision?: string | null;
  valor_total?: number | null;
  estado?: string | null;
  url_archivo?: string | null;
  storage_path?: string | null;
};

const initialTicket = { asunto: "", descripcion: "", prioridad: "Media" };

function safeFileName(name: string) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
}

export function ClientPortal({ email }: { email: string }) {
  const router = useRouter();
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [ticketModal, setTicketModal] = useState(false);
  const [ticketForm, setTicketForm] = useState(initialTicket);
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const [clientResult, invoiceResult, ticketResult] = await Promise.all([
      supabase.from("clientes").select("id,empresa,rut,email,contacto,correo_facturacion,direccion,plan,ip,estado,dias_pago,id_cliente,fecha_inicio,contrato_meses,url_dashboard,url_contrato,created_at").eq("email", email).order("empresa"),
      supabase.from("facturas").select("id,mes_anio,fecha_emision,valor_total,estado,url_archivo,storage_path").eq("email_cliente", email).order("fecha_emision", { ascending: false }).limit(100),
      supabase.from("tickets").select("id,email_cliente,empresa,asunto,descripcion,prioridad,estado,seguimiento,created_at").eq("email_cliente", email).order("created_at", { ascending: false }).limit(100)
    ]);

    const errors = [clientResult.error, invoiceResult.error, ticketResult.error].filter(Boolean);
    if (errors.length) setError(errors.map((item) => item?.message).join(" · "));
    setClients((clientResult.data ?? []) as ClientRecord[]);
    setInvoices((invoiceResult.data ?? []) as CustomerInvoice[]);
    setTickets((ticketResult.data ?? []) as TicketRecord[]);
    setLoading(false);
  }, [email]);

  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => {
    const activeServices = clients.filter((client) => (client.estado ?? "Activo") === "Activo").length;
    const pendingInvoices = invoices.filter((invoice) => !["Pagada", "Anulada"].includes(invoice.estado ?? "")).length;
    const openTickets = tickets.filter((ticket) => !["Resuelto", "Cerrado"].includes(ticket.estado)).length;
    return { activeServices, pendingInvoices, openTickets };
  }, [clients, invoices, tickets]);

  async function uploadTicketAttachment() {
    if (!ticketFile) return null;
    if (ticketFile.size > 10 * 1024 * 1024) throw new Error("El archivo supera el máximo de 10 MB.");
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new Error("La sesión expiró.");
    const path = `${data.user.id}/new/${crypto.randomUUID()}-${safeFileName(ticketFile.name)}`;
    const { error: uploadError } = await supabase.storage.from("ticket-attachments").upload(path, ticketFile, { contentType: ticketFile.type || "application/octet-stream", upsert: false });
    if (uploadError) throw uploadError;
    return path;
  }

  async function createTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    try {
      const attachmentPath = await uploadTicketAttachment();
      const supabase = getSupabaseBrowserClient();
      const { data, error: invokeError } = await supabase.functions.invoke("ticket-create", { body: { ...ticketForm, attachmentPath } });
      if (invokeError || data?.error) throw new Error(data?.error ?? invokeError?.message ?? "No fue posible crear el ticket.");
      setTicketForm(initialTicket); setTicketFile(null); setTicketModal(false); setSuccess(`Ticket #${data.ticketId} creado correctamente.`); await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible crear el ticket.");
    } finally { setSaving(false); }
  }

  async function openPrivateFile(bucket: string, path: string | null | undefined) {
    if (!path) return;
    if (/^https?:\/\//i.test(path)) { window.open(path, "_blank", "noopener,noreferrer"); return; }
    const supabase = getSupabaseBrowserClient();
    const { data, error: invokeError } = await supabase.functions.invoke("document-sign", { body: { bucket, path } });
    if (invokeError || data?.error || !data?.signedUrl) { setError(data?.error ?? "No fue posible abrir el documento."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function logout() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace("/login"); router.refresh();
  }

  return <div className="min-h-screen bg-slate-100">
    <header className="border-b border-slate-200 bg-white"><div className="container-shell flex min-h-20 items-center justify-between gap-4"><div><p className="eyebrow">Portal de clientes</p><h1 className="mt-1 text-xl font-black">Globalcom Fibra</h1></div><div className="flex items-center gap-2"><button className="button-secondary !w-auto" onClick={() => void load()}><RefreshCw size={17} /> Actualizar</button><button className="button-secondary !w-auto" onClick={logout}><LogOut size={17} /> Salir</button></div></div></header>
    <main className="container-shell grid gap-6 py-7">
      <section className="surface overflow-hidden bg-slate-950 p-7 text-white"><p className="text-sm text-slate-400">Sesión de cliente</p><h2 className="mt-2 text-3xl font-black tracking-tight">{clients[0]?.empresa || email}</h2><p className="mt-3 text-slate-300">Consulta servicios, facturas y solicitudes de soporte asociadas a tu cuenta.</p></section>
      {error && <div className="alert alert-error">{error}</div>}{success && <div className="alert alert-success">{success}</div>}
      <div className="metric-grid"><div className="metric-card"><Wifi className="text-blue-600" /><span className="mt-5 block">Servicios activos</span><strong>{summary.activeServices}</strong></div><div className="metric-card"><FileText className="text-orange-600" /><span className="mt-5 block">Facturas pendientes</span><strong>{summary.pendingInvoices}</strong></div><div className="metric-card"><Headphones className="text-violet-600" /><span className="mt-5 block">Tickets abiertos</span><strong>{summary.openTickets}</strong></div><button className="metric-card text-left transition hover:-translate-y-0.5 hover:shadow-lg" onClick={() => setTicketModal(true)}><MessageSquarePlus className="text-emerald-600" /><span className="mt-5 block">Nueva solicitud</span><strong className="!text-lg text-blue-700">Crear ticket</strong></button></div>

      <section className="surface p-5"><div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-black">Mis servicios</h2><p className="mt-1 text-sm text-slate-500">Datos técnicos visibles sin exponer credenciales.</p></div></div><div className="mt-5 grid gap-4 lg:grid-cols-2">{loading ? Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-40" />) : clients.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500 lg:col-span-2">No encontramos servicios asociados a {email}. Contacta a soporte para validar el correo registrado.</div> : clients.map((client) => <article key={`${client.id ?? client.rut}`} className="rounded-2xl border border-slate-200 p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-black">{client.empresa}</h3><p className="mt-1 text-sm text-slate-500">{client.rut} · {client.id_cliente || "Sin ID de servicio"}</p></div><span className={`badge ${(client.estado ?? "Activo") === "Activo" ? "badge-green" : "badge-slate"}`}>{client.estado || "Activo"}</span></div><dl className="mt-5 grid grid-cols-2 gap-4 text-sm"><div><dt className="font-bold text-slate-500">Plan</dt><dd className="mt-1 font-black">{client.plan || "Por confirmar"}</dd></div><div><dt className="font-bold text-slate-500">IP asignada</dt><dd className="mt-1 font-mono">{client.ip || "Por confirmar"}</dd></div><div className="col-span-2"><dt className="font-bold text-slate-500">Dirección</dt><dd className="mt-1">{client.direccion || "No registrada"}</dd></div></dl>{client.url_contrato && <button className="mt-5 inline-flex items-center gap-2 text-sm font-black text-blue-700" onClick={() => void openPrivateFile("contracts", client.url_contrato)}>Ver contrato <Download size={15} /></button>}</article>)}</div></section>

      <section className="surface p-5"><h2 className="text-xl font-black">Facturación</h2><div className="table-wrap mt-5"><table className="data-table"><thead><tr><th>Documento</th><th>Emisión</th><th>Vencimiento</th><th>Total</th><th>Estado</th><th></th></tr></thead><tbody>{loading ? <tr><td colSpan={6}><div className="skeleton h-12" /></td></tr> : invoices.length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-slate-500">No hay facturas disponibles.</td></tr> : invoices.map((invoice, index) => <tr key={`${invoice.id ?? index}`}><td className="font-black">Factura {invoice.mes_anio || "—"}</td><td>{formatDate(invoice.fecha_emision)}</td><td>Según condiciones comerciales</td><td>{formatClp(Number(invoice.valor_total ?? 0))}</td><td><span className={`badge ${invoice.estado === "Pagada" ? "badge-green" : "badge-orange"}`}>{invoice.estado || "Emitida"}</span></td><td>{(invoice.storage_path || invoice.url_archivo) && <button className="inline-flex items-center gap-2 text-sm font-black text-blue-700" onClick={() => void openPrivateFile("customer-invoices", invoice.storage_path || invoice.url_archivo)}>Abrir <Download size={15} /></button>}</td></tr>)}</tbody></table></div></section>

      <section className="surface p-5"><div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-black">Soporte</h2><p className="mt-1 text-sm text-slate-500">Estado y seguimiento de tus solicitudes.</p></div><button className="button-primary !w-auto" onClick={() => setTicketModal(true)}><MessageSquarePlus size={18} /> Nuevo ticket</button></div><div className="mt-5 grid gap-3">{loading ? <div className="skeleton h-24" /> : tickets.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">Aún no tienes tickets registrados.</div> : tickets.map((ticket) => <article key={ticket.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-blue-700">Ticket #{ticket.id}</p><h3 className="mt-2 font-black">{ticket.asunto}</h3><p className="mt-2 text-sm text-slate-500">Creado {formatDate(ticket.created_at)} · {(ticket.seguimiento as TicketMessage[] | null)?.length ?? 0} respuesta(s)</p></div><span className={`badge ${["Resuelto", "Cerrado"].includes(ticket.estado) ? "badge-green" : "badge-blue"}`}>{ticket.estado}</span></div></article>)}</div></section>
    </main>

    {ticketModal && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Crear ticket"><div className="modal-card"><div className="modal-header"><div><p className="eyebrow">Soporte</p><h2 className="mt-2 text-2xl font-black">Nueva solicitud</h2></div><button className="button-secondary !w-auto !px-3 !py-2" onClick={() => setTicketModal(false)}>Cerrar</button></div><form className="modal-body grid gap-4" onSubmit={createTicket}><div className="field"><label htmlFor="ticket-subject">Asunto</label><input id="ticket-subject" required minLength={5} maxLength={140} value={ticketForm.asunto} onChange={(event) => setTicketForm({ ...ticketForm, asunto: event.target.value })} /></div><div className="field"><label htmlFor="ticket-description">Descripción</label><textarea id="ticket-description" required minLength={10} maxLength={4000} rows={6} value={ticketForm.descripcion} onChange={(event) => setTicketForm({ ...ticketForm, descripcion: event.target.value })} /></div><div className="field"><label htmlFor="ticket-priority">Prioridad</label><select id="ticket-priority" value={ticketForm.prioridad} onChange={(event) => setTicketForm({ ...ticketForm, prioridad: event.target.value })}><option>Baja</option><option>Media</option><option>Alta</option></select><small>La prioridad puede ser ajustada por el equipo técnico según impacto y alcance.</small></div><div className="field"><label htmlFor="ticket-file">Adjunto opcional</label><input id="ticket-file" type="file" accept=".pdf,image/*,.txt,.log" onChange={(event) => setTicketFile(event.target.files?.[0] ?? null)} /></div><button className="button-primary md:w-fit" disabled={saving}>{saving ? <><LoaderCircle className="animate-spin" size={18} /> Enviando…</> : <><Send size={18} /> Crear ticket</>}</button></form></div></div>}
  </div>;
}
