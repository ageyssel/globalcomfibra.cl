"use client";

import { useMemo, useState } from "react";
import { readSheet } from "read-excel-file/browser";
import {
  AlertTriangle,
  CheckCircle2,
  FilePlus2,
  LoaderCircle,
} from "@/components/icons";
import { formatClp, formatDate } from "@/lib/format";
import {
  parseSiiDteRows,
  type ExcelCell,
  type SiiDteDocument,
} from "@/lib/sii-dte-excel";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type PreviewAllocation = {
  invoiceId: string;
  invoiceFolio: string;
  invoiceType: string;
  amount: number;
  source: string;
};

type PreviewItem = SiiDteDocument & {
  documentType: string;
  kind: "invoice" | "credit" | "excluded" | "unsupported";
  status: "ready" | "duplicate" | "excluded" | "rejected";
  message: string;
  suggestedAllocations: PreviewAllocation[];
};

type PreviewResponse = {
  success: boolean;
  summary: {
    total: number;
    invoicesReady: number;
    creditsReady: number;
    duplicates: number;
    excluded: number;
    rejected: number;
    invoiceAmount: number;
    creditAmount: number;
  };
  items: PreviewItem[];
  error?: string;
};

const dueDateOptions = [
  {
    value: "pending_review",
    label: "Sin vencimiento: dejar pendiente de revisión",
  },
  {
    value: "issue_date",
    label: "Usar la fecha de emisión",
  },
  {
    value: "days_15",
    label: "Agregar 15 días",
  },
  {
    value: "days_30",
    label: "Agregar 30 días",
  },
  {
    value: "days_45",
    label: "Agregar 45 días",
  },
  {
    value: "days_60",
    label: "Agregar 60 días",
  },
];

function statusLabel(value: PreviewItem["status"]) {
  return {
    ready: "Listo",
    duplicate: "Duplicado",
    excluded: "Excluido",
    rejected: "Rechazado",
  }[value];
}

function statusClass(value: PreviewItem["status"]) {
  if (value === "ready") return "badge-green";
  if (value === "duplicate") return "badge-blue";
  if (value === "excluded") return "badge-orange";
  return "badge-red";
}

function kindLabel(value: PreviewItem["kind"]) {
  return {
    invoice: "Factura",
    credit: "Nota de crédito",
    excluded: "Documento informativo",
    unsupported: "No soportado",
  }[value];
}

