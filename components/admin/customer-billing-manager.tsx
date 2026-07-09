"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  ExternalLink,
  FilePlus2,
  LoaderCircle,
  RefreshCw,
  Search,
  Send,
} from "@/components/icons";
import { formatClp, formatDate } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Client = {
  empresa: string;
  rut: string;
  email: string;
  correo_facturacion: string | null;
  dias_pago: number | null;
};

type Invoice = {
  id: string;
  email_cliente: string;
  cliente_rut: string | null;
  mes_anio: string;
  folio: string | null;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  fecha_pago: string | null;
  metodo_pago: string | null;
  referencia_pago: string | null;
  valor_neto: number;
  valor_total: number;
  estado: string;
  storage_path: string | null;
  url_archivo: string | null;
  email_status: string | null;
  sent_at: string | null;
};

type UploadRow = {
  id: string;
  file: File;
  rut: string;
  folio: string;
  period: string;
  issueDate: string;
  net: string;
  total: string;
  status: "Analizando" | "Listo" | "Revisar" | "Error";
  detail: string;
};

const today = new Date().toISOString().slice(0, 10);

function compactRut(value: string | null | undefined) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^0-9K]/g, "");
}

function normalizeRutDisplay(value: string) {
  const compact = compactRut(value);
  if (compact.length < 2) return value.trim();
  return `${compact.slice(0, -1)}-${compact.slice(-1)}`;
}

