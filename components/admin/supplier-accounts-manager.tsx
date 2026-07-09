"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, ExternalLink, LoaderCircle, RefreshCw, Search, WalletCards } from "@/components/icons";
import { formatClp, formatDate } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { SupplierSiiExcelImporter } from "@/components/admin/supplier-sii-excel-importer";

type Account = {
  supplier_id: string; legal_name: string; trade_name: string | null; rut: string;
  contact_name: string | null; contact_email: string | null; payment_email: string | null;
  bank_name: string | null; bank_account_type: string | null; bank_account_number: string | null;
  invoice_count: number; credit_note_count: number; total_invoiced: number; total_credits: number;
  applied_credits: number; available_credit: number; total_paid: number; balance_due: number;
  overdue_balance: number; due_next_30_days: number; last_invoice_date: string | null;
};

type Invoice = {
  id: string; supplier_id: string; supplier_name: string; supplier_rut: string;
  document_type: string; folio: string; issue_date: string; due_date: string | null;
  total_amount: number; paid_amount: number; credited_amount: number; balance_due: number; status: string;
  storage_path: string | null; description: string | null;
};

type Payment = {
  id: string; payment_code: string; payment_date: string; amount: number; method: string;
  bank: string | null; operation_number: string | null; accounting_reference: string | null;
  receipt_storage_path: string | null; notes: string | null; reversed_at: string | null;
  supplier_id: string | null; supplier_name: string | null; supplier_rut: string | null;
  allocations: Array<{ invoice_id: string; document_type: string; folio: string; allocated_amount: number }>;
};


const today = new Date().toISOString().slice(0, 10);
const methods = ["Transferencia bancaria", "Pago automático", "Tarjeta", "Cheque", "Efectivo", "Compensación", "Nota de crédito", "Otro"];

function statusName(value: string) {
  return ({ received: "Recibida", under_review: "En revisión", approved: "Aprobada", pending_payment: "Pendiente", partial: "Pago parcial", paid: "Pagada", credit_compensated: "Compensada con crédito", overdue: "Vencida", observed: "Observada", rejected: "Rechazada", void: "Anulada" } as Record<string, string>)[value] ?? value;
}

