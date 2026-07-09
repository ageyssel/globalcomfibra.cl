import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { audit, errorResponse, handleOptions, HttpError, json, normalizeRut, requireIdentity, text } from "../_shared/platform.ts";

type ImportRow = Record<string, unknown>;

function numberValue(value: unknown) {
  if (typeof value === "number") return value;
  return Number(String(value ?? "").replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
}

function isoDate(value: unknown) {
  const raw = text(value, 30);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) return "";
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json(req, { error: "Método no permitido." }, 405);

  try {
    const { user, admin } = await requireIdentity(req, ["superadmin", "admin", "finance"]);
    const body = await req.json();
    const rows = Array.isArray(body.rows) ? body.rows as ImportRow[] : [];
    const filename = text(body.filename, 200);
    const createMissing = body.createMissingSuppliers === true;

    if (!rows.length || rows.length > 1000) {
      throw new HttpError(400, "La importación debe contener entre 1 y 1000 filas.");
    }

    const { data: batch, error: batchError } = await admin.from("supplier_import_batches").insert({
      source: text(body.source, 40) || "csv",
      original_filename: filename || null,
      total_rows: rows.length,
      created_by: user.id,
    }).select("id").single();

    if (batchError || !batch) throw batchError ?? new Error("No fue posible crear el lote.");

    let imported = 0;
    let duplicates = 0;
    let rejected = 0;
    const results: Array<Record<string, unknown>> = [];

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      let rowStatus = "rejected";
      let invoiceId: string | null = null;
      let errorMessage: string | null = null;

      try {
        const supplierRut = normalizeRut(row.rut_proveedor ?? row.rut ?? row.supplier_rut);
        const supplierName = text(row.proveedor ?? row.razon_social ?? row.supplier_name, 240);
        const documentType = text(row.tipo_documento ?? row.tipo ?? "Factura electrónica", 80);
        const folio = text(row.folio, 80);
        const issueDate = isoDate(row.fecha_emision ?? row.emision);
        const dueDate = isoDate(row.fecha_vencimiento ?? row.vencimiento) || issueDate;
        const net = numberValue(row.neto ?? row.monto_neto);
        const exempt = numberValue(row.exento ?? 0);
        const tax = numberValue(row.iva ?? row.impuesto ?? 0);
        const other = numberValue(row.otros_impuestos ?? 0);
        const total = numberValue(row.total ?? row.monto_total);
        const monthRaw = text(row.mes_contable ?? row.periodo ?? issueDate.slice(0, 7), 10);
        const accountingMonth = /^\d{4}-\d{2}$/.test(monthRaw) ? `${monthRaw}-01` : issueDate.slice(0, 7) + "-01";

        if (!supplierName || !folio || !issueDate || !Number.isFinite(total) || total <= 0) {
          throw new Error("Faltan proveedor, folio, fecha o total.");
        }

        const normalized = supplierRut.replace(/[^0-9K]/g, "");
        let { data: supplier } = await admin.from("suppliers")
          .select("id,legal_name,rut")
          .filter("rut", "neq", "")
          .then(({ data, error }) => {
            if (error) throw error;
            return { data: data?.find((item) => String(item.rut).toUpperCase().replace(/[^0-9K]/g, "") === normalized) };
          });

        if (!supplier && createMissing) {
          const { data: created, error: createError } = await admin.from("suppliers").insert({
            legal_name: supplierName,
            rut: supplierRut,
            active: true,
            created_by: user.id,
          }).select("id,legal_name,rut").single();
          if (createError) throw createError;
          supplier = created;
        }

        if (!supplier) throw new Error(`Proveedor ${supplierRut} no registrado.`);

        const { data: duplicate, error: duplicateError } = await admin.from("supplier_invoices")
          .select("id")
          .eq("supplier_id", supplier.id)
          .eq("document_type", documentType)
          .eq("folio", folio)
          .neq("status", "void")
          .maybeSingle();

        if (duplicateError) throw duplicateError;

        if (duplicate) {
          rowStatus = "duplicate";
          duplicates++;
          invoiceId = duplicate.id;
        } else {
          const calculated = net + exempt + tax + other;
          if (Math.abs(calculated - total) > 1) {
            throw new Error(`Los montos no cuadran: componentes ${calculated}, total ${total}.`);
          }

          const { data: invoice, error: insertError } = await admin.from("supplier_invoices").insert({
            supplier_id: supplier.id,
            document_type: documentType,
            folio,
            issue_date: issueDate,
            received_date: isoDate(row.fecha_recepcion) || new Date().toISOString().slice(0, 10),
            due_date: dueDate,
            net_amount: net,
            exempt_amount: exempt,
            tax_amount: tax,
            other_taxes: other,
            total_amount: total,
            currency: text(row.moneda, 10) || "CLP",
            accounting_month: accountingMonth,
            description: text(row.descripcion ?? row.glosa, 1000) || null,
            purchase_order: text(row.orden_compra, 120) || null,
            reception_channel: text(body.source, 40) || "csv",
            status: "received",
            created_by: user.id,
          }).select("id").single();

          if (insertError || !invoice) throw insertError ?? new Error("No fue posible crear la factura.");
          invoiceId = invoice.id;
          rowStatus = "imported";
          imported++;
        }
      } catch (cause) {
        rejected++;
        errorMessage = cause instanceof Error ? cause.message : "Fila inválida.";
      }

      await admin.from("supplier_import_rows").insert({
        batch_id: batch.id,
        row_number: index + 2,
        raw_data: row,
        status: rowStatus,
        supplier_invoice_id: invoiceId,
        error_message: errorMessage,
      });

      results.push({
        row: index + 2,
        status: rowStatus,
        invoiceId,
        error: errorMessage,
      });
    }

    const finalStatus = rejected ? "completed_with_errors" : "completed";
    await admin.from("supplier_import_batches").update({
      imported_rows: imported,
      rejected_rows: rejected,
      status: finalStatus,
      summary: { imported, duplicates, rejected },
      completed_at: new Date().toISOString(),
    }).eq("id", batch.id);

    await audit(admin, user, "bulk_import", "finance", {
      record_type: "supplier_import_batches",
      record_id: batch.id,
      record_label: filename,
      imported,
      duplicates,
      rejected,
    });

    return json(req, {
      success: true,
      batchId: batch.id,
      imported,
      duplicates,
      rejected,
      rows: results,
    });
  } catch (cause) {
    return errorResponse(req, cause);
  }
});