function parseMoney(value: string | undefined) {
  if (!value) return "";
  const normalized = value
    .replace(/\s/g, "")
    .replace(/\$/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0
    ? String(Math.round(amount))
    : "";
}

function parseDate(value: string | undefined) {
  if (!value) return "";
  const iso = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const local = value.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (!local) return "";
  return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

async function extractPdf(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const bytes = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data: bytes }).promise;
  let text = "";

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    text +=
      content.items
        .map((item) => ("str" in item ? String(item.str) : ""))
        .join(" ") + "\n";
  }

  const rut = firstMatch(text, [
    /RUT\s+(?:RECEPTOR|CLIENTE)\s*:?\s*([0-9.\-K]+)/i,
    /R\.?U\.?T\.?\s+(?:RECEPTOR|CLIENTE)\s*:?\s*([0-9.\-K]+)/i,
    /SEÑOR(?:ES)?[\s\S]{0,180}?R\.?U\.?T\.?\s*:?\s*([0-9.\-K]+)/i,
  ]);

  const folio = firstMatch(text, [
    /(?:FOLIO|N[ÚU]MERO)\s*:?\s*(\d{1,20})/i,
    /FACTURA\s+ELECTR[ÓO]NICA\s+N[°º]?\s*(\d{1,20})/i,
  ]);

  const issueDateRaw = firstMatch(text, [
    /FECHA\s+(?:DE\s+)?EMISI[ÓO]N\s*:?\s*([0-9/-]{8,10})/i,
    /EMISI[ÓO]N\s*:?\s*([0-9/-]{8,10})/i,
  ]);

  const net = parseMoney(
    firstMatch(text, [
      /MONTO\s+NETO\s*:?\s*\$?\s*([\d.,]+)/i,
      /NETO\s*:?\s*\$?\s*([\d.,]+)/i,
    ]),
  );

  const total = parseMoney(
    firstMatch(text, [
      /(?:MONTO\s+)?TOTAL\s*:?\s*\$?\s*([\d.,]+)/i,
      /TOTAL\s+A\s+PAGAR\s*:?\s*\$?\s*([\d.,]+)/i,
    ]),
  );

  const issueDate = parseDate(issueDateRaw);

  return {
    rut: rut ? normalizeRutDisplay(rut) : "",
    folio,
    issueDate,
    period: issueDate ? issueDate.slice(0, 7) : "",
    net,
    total,
  };
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function CustomerBillingManager() {
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clientRut, setClientRut] = useState("Todos");
  const [search, setSearch] = useState("");
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [sendAfter, setSendAfter] = useState(true);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(
    null,
  );
  const [paymentForm, setPaymentForm] = useState({
    date: today,
    method: "Transferencia bancaria",
    reference: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const [clientsResult, invoicesResult] = await Promise.all([
      supabase
        .from("clientes")
        .select("empresa,rut,email,correo_facturacion,dias_pago")
        .is("deleted_at", null)
        .order("empresa"),
      supabase
        .from("facturas")
        .select(
          "id,email_cliente,cliente_rut,mes_anio,folio,fecha_emision,fecha_vencimiento,fecha_pago,metodo_pago,referencia_pago,valor_neto,valor_total,estado,storage_path,url_archivo,email_status,sent_at",
        )
        .is("deleted_at", null)
        .order("fecha_emision", { ascending: false }),
    ]);

    const firstError = clientsResult.error || invoicesResult.error;
    if (firstError) setError(firstError.message);

    setClients((clientsResult.data ?? []) as Client[]);
    setInvoices((invoicesResult.data ?? []) as Invoice[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const clientByRut = useMemo(
    () =>
      new Map(
        clients.map((client) => [compactRut(client.rut), client]),
      ),
    [clients],
  );

  const clientsByEmail = useMemo(() => {
    const result = new Map<string, Client[]>();
    for (const client of clients) {
      const key = client.email.toLowerCase();
      result.set(key, [...(result.get(key) ?? []), client]);
    }
    return result;
  }, [clients]);

  const resolveClient = useCallback(
    (invoice: Invoice) => {
      if (invoice.cliente_rut) {
        return clientByRut.get(compactRut(invoice.cliente_rut));
      }
      const matches =
        clientsByEmail.get(invoice.email_cliente.toLowerCase()) ?? [];
      return matches.length === 1 ? matches[0] : undefined;
    },
    [clientByRut, clientsByEmail],
  );

  const filtered = useMemo(
    () =>
      invoices.filter((invoice) => {
        const client = resolveClient(invoice);
        const matchesClient =
          clientRut === "Todos" || client?.rut === clientRut;
        const term = search.toLowerCase().trim();
        const matchesText =
          !term ||
          `${client?.empresa ?? ""} ${client?.rut ?? ""} ${
            invoice.folio ?? ""
          } ${invoice.mes_anio}`
            .toLowerCase()
            .includes(term);
        return matchesClient && matchesText;
      }),
    [invoices, resolveClient, clientRut, search],
  );

  const totals = useMemo(
    () =>
      filtered.reduce(
        (accumulator, invoice) => {
          const total = Number(invoice.valor_total || 0);
          accumulator.invoiced += total;
          if (invoice.estado === "Pagada") accumulator.paid += total;
          else if (
            invoice.estado === "Vencida" ||
            (invoice.fecha_vencimiento &&
              invoice.fecha_vencimiento < today)
          ) {
            accumulator.overdue += total;
          } else {
            accumulator.pending += total;
          }
          return accumulator;
        },
        { invoiced: 0, paid: 0, pending: 0, overdue: 0 },
      ),
    [filtered],
  );

  function updateUpload(id: string, patch: Partial<UploadRow>) {
    setUploads((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  async function prepareFiles(files: FileList | null) {
    if (!files) return;

    const selected = Array.from(files).slice(0, 20);
    const initialRows = selected.map((file) => {
      const base = file.name.replace(/\.pdf$/i, "");
      const parts = base.split("_");
      return {
        id: crypto.randomUUID(),
        file,
        rut: (parts[0] ?? "").toUpperCase(),
        folio: "",
        period: parts.slice(1).join(" ").slice(0, 7) || today.slice(0, 7),
        issueDate: today,
        net: "",
        total: "",
        status: "Analizando" as const,
        detail: "Leyendo contenido del PDF…",
      };
    });

    setUploads(initialRows);

    for (const row of initialRows) {
      try {
        const detected = await extractPdf(row.file);
        const next = {
          rut: detected.rut || row.rut,
          folio: detected.folio,
          period: detected.period || row.period,
          issueDate: detected.issueDate || row.issueDate,
          net: detected.net,
          total: detected.total,
        };
        const complete = Boolean(
          next.rut &&
            next.period &&
            next.issueDate &&
            next.total,
        );
        updateUpload(row.id, {
          ...next,
          status: complete ? "Listo" : "Revisar",
          detail: complete
            ? "Datos detectados automáticamente."
            : "Completa o confirma los campos faltantes.",
        });
      } catch (cause) {
        updateUpload(row.id, {
          status: "Error",
          detail:
            cause instanceof Error
              ? cause.message
              : "No fue posible leer el PDF.",
        });
      }
    }
  }

  async function processUploads() {
    if (!uploads.length) return;
    setSaving(true);
    setError("");
    setSuccess("");

    let completed = 0;
    const errors: string[] = [];

    for (const row of uploads) {
      try {
        const net = Number(row.net);
        const total = Number(row.total);

        if (
          !row.rut ||
          !row.period ||
          !row.issueDate ||
          !Number.isFinite(total) ||
          total <= 0
        ) {
          throw new Error(
            "Faltan RUT, período, fecha de emisión o total.",
          );
        }

        const calculatedNet =
          row.net.trim() && Number.isFinite(net) && net >= 0
            ? net
            : Math.round(total / 1.19);

        const { data, error: invokeError } =
          await getSupabaseBrowserClient().functions.invoke(
            "process-invoice",
            {
              body: {
                fileName: row.file.name,
                fileBase64: await fileToBase64(row.file),
                rut: row.rut,
                folio: row.folio || null,
                mes: row.period.slice(0, 7),
                neto: calculatedNet,
                total,
                fecha: row.issueDate,
              },
            },
          );

        if (invokeError || data?.error) {
          throw new Error(
            data?.error ??
              invokeError?.message ??
              "Error al procesar.",
          );
        }

        if (sendAfter && data?.invoiceId) {
          const { data: mailData, error: mailError } =
            await getSupabaseBrowserClient().functions.invoke(
              "send-globalcom-email",
              {
                body: {
                  clientRut: row.rut,
                  invoiceId: data.invoiceId,
                  messageType: "invoice",
                  department: "Facturación y Cobranza",
                  subject:
                    "Factura de servicios Globalcom — [PERIODO]",
                  message:
                    "Estimados equipo de [EMPRESA],\n\nJunto con saludar, informamos que su factura correspondiente a [PERIODO] ya se encuentra disponible.\n\nMonto total: [MONTO_TOTAL]\nFecha de vencimiento: [FECHA_VENCIMIENTO]\n\nEl PDF se encuentra adjunto y también puede descargarlo desde el botón incluido en este correo o revisarlo en su portal privado.\n\nSaludos cordiales.",
                },
              },
            );

          if (mailError || mailData?.error) {
            throw new Error(
              `Factura registrada, pero el correo falló: ${
                mailData?.error ?? mailError?.message
              }`,
            );
          }
        }

        completed++;
      } catch (cause) {
        errors.push(
          `${row.file.name}: ${
            cause instanceof Error ? cause.message : "Error"
          }`,
        );
      }
    }

    if (errors.length) {
      setError(
        `${completed} procesadas. Errores: ${errors.join(" | ")}`,
      );
    } else {
      setSuccess(
        `${completed} facturas registradas${
          sendAfter ? " y enviadas" : ""
        }.`,
      );
      setUploads([]);
    }

    await load();
    setSaving(false);
  }

  async function assignInvoice(invoice: Invoice, rut: string) {
    const client = clientByRut.get(compactRut(rut));
    if (!client) return;

    setSaving(true);
    setError("");
    const { error: updateError } = await getSupabaseBrowserClient()
      .from("facturas")
      .update({
        cliente_rut: client.rut,
        email_cliente: client.email,
      })
      .eq("id", invoice.id);

    if (updateError) setError(updateError.message);
    else {
      setSuccess(`Factura asignada a ${client.empresa}.`);
      await load();
    }
    setSaving(false);
  }

  async function markPaid(event: React.FormEvent) {
    event.preventDefault();
    if (!paymentInvoice) return;

    setSaving(true);
    setError("");

    const { error: updateError } = await getSupabaseBrowserClient()
      .from("facturas")
      .update({
        estado: "Pagada",
        fecha_pago: paymentForm.date,
        metodo_pago: paymentForm.method,
        referencia_pago: paymentForm.reference || null,
      })
      .eq("id", paymentInvoice.id);

    if (updateError) setError(updateError.message);
    else {
      setSuccess("Factura marcada como pagada.");
      setPaymentInvoice(null);
      await load();
    }
    setSaving(false);
  }

  async function sendInvoice(invoice: Invoice, collection = false) {
    const client = resolveClient(invoice);
    if (!client) {
      setError(
        "Asigna esta factura a un cliente antes de enviarla.",
      );
      return;
    }

    setSaving(true);
    setError("");

    const { data, error: invokeError } =
      await getSupabaseBrowserClient().functions.invoke(
        "send-globalcom-email",
        {
          body: collection
            ? {
                clientRut: client.rut,
                invoiceId: invoice.id,
                messageType: "collection",
                department: "Facturación y Cobranza",
                subject: "Recordatorio de pago — [EMPRESA]",
                message:
                  "Estimados equipo de [EMPRESA],\n\nEsperamos que se encuentren bien. Les compartimos un recordatorio de su estado de cuenta:\n\n[ESTADO_CUENTA]\n\nDeuda total pendiente: [DEUDA_TOTAL]\n\nSi el pago ya fue realizado, agradeceremos enviar el comprobante a contacto@globalcomfibra.cl.\n\nSaludos cordiales.",
              }
            : {
                clientRut: client.rut,
                invoiceId: invoice.id,
                messageType: "invoice",
                department: "Facturación y Cobranza",
                subject:
                  "Factura de servicios Globalcom — [PERIODO]",
                message:
                  "Estimados equipo de [EMPRESA],\n\nSu factura correspondiente a [PERIODO] ya se encuentra disponible.\n\nMonto total: [MONTO_TOTAL]\nFecha de vencimiento: [FECHA_VENCIMIENTO]\n\nEl documento se adjunta a este correo y también está disponible en su portal.\n\nSaludos cordiales.",
              },
        },
      );

    if (invokeError || data?.error) {
      setError(
        data?.error ??
          invokeError?.message ??
          "No fue posible enviar.",
      );
    } else {
      setSuccess(
        collection
          ? "Cobranza enviada con copia oculta."
          : "Factura enviada con copia oculta.",
      );
    }

    setSaving(false);
    await load();
  }

  async function openInvoice(invoice: Invoice) {
    const path = invoice.storage_path || invoice.url_archivo;
    if (!path || path.startsWith("#")) {
      setError("La factura no tiene PDF.");
      return;
    }

    if (path.startsWith("http")) {
      window.open(path, "_blank", "noopener,noreferrer");
      return;
    }

    const { data, error: invokeError } =
      await getSupabaseBrowserClient().functions.invoke(
        "document-sign",
        { body: { bucket: "customer-invoices", path } },
      );

    if (invokeError || !data?.signedUrl) {
      setError("No fue posible abrir el documento.");
    } else {
      window.open(
        data.signedUrl,
        "_blank",
        "noopener,noreferrer",
      );
    }
  }

  function exportCsv() {
    const rows = filtered.map((invoice) => {
      const client = resolveClient(invoice);
      return [
        client?.empresa,
        client?.rut || invoice.cliente_rut,
        invoice.folio,
        invoice.mes_anio,
        invoice.fecha_emision,
        invoice.fecha_vencimiento,
        invoice.valor_neto,
        invoice.valor_total,
        invoice.estado,
        invoice.fecha_pago,
        invoice.metodo_pago,
        invoice.referencia_pago,
      ];
    });

    const csv = [
      [
        "Cliente",
        "RUT",
        "Folio",
        "Período",
        "Emisión",
        "Vencimiento",
        "Neto",
        "Total",
        "Estado",
        "Fecha pago",
        "Método",
        "Referencia",
      ],
      ...rows,
    ]
      .map((row) =>
        row
          .map(
            (value) =>
              `"${String(value ?? "").replaceAll('"', '""')}"`,
          )
          .join(";"),
      )
      .join("\n");

    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `facturacion-clientes-${today}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="admin-page">
      <div className="admin-heading">
        <div>
          <h1>Facturación de clientes</h1>
          <p>
            Lectura automática de PDF, historial por cliente, pagos,
            envío de facturas y cobranza.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="button-secondary !w-auto"
            onClick={() => void load()}
          >
            <RefreshCw size={17} /> Actualizar
          </button>
          <button
            className="button-secondary !w-auto"
            onClick={exportCsv}
          >
            <Download size={17} /> Exportar
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && (
        <div className="alert alert-success">{success}</div>
      )}

      <div className="metric-grid">
        {[
          ["Facturado", totals.invoiced],
          ["Pagado", totals.paid],
          ["Pendiente", totals.pending],
          ["Vencido", totals.overdue],
        ].map(([label, value]) => (
          <div className="metric-card" key={String(label)}>
            <span>{label}</span>
            <strong>{formatClp(Number(value))}</strong>
          </div>
        ))}
      </div>

      <section className="surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Carga inteligente</p>
            <h2 className="mt-2 text-xl font-black">
              Subir facturas PDF
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              El sistema leerá RUT, folio, fecha, neto y total. Todos
              los datos pueden revisarse antes de guardar.
            </p>
          </div>
          <label className="button-primary !w-auto cursor-pointer">
            <FilePlus2 size={17} /> Seleccionar PDFs
            <input
              className="hidden"
              type="file"
              multiple
              accept=".pdf,application/pdf"
              onChange={(event) =>
                void prepareFiles(event.target.files)
              }
            />
          </label>
        </div>

        {uploads.length > 0 && (
          <div className="mt-5 grid gap-3">
            {uploads.map((row) => (
              <div
                key={row.id}
                className="rounded-xl border border-slate-200 p-3"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <strong className="text-sm">
                      {row.file.name}
                    </strong>
                    <span className="ml-2 text-xs text-slate-500">
                      {Math.round(row.file.size / 1024)} KB
                    </span>
                  </div>
                  <span
                    className={`badge ${
                      row.status === "Listo"
                        ? "badge-green"
                        : row.status === "Error"
                          ? "badge-red"
                          : row.status === "Revisar"
                            ? "badge-orange"
                            : "badge-blue"
                    }`}
                  >
                    {row.status}
                  </span>
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  {row.detail}
                </p>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                  <div className="field">
                    <label>RUT cliente</label>
                    <input
                      value={row.rut}
                      onChange={(event) =>
                        updateUpload(row.id, {
                          rut: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Folio</label>
                    <input
                      value={row.folio}
                      onChange={(event) =>
                        updateUpload(row.id, {
                          folio: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Período</label>
                    <input
                      type="month"
                      value={row.period}
                      onChange={(event) =>
                        updateUpload(row.id, {
                          period: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Emisión</label>
                    <input
                      type="date"
                      value={row.issueDate}
                      onChange={(event) =>
                        updateUpload(row.id, {
                          issueDate: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Neto</label>
                    <input
                      type="number"
                      min="0"
                      value={row.net}
                      onChange={(event) =>
                        updateUpload(row.id, {
                          net: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Total</label>
                    <input
                      type="number"
                      min="1"
                      value={row.total}
                      onChange={(event) =>
                        updateUpload(row.id, {
                          total: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <button
                  className="button-secondary mt-3 !w-auto"
                  onClick={() =>
                    setUploads((rows) =>
                      rows.filter((item) => item.id !== row.id),
                    )
                  }
                >
                  Quitar
                </button>
              </div>
            ))}

            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={sendAfter}
                onChange={(event) =>
                  setSendAfter(event.target.checked)
                }
              />
              Enviar automáticamente con PDF adjunto y copia oculta a
              Globalcom
            </label>

            <button
              className="button-primary !w-auto"
              disabled={
                saving ||
                uploads.some(
                  (row) => row.status === "Analizando",
                )
              }
              onClick={() => void processUploads()}
            >
              {saving ? (
                <>
                  <LoaderCircle
                    className="animate-spin"
                    size={17}
                  />{" "}
                  Procesando…
                </>
              ) : (
                `Procesar ${uploads.length} factura(s)`
              )}
            </button>
          </div>
        )}
      </section>

      <section className="surface p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <div className="field">
            <label>Buscar</label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                className="!pl-10"
                placeholder="Cliente, RUT, folio o período"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label>Cliente</label>
            <select
              value={clientRut}
              onChange={(event) =>
                setClientRut(event.target.value)
              }
            >
              <option>Todos</option>
              {clients.map((client) => (
                <option key={client.rut} value={client.rut}>
                  {client.empresa}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="skeleton h-96" />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Factura</th>
                <th>Fechas</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Envío</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-slate-500"
                  >
                    No hay facturas registradas.
                  </td>
                </tr>
              ) : (
                filtered.map((invoice) => {
                  const client = resolveClient(invoice);
                  return (
                    <tr key={invoice.id}>
                      <td>
                        {client ? (
                          <>
                            <strong>{client.empresa}</strong>
                            <span className="block font-mono text-xs text-slate-500">
                              {client.rut}
                            </span>
                          </>
                        ) : (
                          <div className="min-w-52">
                            <strong className="text-orange-700">
                              Asignación pendiente
                            </strong>
                            <select
                              className="mt-2"
                              defaultValue=""
                              onChange={(event) =>
                                void assignInvoice(
                                  invoice,
                                  event.target.value,
                                )
                              }
                            >
                              <option value="">
                                Seleccionar cliente…
                              </option>
                              {clients.map((item) => (
                                <option
                                  key={item.rut}
                                  value={item.rut}
                                >
                                  {item.empresa} · {item.rut}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </td>
                      <td>
                        <strong>
                          {invoice.folio
                            ? `Folio ${invoice.folio}`
                            : invoice.mes_anio}
                        </strong>
                        <span className="block text-xs text-slate-500">
                          {invoice.mes_anio}
                        </span>
                      </td>
                      <td>
                        <span className="block text-sm">
                          Emisión:{" "}
                          {formatDate(invoice.fecha_emision)}
                        </span>
                        <span className="block text-xs text-slate-500">
                          Vence:{" "}
                          {formatDate(
                            invoice.fecha_vencimiento,
                          )}
                        </span>
                      </td>
                      <td>
                        <strong>
                          {formatClp(invoice.valor_total)}
                        </strong>
                        <span className="block text-xs text-slate-500">
                          Neto {formatClp(invoice.valor_neto)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            invoice.estado === "Pagada"
                              ? "badge-green"
                              : invoice.estado === "Vencida"
                                ? "badge-red"
                                : "badge-blue"
                          }`}
                        >
                          {invoice.estado}
                        </span>
                        {invoice.fecha_pago && (
                          <span className="block text-xs text-slate-500">
                            Pago {formatDate(invoice.fecha_pago)} ·{" "}
                            {invoice.metodo_pago}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            invoice.email_status === "sent"
                              ? "badge-green"
                              : "badge-slate"
                          }`}
                        >
                          {invoice.email_status === "sent"
                            ? "Enviada"
                            : "Sin envío"}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="button-secondary !w-auto !px-3 !py-2"
                            onClick={() =>
                              void openInvoice(invoice)
                            }
                            title="Abrir PDF"
                          >
                            <ExternalLink size={15} />
                          </button>
                          {invoice.estado !== "Pagada" && (
                            <button
                              className="button-secondary !w-auto !px-3 !py-2"
                              onClick={() =>
                                setPaymentInvoice(invoice)
                              }
                            >
                              Marcar pagada
                            </button>
                          )}
                          <button
                            className="button-secondary !w-auto !px-3 !py-2"
                            disabled={saving || !client}
                            onClick={() =>
                              void sendInvoice(invoice, false)
                            }
                            title="Enviar factura"
                          >
                            <Send size={15} />
                          </button>
                          {invoice.estado !== "Pagada" && (
                            <button
                              className="button-secondary !w-auto !px-3 !py-2"
                              disabled={saving || !client}
                              onClick={() =>
                                void sendInvoice(invoice, true)
                              }
                            >
                              Cobrar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {paymentInvoice && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Actualizar estado</p>
                <h2 className="mt-2 text-2xl font-black">
                  Marcar factura pagada
                </h2>
              </div>
              <button
                className="button-secondary !w-auto"
                onClick={() => setPaymentInvoice(null)}
              >
                Cerrar
              </button>
            </div>
            <form
              className="modal-body grid gap-4"
              onSubmit={markPaid}
            >
              <div className="field">
                <label>Fecha de pago</label>
                <input
                  type="date"
                  required
                  value={paymentForm.date}
                  onChange={(event) =>
                    setPaymentForm({
                      ...paymentForm,
                      date: event.target.value,
                    })
                  }
                />
              </div>
              <div className="field">
                <label>Método</label>
                <select
                  value={paymentForm.method}
                  onChange={(event) =>
                    setPaymentForm({
                      ...paymentForm,
                      method: event.target.value,
                    })
                  }
                >
                  <option>Transferencia bancaria</option>
                  <option>Pago automático</option>
                  <option>Cheque</option>
                  <option>Tarjeta</option>
                  <option>Otro</option>
                </select>
              </div>
              <div className="field">
                <label>Código / referencia de pago</label>
                <input
                  value={paymentForm.reference}
                  onChange={(event) =>
                    setPaymentForm({
                      ...paymentForm,
                      reference: event.target.value,
                    })
                  }
                />
              </div>
              <button
                className="button-primary !w-auto"
                disabled={saving}
              >
                Guardar pago
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
