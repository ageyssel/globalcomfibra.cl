export type ExcelCell =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined;

export type SiiDteDetail = {
  item: number | null;
  code: string;
  description: string;
  quantity: number | null;
  price: number | null;
  discountPercent: number | null;
  discountAmount: number | null;
  additionalTaxCode: string;
  itemAmount: number | null;
};

export type SiiDteDocument = {
  sourceRowNumber: number;
  dteType: number;
  folio: string;
  issueDate: string;
  dispatchType: string;
  paymentForm: string;
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
  details: SiiDteDetail[];
};

export type SiiDteParseResult = {
  documents: SiiDteDocument[];
  warnings: string[];
};

function stringValue(value: ExcelCell) {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "").trim();
}

function numberValue(value: ExcelCell) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(
    String(value ?? "")
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, ""),
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value: ExcelCell) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = numberValue(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateValue(value: ExcelCell) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(value));
    return epoch.toISOString().slice(0, 10);
  }

  const raw = stringValue(value);

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const local = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (!local) return "";

  return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
}

function normalizeHeader(value: ExcelCell) {
  return stringValue(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function rowIsEmpty(row: ExcelCell[]) {
  return row.every(
    (value) =>
      value === null ||
      value === undefined ||
      (typeof value === "string" && !value.trim()),
  );
}

function rowMap(headers: ExcelCell[], row: ExcelCell[]) {
  const mapped = new Map<string, ExcelCell>();

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (normalized && !mapped.has(normalized)) mapped.set(normalized, row[index]);
  });

  return mapped;
}

function mappedValue(
  mapped: Map<string, ExcelCell>,
  ...names: string[]
) {
  for (const name of names) {
    const value = mapped.get(normalizeHeader(name));
    if (value !== undefined) return value;
  }

  return null;
}

function joinAddress(...parts: string[]) {
  return parts.filter(Boolean).join(", ").replace(/\s+/g, " ").trim();
}

export function parseSiiDteRows(rows: ExcelCell[][]): SiiDteParseResult {
  const documents: SiiDteDocument[] = [];
  const warnings: string[] = [];

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index] ?? [];

    if (normalizeHeader(row[0]) !== "tipodte") continue;

    const dataRow = rows[index + 1] ?? [];

    if (rowIsEmpty(dataRow)) {
      warnings.push(
        `Encabezado DTE en la fila ${index + 1} sin fila de datos.`,
      );
      continue;
    }

    const header = rowMap(row, dataRow);
    const details: SiiDteDetail[] = [];

    let cursor = index + 2;

    if (normalizeHeader(rows[cursor]?.[0]) === "detalle") {
      const detailHeaders = rows[cursor] ?? [];
      cursor++;

      while (cursor < rows.length) {
        const detailRow = rows[cursor] ?? [];

        if (
          rowIsEmpty(detailRow) ||
          normalizeHeader(detailRow[0]) === "tipodte"
        ) {
          break;
        }

        const detail = rowMap(detailHeaders, detailRow);
        const description = stringValue(
          mappedValue(detail, "Descripcion"),
        );

        if (description || optionalNumber(mappedValue(detail, "Monto-Item"))) {
          details.push({
            item: optionalNumber(mappedValue(detail, "Item")),
            code: stringValue(
              mappedValue(detail, "Codigo", "Cod"),
            ),
            description,
            quantity: optionalNumber(
              mappedValue(detail, "Cantidad"),
            ),
            price: optionalNumber(mappedValue(detail, "Precio")),
            discountPercent: optionalNumber(
              mappedValue(detail, "Descuento %"),
            ),
            discountAmount: optionalNumber(
              mappedValue(detail, "Descuento $"),
            ),
            additionalTaxCode: stringValue(
              mappedValue(detail, "Cod.ImptoAdic"),
            ),
            itemAmount: optionalNumber(
              mappedValue(detail, "Monto-Item"),
            ),
          });
        }

        cursor++;
      }
    }

    const dteType = Math.trunc(
      numberValue(mappedValue(header, "TipoDTE")),
    );
    const folio = stringValue(mappedValue(header, "Folio"));
    const issueDate = dateValue(
      mappedValue(header, "FechaEmision"),
    );
    const supplierRut = stringValue(
      mappedValue(header, "RutEmisor"),
    );
    const supplierName = stringValue(
      mappedValue(header, "RazonSocialEmisor"),
    );
    const receiverRut = stringValue(
      mappedValue(header, "RutReceptor"),
    );
    const totalAmount = numberValue(
      mappedValue(header, "Total-MontoTotal"),
    );

    if (
      !dteType ||
      !folio ||
      !issueDate ||
      !supplierRut ||
      !supplierName ||
      totalAmount <= 0
    ) {
      warnings.push(
        `Documento incompleto en la fila ${index + 2}; se omitió de la importación.`,
      );
      index = Math.max(index, cursor - 1);
      continue;
    }

    const netAmount = numberValue(
      mappedValue(header, "Total-Neto"),
    );
    const exemptAmount = numberValue(
      mappedValue(header, "Total-Exento"),
    );
    const taxAmount = numberValue(
      mappedValue(header, "Total-IVA"),
    );
    const otherTaxes = Math.max(
      0,
      totalAmount - netAmount - exemptAmount - taxAmount,
    );

    documents.push({
      sourceRowNumber: index + 2,
      dteType,
      folio,
      issueDate,
      dispatchType: stringValue(
        mappedValue(header, "TipoDespacho"),
      ),
      paymentForm: stringValue(
        mappedValue(header, "FormaPago"),
      ),
      supplierRut,
      supplierName,
      supplierBusinessActivity: stringValue(
        mappedValue(header, "GiroEmisor"),
      ),
      supplierAddress: joinAddress(
        stringValue(mappedValue(header, "Direccion")),
      ),
      supplierCommune: stringValue(
        mappedValue(header, "Comuna"),
      ),
      supplierCity: stringValue(mappedValue(header, "Ciudad")),
      receiverRut,
      receiverName: stringValue(
        mappedValue(header, "RazonSocialReceptor"),
      ),
      netAmount,
      exemptAmount,
      taxAmount,
      otherTaxes,
      totalAmount,
      description: details
        .map((detail) => detail.description)
        .filter(Boolean)
        .join(" · ")
        .slice(0, 1000),
      details,
    });

    index = Math.max(index, cursor - 1);
  }

  if (!documents.length) {
    warnings.push(
      "No se encontraron bloques DTE reconocibles en la primera hoja.",
    );
  }

  return { documents, warnings };
}
