import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  adminClient,
  audit,
  errorResponse,
  handleOptions,
  HttpError,
  json,
  normalizeRut,
  requireIdentity,
  text,
} from "../_shared/platform.ts";

type RawDetail = {
  item?: unknown;
  code?: unknown;
  description?: unknown;
  quantity?: unknown;
  price?: unknown;
  itemAmount?: unknown;
};

type RawDocument = {
  sourceRowNumber?: unknown;
  dteType?: unknown;
  folio?: unknown;
  issueDate?: unknown;
  supplierRut?: unknown;
  supplierName?: unknown;
  supplierBusinessActivity?: unknown;
  supplierAddress?: unknown;
  supplierCommune?: unknown;
  supplierCity?: unknown;
  receiverRut?: unknown;
  receiverName?: unknown;
  netAmount?: unknown;
  exemptAmount?: unknown;
  taxAmount?: unknown;
  otherTaxes?: unknown;
  totalAmount?: unknown;
  description?: unknown;
  details?: RawDetail[];
};

type ParsedDocument = {
  sourceRowNumber: number;
  dteType: number;
  documentType: string;
  kind: "invoice" | "credit" | "excluded" | "unsupported";
  folio: string;
  issueDate: string;
  supplierRut: string;
  supplierName: string;
  supplierBusinessActivity: string;
  supplierAddress: string;
  supplierCommune: string;
  supplierCity: string;
  receiverRut: string;
  receiverName: string;
  netAmount: number;
  exemptAmount: number;
  taxAmount: number;
  otherTaxes: number;
  totalAmount: number;
  description: string;
  raw: RawDocument;
};

const typeNames: Record<number, string> = {
  30: "Factura",
  32: "Factura no afecta o exenta",
  33: "Factura electrónica",
  34: "Factura no afecta o exenta electrónica",
  45: "Factura de compra",
  46: "Factura de compra electrónica",
  50: "Guía de despacho",
  52: "Guía de despacho electrónica",
  60: "Nota de crédito",
  61: "Nota de crédito electrónica",
};

const invoiceTypes = new Set([30, 32, 33, 34, 45, 46]);
const creditTypes = new Set([60, 61]);
const excludedTypes = new Set([50, 52]);

function numeric(value: unknown) {
  if (typeof value === "number") return value;

  return Number(
    String(value ?? "")
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, ""),
  );
}

function isoDate(value: unknown) {
  const raw = text(value, 30);

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const local = raw.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/,
  );

  if (!local) return "";

  return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
}

