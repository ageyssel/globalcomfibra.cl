"use client";

import { useMemo, useState } from "react";
import {
  Download,
  FileText,
  LoaderCircle,
  X,
} from "@/components/icons";
import { formatClp, formatDate } from "@/lib/format";

export type FinancialReportEntity = {
  id: string;
  name: string;
  rut: string;
};

export type FinancialReportRow = {
  id: string;
  entityId: string;
  entityName: string;
  entityRut: string;
  documentType: string;
  folio: string;
  issueDate: string | null;
  dueDate: string | null;
  paymentDate: string | null;
  total: number;
  credits: number;
  paid: number;
  balance: number;
  status: string;
  method: string | null;
  reference: string | null;
  description?: string | null;
};

type DateField = "issueDate" | "dueDate" | "paymentDate";
type DateMode = "historical" | "range";
type ExportFormat = "pdf" | "excel";

const today = new Date().toISOString().slice(0, 10);

function safeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 120);
}

function dateFieldName(value: DateField) {
  return {
    issueDate: "fecha de emisión",
    dueDate: "fecha de vencimiento",
    paymentDate: "fecha de pago",
  }[value];
}

function compactStatus(value: string) {
  return value.replaceAll("_", " ").trim();
}

export function FinancialPaymentReports({
  title,
  entityLabel,
  entities,
  rows,
}: {
  title: string;
  entityLabel: "Cliente" | "Proveedor";
  entities: FinancialReportEntity[];
  rows: FinancialReportRow[];
}) {
  const [open, setOpen] = useState(false);
  const [entityId, setEntityId] = useState("Todos");
  const [dateMode, setDateMode] = useState<DateMode>("historical");
  const [dateField, setDateField] = useState<DateField>("issueDate");
  const [dateFrom, setDateFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [dateTo, setDateTo] = useState(today);
  const [status, setStatus] = useState("Todos");
  const [exporting, setExporting] = useState<ExportFormat | "">("");
  const [error, setError] = useState("");

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.status).filter(Boolean))).sort(
        (left, right) => left.localeCompare(right, "es"),
      ),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows
      .filter((row) => entityId === "Todos" || row.entityId === entityId)
      .filter((row) => status === "Todos" || row.status === status)
      .filter((row) => {
        if (dateMode === "historical") return true;
        const value = row[dateField];
        if (!value) return false;
        if (dateFrom && value < dateFrom) return false;
        if (dateTo && value > dateTo) return false;
        return true;
      })
      .sort((left, right) => {
        const dateComparison = String(right.issueDate ?? "").localeCompare(
          String(left.issueDate ?? ""),
        );
        if (dateComparison !== 0) return dateComparison;
        return left.entityName.localeCompare(right.entityName, "es");
      });
  }, [rows, entityId, status, dateMode, dateField, dateFrom, dateTo]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (result, row) => ({
          total: result.total + Number(row.total || 0),
          credits: result.credits + Number(row.credits || 0),
          paid: result.paid + Number(row.paid || 0),
          balance: result.balance + Number(row.balance || 0),
        }),
        { total: 0, credits: 0, paid: 0, balance: 0 },
      ),
    [filtered],
  );

  const selectedEntity =
    entityId === "Todos"
      ? null
      : entities.find((entity) => entity.id === entityId) ?? null;

  const scopeText = selectedEntity
    ? `${entityLabel}: ${selectedEntity.name} · ${selectedEntity.rut}`
    : `${entityLabel}s: todos`;

  const periodText =
    dateMode === "historical"
      ? "Período: histórico completo"
      : `Período por ${dateFieldName(dateField)}: ${formatDate(dateFrom)} al ${formatDate(dateTo)}`;

  const baseFilename = safeFilename(
    `${title}-${selectedEntity?.name ?? "general"}-${
      dateMode === "historical" ? "historico" : `${dateFrom}-${dateTo}`
    }`,
  );

  function validate() {
    if (!filtered.length) {
      throw new Error("No existen movimientos para los filtros seleccionados.");
    }

    if (
      dateMode === "range" &&
      (!dateFrom || !dateTo || dateFrom > dateTo)
    ) {
      throw new Error("El rango de fechas no es válido.");
    }
  }

  async function exportPdf() {
    setExporting("pdf");
    setError("");

    try {
      validate();

      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const document = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      document.setFontSize(16);
      document.text(title, 14, 15);
      document.setFontSize(9);
      document.text(scopeText, 14, 21);
      document.text(periodText, 14, 26);
      document.text(`Estado: ${status === "Todos" ? "todos" : status}`, 14, 31);
      document.text(`Generado: ${formatDate(today)}`, 250, 15);

      autoTable(document, {
        startY: 36,
        theme: "grid",
        head: [["Documentos", "Facturado", "Notas de crédito", "Pagado", "Saldo"]],
        body: [[
          String(filtered.length),
          formatClp(totals.total),
          formatClp(totals.credits),
          formatClp(totals.paid),
          formatClp(totals.balance),
        ]],
        styles: { fontSize: 8, cellPadding: 2.2 },
        headStyles: { fontStyle: "bold" },
      });

      autoTable(document, {
        startY: 55,
        theme: "striped",
        head: [[
          entityLabel,
          "RUT",
          "Documento",
          "Folio",
          "Emisión",
          "Vencimiento",
          "Pago",
          "Total",
          "Créditos",
          "Pagado",
          "Saldo",
          "Estado",
          "Método / referencia",
        ]],
        body: filtered.map((row) => [
          row.entityName,
          row.entityRut,
          row.documentType,
          row.folio,
          formatDate(row.issueDate),
          formatDate(row.dueDate),
          formatDate(row.paymentDate),
          formatClp(row.total),
          formatClp(row.credits),
          formatClp(row.paid),
          formatClp(row.balance),
          compactStatus(row.status),
          [row.method, row.reference].filter(Boolean).join(" · ") || "—",
        ]),
        styles: {
          fontSize: 6.3,
          cellPadding: 1.4,
          overflow: "linebreak",
        },
        headStyles: { fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 31 },
          1: { cellWidth: 19 },
          2: { cellWidth: 24 },
          3: { cellWidth: 15 },
          12: { cellWidth: 33 },
        },
        margin: { top: 12, right: 8, bottom: 12, left: 8 },
        didDrawPage: () => {
          const page = document.getCurrentPageInfo().pageNumber;
          document.setFontSize(7);
          document.text(
            `Página ${page}`,
            document.internal.pageSize.getWidth() - 22,
            document.internal.pageSize.getHeight() - 5,
          );
        },
      });

      document.save(`${baseFilename || "estado-de-pagos"}.pdf`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible generar el PDF.",
      );
    } finally {
      setExporting("");
    }
  }

  async function exportExcel() {
    setExporting("excel");
    setError("");

    try {
      validate();

      const { default: writeXlsxFile } = await import("write-excel-file/browser");

      const headerStyle = {
        fontWeight: "bold" as const,
        backgroundColor: "#E2E8F0",
        align: "center" as const,
      };

      const data = [
        [{ value: title, fontWeight: "bold" as const, fontSize: 16 }],
        [{ value: scopeText }],
        [{ value: periodText }],
        [{ value: `Estado: ${status === "Todos" ? "todos" : status}` }],
        [{ value: `Generado: ${formatDate(today)}` }],
        [],
        [
          { value: "Documentos", ...headerStyle },
          { value: "Facturado", ...headerStyle },
          { value: "Notas de crédito", ...headerStyle },
          { value: "Pagado", ...headerStyle },
          { value: "Saldo", ...headerStyle },
        ],
        [
          { value: filtered.length, type: Number },
          { value: totals.total, type: Number, format: "#,##0" },
          { value: totals.credits, type: Number, format: "#,##0" },
          { value: totals.paid, type: Number, format: "#,##0" },
          { value: totals.balance, type: Number, format: "#,##0" },
        ],
        [],
        [
          { value: entityLabel, ...headerStyle },
          { value: "RUT", ...headerStyle },
          { value: "Documento", ...headerStyle },
          { value: "Folio", ...headerStyle },
          { value: "Emisión", ...headerStyle },
          { value: "Vencimiento", ...headerStyle },
          { value: "Fecha pago", ...headerStyle },
          { value: "Total", ...headerStyle },
          { value: "Notas de crédito", ...headerStyle },
          { value: "Pagado", ...headerStyle },
          { value: "Saldo", ...headerStyle },
          { value: "Estado", ...headerStyle },
          { value: "Método", ...headerStyle },
          { value: "Referencia", ...headerStyle },
          { value: "Descripción", ...headerStyle },
        ],
        ...filtered.map((row) => [
          { value: row.entityName },
          { value: row.entityRut },
          { value: row.documentType },
          { value: row.folio },
          { value: row.issueDate ?? "" },
          { value: row.dueDate ?? "" },
          { value: row.paymentDate ?? "" },
          { value: row.total, type: Number, format: "#,##0" },
          { value: row.credits, type: Number, format: "#,##0" },
          { value: row.paid, type: Number, format: "#,##0" },
          { value: row.balance, type: Number, format: "#,##0" },
          { value: compactStatus(row.status) },
          { value: row.method ?? "" },
          { value: row.reference ?? "" },
          { value: row.description ?? "" },
        ]),
      ];

      await writeXlsxFile(data, {
        fileName: `${baseFilename || "estado-de-pagos"}.xlsx`,
        sheet: "Estado de pagos",
        columns: [
          { width: 30 },
          { width: 16 },
          { width: 23 },
          { width: 14 },
          { width: 13 },
          { width: 13 },
          { width: 13 },
          { width: 15 },
          { width: 15 },
          { width: 15 },
          { width: 15 },
          { width: 18 },
          { width: 22 },
          { width: 24 },
          { width: 40 },
        ],
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible generar el Excel.",
      );
    } finally {
      setExporting("");
    }
  }

  return (
    <>
      <button
        className="button-secondary !w-auto"
        onClick={() => setOpen(true)}
      >
        <Download size={17} /> Reportes PDF / Excel
      </button>

      {open && (
        <div className="modal-backdrop">
          <div className="modal-card !max-w-5xl">
            <div className="modal-header">
              <div>
                <p className="eyebrow">Reportes financieros</p>
                <h2 className="mt-2 text-2xl font-black">{title}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Descarga el estado general o individual, histórico o por rango
                  de fechas.
                </p>
              </div>
              <button
                className="button-secondary !w-auto"
                onClick={() => setOpen(false)}
              >
                <X size={17} /> Cerrar
              </button>
            </div>

            <div className="modal-body grid gap-5">
              {error && <div className="alert alert-error">{error}</div>}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="field">
                  <label>{entityLabel}</label>
                  <select
                    value={entityId}
                    onChange={(event) => setEntityId(event.target.value)}
                  >
                    <option value="Todos">Todos</option>
                    {entities.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.name} · {entity.rut}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Período</label>
                  <select
                    value={dateMode}
                    onChange={(event) =>
                      setDateMode(event.target.value as DateMode)
                    }
                  >
                    <option value="historical">Histórico completo</option>
                    <option value="range">Rango de fechas</option>
                  </select>
                </div>

                <div className="field">
                  <label>Estado</label>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    <option value="Todos">Todos</option>
                    {statusOptions.map((value) => (
                      <option key={value} value={value}>
                        {compactStatus(value)}
                      </option>
                    ))}
                  </select>
                </div>

                {dateMode === "range" && (
                  <div className="field">
                    <label>Filtrar por</label>
                    <select
                      value={dateField}
                      onChange={(event) =>
                        setDateField(event.target.value as DateField)
                      }
                    >
                      <option value="issueDate">Fecha de emisión</option>
                      <option value="dueDate">Fecha de vencimiento</option>
                      <option value="paymentDate">Fecha de pago</option>
                    </select>
                  </div>
                )}
              </div>

              {dateMode === "range" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="field">
                    <label>Desde</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(event) => setDateFrom(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Hasta</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(event) => setDateTo(event.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="metric-grid">
                {[
                  ["Documentos", filtered.length, false],
                  ["Facturado", totals.total, true],
                  ["Notas de crédito", totals.credits, true],
                  ["Pagado", totals.paid, true],
                  ["Saldo", totals.balance, true],
                ].map(([label, value, currency]) => (
                  <div className="metric-card" key={String(label)}>
                    <span>{label}</span>
                    <strong>
                      {currency
                        ? formatClp(Number(value))
                        : Number(value)}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <strong>{scopeText}</strong>
                <span className="mt-1 block">{periodText}</span>
                <span className="mt-1 block">
                  Se exportarán {filtered.length} movimiento(s).
                </span>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  className="button-primary !w-auto"
                  disabled={Boolean(exporting)}
                  onClick={() => void exportPdf()}
                >
                  {exporting === "pdf" ? (
                    <>
                      <LoaderCircle className="animate-spin" size={17} />
                      Generando PDF…
                    </>
                  ) : (
                    <>
                      <FileText size={17} /> Descargar PDF
                    </>
                  )}
                </button>

                <button
                  className="button-secondary !w-auto"
                  disabled={Boolean(exporting)}
                  onClick={() => void exportExcel()}
                >
                  {exporting === "excel" ? (
                    <>
                      <LoaderCircle className="animate-spin" size={17} />
                      Generando Excel…
                    </>
                  ) : (
                    <>
                      <Download size={17} /> Descargar Excel
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