export function SupplierAccountsManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tab, setTab] = useState<"accounts" | "payments" | "import">("accounts");
  const [supplierId, setSupplierId] = useState("Todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ paymentDate: today, method: methods[0], bank: "", sourceAccount: "", operationNumber: "", accountingReference: "", providerReference: "", notes: "" });
  const [receipt, setReceipt] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quickPayingId, setQuickPayingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const supabase = getSupabaseBrowserClient();
    const [a, i, p] = await Promise.all([
      supabase.from("supplier_account_summary").select("*").order("legal_name"),
      supabase.from("supplier_invoice_summary").select("*").order("due_date", { ascending: true }),
      supabase.from("supplier_payment_history").select("*").order("payment_date", { ascending: false }).limit(1000),
    ]);
    const first = a.error || i.error || p.error;
    if (first) setError(first.message);
    setAccounts((a.data ?? []) as Account[]);
    setInvoices((i.data ?? []) as Invoice[]);
    setPayments((p.data ?? []) as Payment[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filteredInvoices = useMemo(() => invoices.filter((item) => {
    const term = search.trim().toLowerCase();
    const matchesSupplier = supplierId === "Todos" || item.supplier_id === supplierId;
    const matchesText = !term || `${item.supplier_name} ${item.supplier_rut} ${item.folio} ${item.description ?? ""}`.toLowerCase().includes(term);
    return matchesSupplier && matchesText;
  }), [invoices, search, supplierId]);

  const selectedInvoices = invoices.filter((item) => selected.has(item.id) && item.balance_due > 0);
  const selectedTotal = selectedInvoices.reduce((sum, item) => sum + Number(item.balance_due), 0);
  const accountTotals = useMemo(() => accounts.reduce((result, item) => ({
    invoiced: result.invoiced + Number(item.total_invoiced),
    credits: result.credits + Number(item.total_credits),
    paid: result.paid + Number(item.total_paid),
    pending: result.pending + Number(item.balance_due),
    overdue: result.overdue + Number(item.overdue_balance),
  }), { invoiced: 0, credits: 0, paid: 0, pending: 0, overdue: 0 }), [accounts]);

  function toggleInvoice(invoice: Invoice) {
    if (invoice.balance_due <= 0) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(invoice.id)) next.delete(invoice.id); else next.add(invoice.id);
      return next;
    });
  }

  async function uploadReceipt() {
    if (!receipt) return null;
    if (receipt.size > 10 * 1024 * 1024) throw new Error("El comprobante supera 10 MB.");
    const supabase = getSupabaseBrowserClient();
    const folder = selectedInvoices[0]?.supplier_id ?? "general";
    const path = `${folder}/${new Date().getFullYear()}/${crypto.randomUUID()}-${receipt.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { error: uploadError } = await supabase.storage.from("payment-receipts").upload(path, receipt, { contentType: receipt.type || "application/octet-stream" });
    if (uploadError) throw uploadError;
    return path;
  }

  async function registerPayment(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedInvoices.length) return;
    setSaving(true); setError(""); setSuccess("");
    let receiptPath: string | null = null;
    try {
      receiptPath = await uploadReceipt();
      const supabase = getSupabaseBrowserClient();
      const { data, error: invokeError } = await supabase.functions.invoke("register-supplier-payment-v2", {
        body: {
          ...paymentForm,
          amount: selectedTotal,
          receiptPath,
          allocations: selectedInvoices.map((invoice) => ({ invoiceId: invoice.id, amount: invoice.balance_due })),
        },
      });
      if (invokeError || data?.error) throw new Error(data?.error ?? invokeError?.message ?? "No fue posible registrar el pago.");
      setSuccess(`Pago ${data.paymentCode} registrado por ${formatClp(selectedTotal)}.`);
      setSelected(new Set()); setPaymentOpen(false); setReceipt(null);
      setPaymentForm({ paymentDate: today, method: methods[0], bank: "", sourceAccount: "", operationNumber: "", accountingReference: "", providerReference: "", notes: "" });
      await load();
    } catch (cause) {
      if (receiptPath) await getSupabaseBrowserClient().storage.from("payment-receipts").remove([receiptPath]);
      setError(cause instanceof Error ? cause.message : "No fue posible registrar el pago.");
    } finally { setSaving(false); }
  }

  async function markInvoicePaid(invoice: Invoice) {
    const balance = Number(invoice.balance_due);

    if (!Number.isFinite(balance) || balance <= 0 || quickPayingId) {
      return;
    }

    const confirmed = window.confirm(
      `¿Marcar como pagada la ${invoice.document_type} ${invoice.folio} de ${invoice.supplier_name} por ${formatClp(balance)}?\n\nSe registrará un pago completo con fecha de hoy.`
    );

    if (!confirmed) return;

    setQuickPayingId(invoice.id);
    setError("");
    setSuccess("");

    try {
      const { data, error: invokeError } =
        await getSupabaseBrowserClient().functions.invoke(
          "register-supplier-payment-v2",
          {
            body: {
              paymentDate: today,
              amount: balance,
              method: "Marcación rápida",
              allocations: [
                {
                  invoiceId: invoice.id,
                  amount: balance,
                },
              ],
              notes:
                "Factura marcada como pagada mediante el botón rápido de Cuentas por pagar.",
            },
          },
        );

      if (invokeError || data?.error) {
        throw new Error(
          data?.error ??
            invokeError?.message ??
            "No fue posible marcar la factura como pagada.",
        );
      }

      setSelected((current) => {
        const next = new Set(current);
        next.delete(invoice.id);
        return next;
      });

      setSuccess(
        `${invoice.document_type} ${invoice.folio} marcada como pagada por ${formatClp(balance)}. Pago ${data.paymentCode}.`,
      );

      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible marcar la factura como pagada.",
      );

      await load();
    } finally {
      setQuickPayingId("");
    }
  }

  async function reversePayment(payment: Payment) {
    const reason = window.prompt(`Motivo para reversar ${payment.payment_code}:`);
    if (!reason) return;
    setSaving(true); setError("");
    const { data, error: invokeError } = await getSupabaseBrowserClient().functions.invoke("reverse-supplier-payment", { body: { paymentId: payment.id, reason } });
    if (invokeError || data?.error) setError(data?.error ?? invokeError?.message ?? "No fue posible reversar.");
    else { setSuccess(`Pago ${payment.payment_code} reversado.`); await load(); }
    setSaving(false);
  }

  async function openStorage(bucket: string, path: string | null) {
    if (!path) return;
    const { data, error: signedError } = await getSupabaseBrowserClient().storage.from(bucket).createSignedUrl(path, 300);
    if (signedError || !data?.signedUrl) return setError("No fue posible abrir el documento.");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function exportStatement() {
    const rows = filteredInvoices.map((item) => [
      item.supplier_name, item.supplier_rut, item.document_type, item.folio, item.issue_date, item.due_date,
      item.total_amount, item.paid_amount, item.balance_due, statusName(item.status),
    ]);
    const csv = [["Proveedor","RUT","Tipo","Folio","Emisión","Vencimiento","Total","Pagado","Saldo","Estado"], ...rows]
      .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `estado-cuenta-proveedores-${today}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  return <div className="admin-page">
    <div className="admin-heading">
      <div><h1>Cuentas por pagar</h1><p>Estado de cuenta, pagos, comprobantes e importación masiva de proveedores.</p></div>
      <div className="flex flex-wrap gap-2">
        <button className="button-secondary !w-auto" onClick={() => void load()}><RefreshCw size={17}/> Actualizar</button>
        <button className="button-secondary !w-auto" onClick={exportStatement}><Download size={17}/> Exportar estado</button>
        <button className="button-primary !w-auto" disabled={!selectedInvoices.length} onClick={() => setPaymentOpen(true)}><WalletCards size={17}/> Pagar seleccionadas ({selectedInvoices.length})</button>
      </div>
    </div>
    {error && <div className="alert alert-error">{error}</div>}
    {success && <div className="alert alert-success">{success}</div>}

    <div className="metric-grid">
      {[
        ["Total facturado", accountTotals.invoiced, "bg-slate-100 text-slate-700"],
        ["Notas de crédito", accountTotals.credits, "bg-emerald-50 text-emerald-700"],
        ["Total pagado", accountTotals.paid, "bg-emerald-50 text-emerald-700"],
        ["Saldo pendiente", accountTotals.pending, "bg-blue-50 text-blue-700"],
        ["Saldo vencido", accountTotals.overdue, "bg-red-50 text-red-700"],
      ].map(([label, value, tone]) => <div className="metric-card" key={String(label)}><div className={`grid size-10 place-items-center rounded-xl ${tone}`}><CheckCircle2 size={19}/></div><span className="mt-5 block">{label}</span><strong>{formatClp(Number(value))}</strong></div>)}
    </div>

    <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
      {[["accounts","Estado de cuenta"],["payments","Historial de pagos"],["import","Importación SII / Excel"]].map(([value,label]) =>
        <button key={value} className={`rounded-xl px-4 py-2.5 text-sm font-black ${tab === value ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`} onClick={() => setTab(value as typeof tab)}>{label}</button>)}
    </nav>

    {loading ? <div className="skeleton h-96"/> : tab === "accounts" ? <>
      <section className="surface p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <div className="field"><label htmlFor="pay-search">Buscar</label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input id="pay-search" className="!pl-10" placeholder="Proveedor, RUT, folio o descripción" value={search} onChange={(event) => setSearch(event.target.value)}/></div></div>
          <div className="field"><label htmlFor="pay-supplier">Proveedor</label><select id="pay-supplier" value={supplierId} onChange={(event) => { setSupplierId(event.target.value); setSelected(new Set()); }}><option>Todos</option>{accounts.map((account) => <option key={account.supplier_id} value={account.supplier_id}>{account.legal_name}</option>)}</select></div>
        </div>
      </section>
      <div className="table-wrap"><table className="data-table"><thead><tr><th></th><th>Proveedor</th><th>Documento</th><th>Fechas</th><th>Total / créditos / pagado / saldo</th><th>Estado</th><th></th></tr></thead><tbody>
        {filteredInvoices.length === 0 ? <tr><td colSpan={7} className="py-12 text-center text-slate-500">No hay facturas para los filtros seleccionados.</td></tr> :
        filteredInvoices.map((invoice) => <tr key={invoice.id}>
          <td><input type="checkbox" checked={selected.has(invoice.id)} disabled={invoice.balance_due <= 0} onChange={() => toggleInvoice(invoice)} aria-label={`Seleccionar factura ${invoice.folio}`}/></td>
          <td><strong className="block">{invoice.supplier_name}</strong><span className="font-mono text-xs text-slate-500">{invoice.supplier_rut}</span></td>
          <td><strong>{invoice.document_type}</strong><span className="block text-xs text-slate-500">Folio {invoice.folio}</span></td>
          <td><span className="block text-sm">Emisión: {formatDate(invoice.issue_date)}</span><span className="block text-xs text-slate-500">Vence: {formatDate(invoice.due_date)}</span></td>
          <td><strong className="block">{formatClp(invoice.total_amount)}</strong><span className="block text-xs text-blue-700">Créditos: {formatClp(invoice.credited_amount)}</span><span className="block text-xs text-emerald-600">Pagado: {formatClp(invoice.paid_amount)}</span><span className={`block text-xs font-black ${invoice.balance_due ? "text-red-600" : "text-emerald-600"}`}>Saldo: {formatClp(invoice.balance_due)}</span></td>
          <td><span className={`badge ${invoice.status === "paid" ? "badge-green" : invoice.status === "overdue" ? "badge-red" : invoice.status === "partial" ? "badge-orange" : "badge-blue"}`}>{statusName(invoice.status)}</span></td>
          <td><div className="flex flex-wrap gap-2">
            {invoice.balance_due > 0 && <button
              className="button-primary !w-auto !px-3 !py-2"
              disabled={Boolean(quickPayingId) || saving}
              onClick={() => void markInvoicePaid(invoice)}
              title={`Registrar pago completo por ${formatClp(invoice.balance_due)}`}
            >
              {quickPayingId === invoice.id
                ? <><LoaderCircle className="animate-spin" size={15}/> Marcando…</>
                : <><CheckCircle2 size={15}/> Marcar pagada</>}
            </button>}
            {invoice.storage_path && <button className="button-secondary !w-auto !px-3 !py-2" onClick={() => void openStorage("supplier-invoices", invoice.storage_path)}><ExternalLink size={15}/></button>}
          </div></td>
        </tr>)}
      </tbody></table></div>
      {selectedInvoices.length > 0 && <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-lg"><div><strong>{selectedInvoices.length} factura(s) seleccionada(s)</strong><p className="text-sm text-slate-600">Pago total propuesto: {formatClp(selectedTotal)}</p></div><button className="button-primary !w-auto" onClick={() => setPaymentOpen(true)}>Registrar pago</button></div>}
    </> : tab === "payments" ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Código</th><th>Proveedor</th><th>Fecha</th><th>Método y referencia</th><th>Monto</th><th>Facturas</th><th>Estado</th><th></th></tr></thead><tbody>
      {payments.length === 0 ? <tr><td colSpan={8} className="py-12 text-center text-slate-500">No hay pagos registrados.</td></tr> :
      payments.map((payment) => <tr key={payment.id}>
        <td><strong className="font-mono">{payment.payment_code}</strong></td>
        <td><strong className="block">{payment.supplier_name || "—"}</strong><span className="font-mono text-xs text-slate-500">{payment.supplier_rut || ""}</span></td>
        <td>{formatDate(payment.payment_date)}</td>
        <td><span className="block">{payment.method}</span><span className="block text-xs text-slate-500">{payment.operation_number || payment.accounting_reference || "Sin referencia"}</span></td>
        <td className="font-black">{formatClp(payment.amount)}</td>
        <td><div className="grid gap-1">{payment.allocations.map((allocation) => <span key={allocation.invoice_id} className="text-xs">{allocation.document_type} {allocation.folio}: {formatClp(allocation.allocated_amount)}</span>)}</div></td>
        <td><span className={`badge ${payment.reversed_at ? "badge-red" : "badge-green"}`}>{payment.reversed_at ? "Reversado" : "Vigente"}</span></td>
        <td><div className="flex gap-2">{payment.receipt_storage_path && <button className="button-secondary !w-auto !px-3 !py-2" onClick={() => void openStorage("payment-receipts", payment.receipt_storage_path)}><ExternalLink size={15}/></button>}{!payment.reversed_at && <button className="button-secondary !w-auto !px-3 !py-2" disabled={saving} onClick={() => void reversePayment(payment)}>Reversar</button>}</div></td>
      </tr>)}
    </tbody></table></div> : <SupplierSiiExcelImporter onImported={load} />}

    {paymentOpen && <div className="modal-backdrop"><div className="modal-card !max-w-3xl"><div className="modal-header"><div><p className="eyebrow">Registro de pago</p><h2 className="mt-2 text-2xl font-black">{formatClp(selectedTotal)}</h2><p className="text-sm text-slate-500">{selectedInvoices.length} factura(s)</p></div><button className="button-secondary !w-auto" onClick={() => setPaymentOpen(false)}>Cerrar</button></div>
      <form className="modal-body grid gap-4" onSubmit={registerPayment}><div className="grid gap-4 md:grid-cols-2">
        <div className="field"><label htmlFor="p-date">Fecha de pago</label><input id="p-date" type="date" required value={paymentForm.paymentDate} onChange={(event) => setPaymentForm({...paymentForm,paymentDate:event.target.value})}/></div>
        <div className="field"><label htmlFor="p-method">Método</label><select id="p-method" value={paymentForm.method} onChange={(event) => setPaymentForm({...paymentForm,method:event.target.value})}>{methods.map((method) => <option key={method}>{method}</option>)}</select></div>
        <div className="field"><label htmlFor="p-bank">Banco de origen</label><input id="p-bank" value={paymentForm.bank} onChange={(event) => setPaymentForm({...paymentForm,bank:event.target.value})}/></div>
        <div className="field"><label htmlFor="p-account">Cuenta de origen</label><input id="p-account" value={paymentForm.sourceAccount} onChange={(event) => setPaymentForm({...paymentForm,sourceAccount:event.target.value})}/></div>
        <div className="field"><label htmlFor="p-operation">N° operación bancaria</label><input id="p-operation" value={paymentForm.operationNumber} onChange={(event) => setPaymentForm({...paymentForm,operationNumber:event.target.value})}/></div>
        <div className="field"><label htmlFor="p-accounting">Referencia contable</label><input id="p-accounting" value={paymentForm.accountingReference} onChange={(event) => setPaymentForm({...paymentForm,accountingReference:event.target.value})}/></div>
        <div className="field"><label htmlFor="p-provider-ref">Referencia del proveedor</label><input id="p-provider-ref" value={paymentForm.providerReference} onChange={(event) => setPaymentForm({...paymentForm,providerReference:event.target.value})}/></div>
        <div className="field"><label htmlFor="p-receipt">Comprobante</label><input id="p-receipt" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(event) => setReceipt(event.target.files?.[0] ?? null)}/></div>
        <div className="field md:col-span-2"><label htmlFor="p-notes">Observaciones</label><textarea id="p-notes" rows={3} value={paymentForm.notes} onChange={(event) => setPaymentForm({...paymentForm,notes:event.target.value})}/></div>
      </div><div className="rounded-xl bg-slate-50 p-4"><strong>Distribución automática</strong>{selectedInvoices.map((invoice) => <div key={invoice.id} className="mt-2 flex justify-between text-sm"><span>{invoice.supplier_name} · {invoice.document_type} {invoice.folio}</span><strong>{formatClp(invoice.balance_due)}</strong></div>)}</div><button className="button-primary !w-auto" disabled={saving}>{saving ? <><LoaderCircle className="animate-spin" size={17}/> Registrando…</> : "Confirmar pago"}</button></form>
    </div></div>}
  </div>;
}