function compactRut(value: string) {
  return value.toUpperCase().replace(/[^0-9K]/g, "");
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dueDateFor(issueDate: string, strategy: string) {
  const days = ({
    days_15: 15,
    days_30: 30,
    days_45: 45,
    days_60: 60,
  } as Record<string, number>)[strategy];

  if (strategy === "issue_date") return issueDate;
  if (!days) return null;
  return addDays(issueDate, days);
}

function parseDocument(raw: RawDocument, index: number): ParsedDocument {
  const dteType = Math.trunc(numeric(raw.dteType));
  const folio = text(raw.folio, 80);
  const issueDate = isoDate(raw.issueDate);
  const supplierRut = normalizeRut(raw.supplierRut);
  const supplierName = text(raw.supplierName, 240);
  const receiverRut = normalizeRut(raw.receiverRut);
  const netAmount = numeric(raw.netAmount ?? 0);
  const exemptAmount = numeric(raw.exemptAmount ?? 0);
  const taxAmount = numeric(raw.taxAmount ?? 0);
  const otherTaxes = numeric(raw.otherTaxes ?? 0);
  const totalAmount = numeric(raw.totalAmount);
  const calculated =
    netAmount + exemptAmount + taxAmount + otherTaxes;

  if (
    !Number.isInteger(dteType) ||
    !folio ||
    !issueDate ||
    !supplierName ||
    !Number.isFinite(totalAmount) ||
    totalAmount <= 0
  ) {
    throw new Error(
      `Documento inválido en la fila ${Number(raw.sourceRowNumber) || index + 2}.`,
    );
  }

  if (
    [netAmount, exemptAmount, taxAmount, otherTaxes].some(
      (value) => !Number.isFinite(value) || value < 0,
    )
  ) {
    throw new Error(`Montos inválidos en el folio ${folio}.`);
  }

  if (Math.abs(calculated - totalAmount) > 1) {
    throw new Error(
      `Los montos del folio ${folio} no cuadran: ${calculated} versus ${totalAmount}.`,
    );
  }

  const kind = invoiceTypes.has(dteType)
    ? "invoice"
    : creditTypes.has(dteType)
      ? "credit"
      : excludedTypes.has(dteType)
        ? "excluded"
        : "unsupported";

  return {
    sourceRowNumber:
      Math.max(1,Math.trunc(numeric(raw.sourceRowNumber))) ||
      index + 2,
    dteType,
    documentType: typeNames[dteType] ?? `DTE ${dteType}`,
    kind,
    folio,
    issueDate,
    supplierRut,
    supplierName,
    supplierBusinessActivity: text(
      raw.supplierBusinessActivity,
      300,
    ),
    supplierAddress: [
      text(raw.supplierAddress, 300),
      text(raw.supplierCommune, 100),
      text(raw.supplierCity, 100),
    ].filter(Boolean).join(", "),
    supplierCommune: text(raw.supplierCommune, 100),
    supplierCity: text(raw.supplierCity, 100),
    receiverRut,
    receiverName: text(raw.receiverName, 240),
    netAmount,
    exemptAmount,
    taxAmount,
    otherTaxes,
    totalAmount,
    description:
      text(raw.description, 1000) ||
      (Array.isArray(raw.details)
        ? raw.details
            .map((detail) => text(detail.description, 300))
            .filter(Boolean)
            .join(" · ")
            .slice(0, 1000)
        : ""),
    raw,
  };
}

async function loadFinanceState(
  admin: ReturnType<typeof adminClient>,
) {
  const [suppliersResult, invoicesResult, creditsResult] =
    await Promise.all([
      admin
        .from("suppliers")
        .select("id,rut,legal_name")
        .is("deleted_at", null),
      admin
        .from("supplier_invoice_summary")
        .select(
          "id,supplier_id,supplier_rut,document_type,dte_type_code,folio,issue_date,total_amount,balance_due",
        ),
      admin
        .from("supplier_credit_note_summary")
        .select(
          "id,supplier_id,supplier_rut,dte_type_code,folio,total_amount,available_amount",
        ),
    ]);

  const firstError =
    suppliersResult.error ||
    invoicesResult.error ||
    creditsResult.error;

  if (firstError) throw firstError;

  return {
    suppliers: suppliersResult.data ?? [],
    invoices: invoicesResult.data ?? [],
    credits: creditsResult.data ?? [],
  };
}

function previewDocuments(
  documents: ParsedDocument[],
  state: Awaited<ReturnType<typeof loadFinanceState>>,
  expectedReceiverRut: string,
  createMissing: boolean,
) {
  const suppliersByRut = new Map(
    state.suppliers.map((supplier) => [
      compactRut(String(supplier.rut)),
      supplier,
    ]),
  );

  const virtualInvoices = state.invoices.map((invoice) => ({
    id: String(invoice.id),
    supplierRut: compactRut(String(invoice.supplier_rut)),
    folio: String(invoice.folio),
    documentType: String(invoice.document_type),
    dteType: Number(invoice.dte_type_code ?? 0),
    issueDate: String(invoice.issue_date),
    totalAmount: Number(invoice.total_amount),
    balanceDue: Number(invoice.balance_due),
    source: "existing",
  }));

  const existingCreditKeys = new Set(
    state.credits.map(
      (credit) =>
        `${compactRut(String(credit.supplier_rut))}|${Number(credit.dte_type_code)}|${String(credit.folio)}`,
    ),
  );

  const items: Array<Record<string, unknown>> = [];
  let virtualCounter = 0;

  for (const document of documents.filter(
    (item) => item.kind === "invoice",
  )) {
    const supplierKey = compactRut(document.supplierRut);
    const supplier = suppliersByRut.get(supplierKey);
    const duplicate = virtualInvoices.some(
      (invoice) =>
        invoice.supplierRut === supplierKey &&
        invoice.folio === document.folio &&
        (
          invoice.dteType === document.dteType ||
          invoice.documentType === document.documentType
        ),
    );

    let status = "ready";
    let message = "Factura lista para importar.";

    if (compactRut(document.receiverRut) !== expectedReceiverRut) {
      status = "rejected";
      message = `RUT receptor distinto de Globalcom: ${document.receiverRut}.`;
    } else if (!supplier && !createMissing) {
      status = "rejected";
      message = `Proveedor ${document.supplierRut} no registrado.`;
    } else if (duplicate) {
      status = "duplicate";
      message = "La factura ya existe en el portal.";
    } else {
      virtualCounter++;
      virtualInvoices.push({
        id: `new-${virtualCounter}`,
        supplierRut: supplierKey,
        folio: document.folio,
        documentType: document.documentType,
        dteType: document.dteType,
        issueDate: document.issueDate,
        totalAmount: document.totalAmount,
        balanceDue: document.totalAmount,
        source: "batch",
      });
    }

    items.push({
      ...document,
      status,
      message,
      suggestedAllocations: [],
    });
  }

  for (const document of documents.filter(
    (item) => item.kind === "credit",
  )) {
    const supplierKey = compactRut(document.supplierRut);
    const supplier = suppliersByRut.get(supplierKey);
    const creditKey =
      `${supplierKey}|${document.dteType}|${document.folio}`;
    const duplicate = existingCreditKeys.has(creditKey);

    let status = "ready";
    let message = "Nota de crédito lista para aplicar.";
    const suggestedAllocations: Array<Record<string, unknown>> = [];

    if (compactRut(document.receiverRut) !== expectedReceiverRut) {
      status = "rejected";
      message = `RUT receptor distinto de Globalcom: ${document.receiverRut}.`;
    } else if (!supplier && !createMissing) {
      status = "rejected";
      message = `Proveedor ${document.supplierRut} no registrado.`;
    } else if (duplicate) {
      status = "duplicate";
      message = "La nota de crédito ya existe en el portal.";
    } else {
      let remaining = document.totalAmount;
      const candidates = virtualInvoices
        .filter(
          (invoice) =>
            invoice.supplierRut === supplierKey &&
            invoice.balanceDue > 0,
        )
        .sort((left, right) => {
          const exactLeft =
            Math.abs(left.balanceDue - remaining) <= 1 ? 0 : 1;
          const exactRight =
            Math.abs(right.balanceDue - remaining) <= 1 ? 0 : 1;

          if (exactLeft !== exactRight) {
            return exactLeft - exactRight;
          }

          const beforeLeft =
            left.issueDate <= document.issueDate ? 0 : 1;
          const beforeRight =
            right.issueDate <= document.issueDate ? 0 : 1;

          if (beforeLeft !== beforeRight) {
            return beforeLeft - beforeRight;
          }

          const leftDistance = Math.abs(
            new Date(document.issueDate).getTime() -
            new Date(left.issueDate).getTime(),
          );
          const rightDistance = Math.abs(
            new Date(document.issueDate).getTime() -
            new Date(right.issueDate).getTime(),
          );

          return leftDistance - rightDistance;
        });

      for (const candidate of candidates) {
        if (remaining <= 0) break;

        const amount = Math.min(
          remaining,
          candidate.balanceDue,
        );

        if (amount <= 0) continue;

        suggestedAllocations.push({
          invoiceId: candidate.id,
          invoiceFolio: candidate.folio,
          invoiceType: candidate.documentType,
          amount,
          source: candidate.source,
        });

        candidate.balanceDue -= amount;
        remaining -= amount;
      }

      if (remaining > 1) {
        message =
          `Se aplicarán ${document.totalAmount - remaining} y quedará ` +
          `${remaining} como crédito disponible del proveedor.`;
      } else {
        message =
          "La nota de crédito se descontará completamente de facturas abiertas.";
      }

      existingCreditKeys.add(creditKey);
    }

    items.push({
      ...document,
      status,
      message,
      suggestedAllocations,
    });
  }

  for (const document of documents.filter(
    (item) => item.kind === "excluded",
  )) {
    items.push({
      ...document,
      status: "excluded",
      message:
        "Guía de despacho excluida: no genera ni descuenta deuda.",
      suggestedAllocations: [],
    });
  }

  for (const document of documents.filter(
    (item) => item.kind === "unsupported",
  )) {
    items.push({
      ...document,
      status: "rejected",
      message: `Tipo DTE ${document.dteType} no soportado.`,
      suggestedAllocations: [],
    });
  }

  return items.sort(
    (left, right) =>
      Number(left.sourceRowNumber) -
      Number(right.sourceRowNumber),
  );
}

serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return json(req, { error: "Método no permitido." }, 405);
  }

  try {
    const { user, admin } = await requireIdentity(req, [
      "superadmin",
      "admin",
      "finance",
    ]);

    const body = await req.json();
    const mode = text(body.mode, 20) || "preview";
    const filename = text(body.filename, 240);
    const createMissing = body.createMissingSuppliers !== false;
    const dueDateStrategy =
      text(body.dueDateStrategy, 30) || "pending_review";
    const rawDocuments = Array.isArray(body.documents)
      ? body.documents as RawDocument[]
      : [];

    if (!["preview", "commit"].includes(mode)) {
      throw new HttpError(400, "Modo de importación inválido.");
    }

    if (
      ![
        "pending_review",
        "issue_date",
        "days_15",
        "days_30",
        "days_45",
        "days_60",
      ].includes(dueDateStrategy)
    ) {
      throw new HttpError(400, "Estrategia de vencimiento inválida.");
    }

    if (!rawDocuments.length || rawDocuments.length > 1000) {
      throw new HttpError(
        400,
        "El archivo debe contener entre 1 y 1000 documentos.",
      );
    }

    const documents = rawDocuments.map(parseDocument);
    const expectedReceiverRut = compactRut(
      Deno.env.get("GLOBALCOM_RECEIVER_RUT") ??
        "77.812.215-4",
    );
    const state = await loadFinanceState(admin);
    const preview = previewDocuments(
      documents,
      state,
      expectedReceiverRut,
      createMissing,
    );

    const summary = {
      total: preview.length,
      invoicesReady: preview.filter(
        (item) =>
          item.kind === "invoice" && item.status === "ready",
      ).length,
      creditsReady: preview.filter(
        (item) =>
          item.kind === "credit" && item.status === "ready",
      ).length,
      duplicates: preview.filter(
        (item) => item.status === "duplicate",
      ).length,
      excluded: preview.filter(
        (item) => item.status === "excluded",
      ).length,
      rejected: preview.filter(
        (item) => item.status === "rejected",
      ).length,
      invoiceAmount: preview
        .filter(
          (item) =>
            item.kind === "invoice" && item.status === "ready",
        )
        .reduce(
          (sum, item) => sum + Number(item.totalAmount),
          0,
        ),
      creditAmount: preview
        .filter(
          (item) =>
            item.kind === "credit" && item.status === "ready",
        )
        .reduce(
          (sum, item) => sum + Number(item.totalAmount),
          0,
        ),
    };

    if (mode === "preview") {
      return json(req, {
        success: true,
        mode,
        summary,
        items: preview,
      });
    }

    const { data: batch, error: batchError } = await admin
      .from("supplier_import_batches")
      .insert({
        source: "sii_xlsx",
        original_filename: filename || null,
        total_rows: documents.length,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (batchError || !batch) {
      throw batchError ??
        new Error("No fue posible crear el lote.");
    }

    const suppliersByRut = new Map(
      state.suppliers.map((supplier) => [
        compactRut(String(supplier.rut)),
        supplier,
      ]),
    );

    let importedInvoices = 0;
    let importedCredits = 0;
    let allocatedCreditAmount = 0;
    let duplicates = 0;
    let excluded = 0;
    let rejected = 0;

    async function registerRow(
      document: ParsedDocument,
      status: string,
      values: {
        invoiceId?: string | null;
        creditNoteId?: string | null;
        error?: string | null;
      } = {},
    ) {
      const { error } = await admin
        .from("supplier_import_rows")
        .insert({
          batch_id: batch.id,
          row_number: document.sourceRowNumber,
          raw_data: document.raw,
          document_kind: document.kind,
          status,
          supplier_invoice_id: values.invoiceId ?? null,
          supplier_credit_note_id:
            values.creditNoteId ?? null,
          error_message: values.error ?? null,
        });

      if (error) throw error;
    }

    async function resolveSupplier(document: ParsedDocument) {
      const key = compactRut(document.supplierRut);
      const existing = suppliersByRut.get(key);

      if (existing) return existing;

      if (!createMissing) {
        throw new Error(
          `Proveedor ${document.supplierRut} no registrado.`,
        );
      }

      const { data, error } = await admin
        .from("suppliers")
        .insert({
          legal_name: document.supplierName,
          rut: document.supplierRut,
          business_activity:
            document.supplierBusinessActivity || null,
          address: document.supplierAddress || null,
          active: true,
          notes:
            "Creado automáticamente desde archivo Excel DTE del SII.",
          created_by: user.id,
        })
        .select("id,rut,legal_name")
        .single();

      if (error || !data) {
        const { data: refreshed, error: refreshError } =
          await admin
            .from("suppliers")
            .select("id,rut,legal_name")
            .is("deleted_at", null);

        if (refreshError) throw refreshError;

        const concurrent = (refreshed ?? []).find(
          (supplier) =>
            compactRut(String(supplier.rut)) === key,
        );

        if (!concurrent) throw error ??
          new Error("No fue posible crear el proveedor.");

        suppliersByRut.set(key, concurrent);
        return concurrent;
      }

      suppliersByRut.set(key, data);
      return data;
    }

    const readyInvoices = preview.filter(
      (item) =>
        item.kind === "invoice" && item.status === "ready",
    ) as unknown as ParsedDocument[];

    for (const document of readyInvoices) {
      try {
        const supplier = await resolveSupplier(document);

        const { data: existingByCode, error: codeError } =
          await admin
            .from("supplier_invoices")
            .select("id")
            .eq("supplier_id", supplier.id)
            .eq("dte_type_code", document.dteType)
            .eq("folio", document.folio)
            .neq("status", "void")
            .is("deleted_at", null)
            .limit(1)
            .maybeSingle();

        if (codeError) throw codeError;

        const { data: existingLegacy, error: legacyError } =
          existingByCode
            ? { data: null, error: null }
            : await admin
                .from("supplier_invoices")
                .select("id")
                .eq("supplier_id", supplier.id)
                .eq("document_type", document.documentType)
                .eq("folio", document.folio)
                .neq("status", "void")
                .is("deleted_at", null)
                .limit(1)
                .maybeSingle();

        if (legacyError) throw legacyError;

        const duplicate = existingByCode ?? existingLegacy;

        if (duplicate) {
          duplicates++;
          await registerRow(document, "duplicate", {
            invoiceId: duplicate.id,
          });
          continue;
        }

        const dueDate = dueDateFor(
          document.issueDate,
          dueDateStrategy,
        );

        const { data: invoice, error: invoiceError } =
          await admin
            .from("supplier_invoices")
            .insert({
              supplier_id: supplier.id,
              document_type: document.documentType,
              dte_type_code: document.dteType,
              folio: document.folio,
              issue_date: document.issueDate,
              received_date:
                new Date().toISOString().slice(0, 10),
              due_date: dueDate,
              net_amount: document.netAmount,
              exempt_amount: document.exemptAmount,
              tax_amount: document.taxAmount,
              other_taxes: document.otherTaxes,
              total_amount: document.totalAmount,
              currency: "CLP",
              accounting_month:
                `${document.issueDate.slice(0, 7)}-01`,
              description: document.description || null,
              status:
                dueDateStrategy === "pending_review"
                  ? "under_review"
                  : "received",
              reception_channel: "sii_xlsx",
              sii_receiver_rut: document.receiverRut,
              source_filename: filename || null,
              source_row_number: document.sourceRowNumber,
              internal_notes:
                dueDateStrategy === "pending_review"
                  ? "Importada desde SII sin fecha de vencimiento; pendiente de definición."
                  : "Importada directamente desde archivo Excel DTE del SII.",
              created_by: user.id,
            })
            .select("id")
            .single();

        if (invoiceError || !invoice) {
          throw invoiceError ??
            new Error("No fue posible crear la factura.");
        }

        importedInvoices++;
        await registerRow(document, "imported", {
          invoiceId: invoice.id,
        });
      } catch (cause) {
        rejected++;
        await registerRow(document, "rejected", {
          error:
            cause instanceof Error
              ? cause.message
              : "Factura inválida.",
        });
      }
    }

    const readyCredits = preview.filter(
      (item) =>
        item.kind === "credit" && item.status === "ready",
    ) as unknown as ParsedDocument[];

    for (const document of readyCredits) {
      try {
        const supplier = await resolveSupplier(document);

        const { data: existingCredit, error: duplicateError } =
          await admin
            .from("supplier_credit_notes")
            .select("id")
            .eq("supplier_id", supplier.id)
            .eq("dte_type_code", document.dteType)
            .eq("folio", document.folio)
            .neq("status", "void")
            .is("deleted_at", null)
            .limit(1)
            .maybeSingle();

        if (duplicateError) throw duplicateError;

        if (existingCredit) {
          duplicates++;
          await registerRow(document, "credit_duplicate", {
            creditNoteId: existingCredit.id,
          });
          continue;
        }

        const { data: credit, error: creditError } =
          await admin
            .from("supplier_credit_notes")
            .insert({
              supplier_id: supplier.id,
              document_type: document.documentType,
              dte_type_code: document.dteType,
              folio: document.folio,
              issue_date: document.issueDate,
              received_date:
                new Date().toISOString().slice(0, 10),
              net_amount: document.netAmount,
              exempt_amount: document.exemptAmount,
              tax_amount: document.taxAmount,
              other_taxes: document.otherTaxes,
              total_amount: document.totalAmount,
              currency: "CLP",
              description: document.description || null,
              reception_channel: "sii_xlsx",
              sii_receiver_rut: document.receiverRut,
              source_filename: filename || null,
              source_row_number: document.sourceRowNumber,
              internal_notes:
                "Importada desde SII y asignada automáticamente a la deuda abierta del proveedor.",
              created_by: user.id,
            })
            .select("id")
            .single();

        if (creditError || !credit) {
          throw creditError ??
            new Error("No fue posible crear la nota de crédito.");
        }

        const { data: creditSummary, error: summaryError } =
          await admin
            .from("supplier_credit_note_summary")
            .select("applied_amount")
            .eq("id", credit.id)
            .single();

        if (summaryError) throw summaryError;

        allocatedCreditAmount += Number(
          creditSummary.applied_amount ?? 0,
        );
        importedCredits++;

        await registerRow(document, "credit_imported", {
          creditNoteId: credit.id,
        });
      } catch (cause) {
        rejected++;
        await registerRow(document, "rejected", {
          error:
            cause instanceof Error
              ? cause.message
              : "Nota de crédito inválida.",
        });
      }
    }

    for (const item of preview.filter(
      (entry) => entry.status === "duplicate",
    )) {
      const document = item as unknown as ParsedDocument;
      duplicates++;

      await registerRow(
        document,
        document.kind === "credit"
          ? "credit_duplicate"
          : "duplicate",
      );
    }

    for (const item of preview.filter(
      (entry) => entry.status === "excluded",
    )) {
      const document = item as unknown as ParsedDocument;
      excluded++;
      await registerRow(document, "excluded", {
        error:
          "Documento informativo excluido de cuentas por pagar.",
      });
    }

    for (const item of preview.filter(
      (entry) => entry.status === "rejected",
    )) {
      const document = item as unknown as ParsedDocument;
      rejected++;
      await registerRow(document, "rejected", {
        error: String(item.message ?? "Documento rechazado."),
      });
    }

    const finalStatus =
      rejected > 0
        ? "completed_with_errors"
        : "completed";

    await admin
      .from("supplier_import_batches")
      .update({
        imported_rows:
          importedInvoices + importedCredits,
        rejected_rows: rejected,
        status: finalStatus,
        summary: {
          importedInvoices,
          importedCredits,
          allocatedCreditAmount,
          duplicates,
          excluded,
          rejected,
          grossInvoiceAmount: summary.invoiceAmount,
          creditAmount: summary.creditAmount,
          netDocumentPosition:
            summary.invoiceAmount - summary.creditAmount,
          dueDateStrategy,
        },
        completed_at: new Date().toISOString(),
      })
      .eq("id", batch.id);

    await audit(admin, user, "sii_xlsx_import", "finance", {
      record_type: "supplier_import_batches",
      record_id: batch.id,
      record_label: filename,
      importedInvoices,
      importedCredits,
      allocatedCreditAmount,
      duplicates,
      excluded,
      rejected,
    });

    return json(req, {
      success: true,
      mode,
      batchId: batch.id,
      importedInvoices,
      importedCredits,
      allocatedCreditAmount,
      duplicates,
      excluded,
      rejected,
      grossInvoiceAmount: summary.invoiceAmount,
      creditAmount: summary.creditAmount,
      netDocumentPosition:
        summary.invoiceAmount - summary.creditAmount,
    });
  } catch (cause) {
    return errorResponse(req, cause);
  }
});
