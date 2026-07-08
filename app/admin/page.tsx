import Link from "next/link";
import { AlertTriangle, ArrowRight, Building2, CircleDollarSign, Headphones, ReceiptText, WalletCards } from "@/components/icons";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatClp, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = await getSupabaseServerClient();
  const [clientsResult, ticketsResult, customerInvoicesResult, supplierInvoicesResult, activityResult] = await Promise.all([
    supabase.from("clientes").select("rut,estado", { count: "exact" }),
    supabase.from("tickets").select("id,prioridad,estado", { count: "exact" }),
    supabase.from("facturas").select("valor_total,estado"),
    supabase.from("supplier_invoice_summary").select("id,total_amount,balance_due,status,due_date"),
    supabase.from("audit_logs").select("id,action,module,record_label,created_at").order("created_at", { ascending: false }).limit(8)
  ]);

  const clients = clientsResult.data ?? [];
  const tickets = ticketsResult.data ?? [];
  const customerInvoices = customerInvoicesResult.data ?? [];
  const supplierInvoices = supplierInvoicesResult.data ?? [];
  const activeClients = clients.filter((item) => (item.estado ?? "Activo") === "Activo").length;
  const openTickets = tickets.filter((item) => !["Resuelto", "Cerrado"].includes(item.estado ?? "")).length;
  const criticalTickets = tickets.filter((item) => item.prioridad === "Alta" && !["Resuelto", "Cerrado"].includes(item.estado ?? "")).length;
  const receivable = customerInvoices.filter((item) => item.estado !== "Pagada").reduce((sum, item) => sum + Number(item.valor_total ?? 0), 0);
  const payable = supplierInvoices.reduce((sum, item) => sum + Number(item.balance_due ?? 0), 0);
  const overduePayable = supplierInvoices.filter((item) => item.status === "overdue").reduce((sum, item) => sum + Number(item.balance_due ?? 0), 0);

  const cards = [
    { label: "Clientes activos", value: String(activeClients), icon: Building2, href: "/admin/clientes", tone: "text-blue-700 bg-blue-50" },
    { label: "Tickets abiertos", value: String(openTickets), icon: Headphones, href: "/admin/soporte", tone: "text-orange-700 bg-orange-50" },
    { label: "Por recaudar", value: formatClp(receivable), icon: WalletCards, href: "/admin/clientes", tone: "text-emerald-700 bg-emerald-50" },
    { label: "Cuentas por pagar", value: formatClp(payable), icon: CircleDollarSign, href: "/admin/finanzas", tone: "text-violet-700 bg-violet-50" }
  ];

  return <div className="admin-page">
    <div className="admin-heading"><div><h1>Dashboard operacional</h1><p>Indicadores conectados a clientes, soporte y finanzas.</p></div></div>
    {(criticalTickets > 0 || overduePayable > 0) && <div className="alert alert-error flex items-start gap-3"><AlertTriangle className="mt-0.5 shrink-0" size={20} /><div><strong>Hay elementos que requieren atención.</strong><p className="mt-1">{criticalTickets} ticket(s) de prioridad alta y {formatClp(overduePayable)} vencidos en cuentas por pagar.</p></div></div>}
    <div className="metric-grid">{cards.map(({ label, value, icon: Icon, href, tone }) => <Link key={label} href={href} className="metric-card group transition hover:-translate-y-0.5 hover:shadow-lg"><div className={`grid size-10 place-items-center rounded-xl ${tone}`}><Icon size={20} /></div><span className="mt-5 block">{label}</span><strong>{value}</strong><div className="mt-4 flex items-center gap-2 text-xs font-black text-blue-700">Ver detalle <ArrowRight size={14} className="transition group-hover:translate-x-1" /></div></Link>)}</div>
    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <section className="surface p-5"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black">Actividad reciente</h2><p className="mt-1 text-sm text-slate-500">Acciones administrativas registradas.</p></div><ReceiptText className="text-slate-400" /></div><div className="mt-5 grid gap-2">{activityResult.data?.length ? activityResult.data.map((item) => <div key={item.id} className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 p-3"><div><p className="font-bold text-slate-800">{item.action}</p><p className="mt-1 text-xs text-slate-500">{item.module}{item.record_label ? ` · ${item.record_label}` : ""}</p></div><time className="shrink-0 text-xs text-slate-400">{formatDate(item.created_at)}</time></div>) : <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">Aún no hay actividades registradas.</div>}</div></section>
      <section className="surface p-5"><h2 className="text-xl font-black">Resumen financiero</h2><div className="mt-5 grid gap-3"><div className="rounded-xl bg-slate-50 p-4"><span className="text-xs font-bold uppercase tracking-wider text-slate-500">Documentos de proveedores</span><strong className="mt-2 block text-2xl">{supplierInvoices.length}</strong></div><div className="rounded-xl bg-red-50 p-4"><span className="text-xs font-bold uppercase tracking-wider text-red-600">Saldo vencido</span><strong className="mt-2 block text-2xl text-red-700">{formatClp(overduePayable)}</strong></div><Link href="/admin/finanzas" className="button-primary mt-2">Abrir módulo financiero</Link></div></section>
    </div>
  </div>;
}