export function SupplierSiiExcelImporter({
  onImported,
}: {
  onImported: () => Promise<void>;
}) {
  const [filename, setFilename] = useState("");
  const [documents, setDocuments] = useState<SiiDteDocument[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [dueDateStrategy, setDueDateStrategy] = useState(
    "pending_review",
  );
  const [createMissing, setCreateMissing] = useState(true);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canCommit = useMemo(
    () =>
      Boolean(preview) &&
      (
        (preview?.summary.invoicesReady ?? 0) +
        (preview?.summary.creditsReady ?? 0)
      ) > 0 &&
      (preview?.summary.rejected ?? 0) === 0,
    [preview],
  );

  async function request(
    mode: "preview" | "commit",
  ) {
    const { data, error: invokeError } =
      await getSupabaseBrowserClient().functions.invoke(
        "import-sii-dte-excel",
        {
          body: {
            mode,
            filename,
            documents,
            dueDateStrategy,
            createMissingSuppliers: createMissing,
          },
        },
      );

    if (invokeError || data?.error) {
      throw new Error(
        data?.error ??
          invokeError?.message ??
          "No fue posible procesar el archivo.",
      );
    }

    return data;
  }

  async function selectFile(file: File | null) {
    if (!file) return;

    setReading(true);
    setError("");
    setSuccess("");
    setPreview(null);
    setDocuments([]);
    setWarnings([]);

    try {
      if (!file.name.toLowerCase().endsWith(".xlsx")) {
        throw new Error(
          "Selecciona el archivo Excel .xlsx descargado desde el SII.",
        );
      }

      if (file.size > 20 * 1024 * 1024) {
        throw new Error("El archivo supera el máximo de 20 MB.");
      }

      const rows = await readSheet(file);
      const parsed = parseSiiDteRows(
        rows as ExcelCell[][],
      );

      if (!parsed.documents.length) {
        throw new Error(
          "No se encontraron documentos DTE en la primera hoja.",
        );
      }

      setFilename(file.name);
      setDocuments(parsed.documents);
      setWarnings(parsed.warnings);

      const { data, error: invokeError } =
        await getSupabaseBrowserClient().functions.invoke(
          "import-sii-dte-excel",
          {
            body: {
              mode: "preview",
              filename: file.name,
              documents: parsed.documents,
              dueDateStrategy,
              createMissingSuppliers: createMissing,
            },
          },
        );

      if (invokeError || data?.error) {
        throw new Error(
          data?.error ??
            invokeError?.message ??
            "No fue posible validar el archivo.",
        );
      }

      setPreview(data as PreviewResponse);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Archivo Excel inválido.",
      );
    } finally {
      setReading(false);
    }
  }

  async function refreshPreview() {
    if (!documents.length) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      setPreview(await request("preview") as PreviewResponse);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible actualizar la vista previa.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function commitImport() {
    if (!canCommit) return;

    const confirmed = window.confirm(
      "Se importarán las facturas nuevas y las notas de crédito se descontarán automáticamente de la deuda abierta de cada proveedor. ¿Confirmas la importación?",
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const data = await request("commit");

      setSuccess(
        `Importación completada: ${data.importedInvoices} factura(s), ` +
        `${data.importedCredits} nota(s) de crédito, ` +
        `${formatClp(data.allocatedCreditAmount)} descontados de deuda, ` +
        `${data.duplicates} duplicado(s), ${data.excluded} excluido(s) y ` +
        `${data.rejected} rechazado(s).`,
      );

      setPreview(null);
      setDocuments([]);
      setWarnings([]);
      setFilename("");
      await onImported();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible confirmar la importación.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface p-6">
      <div className="max-w-6xl">
        <p className="eyebrow">Importación nativa del SII</p>
        <h2 className="mt-2 text-2xl font-black">
          Cargar historial DTE en formato Excel
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Sube directamente el archivo .xlsx descargado desde el SII.
          El sistema consolidará las líneas de detalle, excluirá guías
          de despacho, detectará duplicados e importará las notas de
          crédito como descuentos de la deuda del proveedor.
        </p>

        {error && <div className="alert alert-error mt-5">{error}</div>}
        {success && (
          <div className="alert alert-success mt-5">{success}</div>
        )}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="field">
            <label htmlFor="sii-xlsx">
              Archivo original del SII (.xlsx)
            </label>
            <input
              id="sii-xlsx"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={reading || saving}
              onChange={(event) =>
                void selectFile(event.target.files?.[0] ?? null)
              }
            />
            {filename && (
              <span className="text-xs text-slate-500">
                Archivo: {filename}
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="sii-due-date">
              Tratamiento de facturas sin vencimiento
            </label>
            <select
              id="sii-due-date"
              value={dueDateStrategy}
              disabled={reading || saving}
              onChange={(event) => {
                setDueDateStrategy(event.target.value);
                setPreview(null);
              }}
            >
              {dueDateOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={createMissing}
            disabled={reading || saving}
            onChange={(event) => {
              setCreateMissing(event.target.checked);
              setPreview(null);
            }}
          />
          Crear automáticamente proveedores que no existan
        </label>

        {reading && (
          <div className="mt-5 flex items-center gap-2 rounded-xl bg-blue-50 p-4 text-sm font-bold text-blue-900">
            <LoaderCircle className="animate-spin" size={18} />
            Leyendo y validando el Excel…
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4">
            <div className="flex items-center gap-2 font-black text-orange-900">
              <AlertTriangle size={18} />
              Observaciones del archivo
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-orange-900">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {documents.length > 0 && !preview && !reading && (
          <button
            className="button-secondary mt-5 !w-auto"
            disabled={saving}
            onClick={() => void refreshPreview()}
          >
            {saving ? (
              <>
                <LoaderCircle className="animate-spin" size={17} />
                Validando…
              </>
            ) : (
              <>
                <CheckCircle2 size={17} />
                Actualizar vista previa
              </>
            )}
          </button>
        )}

        {preview && (
          <>
            <div className="metric-grid mt-6">
              {[
                [
                  "Facturas nuevas",
                  preview.summary.invoicesReady,
                  formatClp(preview.summary.invoiceAmount),
                ],
                [
                  "Notas de crédito",
                  preview.summary.creditsReady,
                  `-${formatClp(preview.summary.creditAmount)}`,
                ],
                [
                  "Duplicados",
                  preview.summary.duplicates,
                  "No se importan",
                ],
                [
                  "Guías excluidas",
                  preview.summary.excluded,
                  "No afectan deuda",
                ],
                [
                  "Rechazados",
                  preview.summary.rejected,
                  "Requieren corrección",
                ],
              ].map(([label, count, detail], index) => (
                <div className="metric-card" key={String(label)}>
                  <div
                    className={`grid size-10 place-items-center rounded-xl ${
                      index < 2
                        ? "bg-emerald-50 text-emerald-700"
                        : index === 4
                          ? "bg-red-50 text-red-700"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {index < 2 ? (
                      <CheckCircle2 size={19} />
                    ) : (
                      <AlertTriangle size={19} />
                    )}
                  </div>
                  <span className="mt-5 block">{label}</span>
                  <strong>{Number(count)}</strong>
                  <small className="mt-1 block text-xs text-slate-500">
                    {String(detail)}
                  </small>
                </div>
              ))}
            </div>

            <div className="mt-6 overflow-auto rounded-xl border border-slate-200">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Proveedor</th>
                    <th>Documento</th>
                    <th>Emisión</th>
                    <th>Total</th>
                    <th>Resultado</th>
                    <th>Aplicación del crédito</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.map((item) => (
                    <tr
                      key={`${item.sourceRowNumber}-${item.dteType}-${item.folio}`}
                    >
                      <td>{item.sourceRowNumber}</td>
                      <td>
                        <strong className="block">
                          {item.supplierName}
                        </strong>
                        <span className="font-mono text-xs text-slate-500">
                          {item.supplierRut}
                        </span>
                      </td>
                      <td>
                        <strong className="block">
                          {kindLabel(item.kind)}
                        </strong>
                        <span className="block text-xs text-slate-500">
                          {item.documentType} · Folio {item.folio}
                        </span>
                      </td>
                      <td>{formatDate(item.issueDate)}</td>
                      <td
                        className={
                          item.kind === "credit"
                            ? "font-black text-emerald-700"
                            : "font-black"
                        }
                      >
                        {item.kind === "credit" ? "−" : ""}
                        {formatClp(item.totalAmount)}
                      </td>
                      <td>
                        <span
                          className={`badge ${statusClass(item.status)}`}
                        >
                          {statusLabel(item.status)}
                        </span>
                        <span className="mt-2 block max-w-xs text-xs text-slate-500">
                          {item.message}
                        </span>
                      </td>
                      <td>
                        {item.suggestedAllocations.length === 0 ? (
                          <span className="text-xs text-slate-500">
                            —
                          </span>
                        ) : (
                          <div className="grid gap-1">
                            {item.suggestedAllocations.map(
                              (allocation) => (
                                <span
                                  className="text-xs"
                                  key={`${item.folio}-${allocation.invoiceId}`}
                                >
                                  {allocation.invoiceType}{" "}
                                  {allocation.invoiceFolio}:{" "}
                                  <strong>
                                    {formatClp(allocation.amount)}
                                  </strong>
                                </span>
                              ),
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview.summary.rejected > 0 && (
              <div className="alert alert-error mt-5">
                Corrige los documentos rechazados antes de confirmar.
                La importación está bloqueada para evitar una carga
                parcial involuntaria.
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                className="button-secondary !w-auto"
                disabled={saving}
                onClick={() => void refreshPreview()}
              >
                <CheckCircle2 size={17} />
                Revalidar
              </button>
              <button
                className="button-primary !w-auto"
                disabled={saving || !canCommit}
                onClick={() => void commitImport()}
              >
                {saving ? (
                  <>
                    <LoaderCircle className="animate-spin" size={17} />
                    Importando…
                  </>
                ) : (
                  <>
                    <FilePlus2 size={17} />
                    Confirmar facturas y créditos
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
