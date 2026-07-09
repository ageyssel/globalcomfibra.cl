import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const report = readFileSync(
  "components/admin/financial-payment-reports.tsx",
  "utf8",
);
const clients = readFileSync(
  "components/admin/customer-billing-manager.tsx",
  "utf8",
);
const suppliers = readFileSync(
  "components/admin/supplier-accounts-manager.tsx",
  "utf8",
);

test("el exportador ofrece PDF y Excel", () => {
  assert.match(report, /Descargar PDF/);
  assert.match(report, /Descargar Excel/);
  assert.match(report, /import\("jspdf"\)/);
  assert.match(report, /import\("write-excel-file\/browser"\)/);
});

test("permite reporte general o individual", () => {
  assert.match(report, /<option value="Todos">Todos<\/option>/);
  assert.match(report, /entities\.map/);
  assert.match(report, /entityId === "Todos"/);
});

test("permite histórico completo o rango de fechas", () => {
  assert.match(report, /Histórico completo/);
  assert.match(report, /Rango de fechas/);
  assert.match(report, /Fecha de emisión/);
  assert.match(report, /Fecha de vencimiento/);
  assert.match(report, /Fecha de pago/);
});

test("reporte resume facturado créditos pagado y saldo", () => {
  assert.match(report, /Facturado/);
  assert.match(report, /Notas de crédito/);
  assert.match(report, /Pagado/);
  assert.match(report, /Saldo/);
});

test("facturación de clientes usa el exportador financiero", () => {
  assert.match(clients, /Estado de pagos de clientes/);
  assert.match(clients, /clientReportEntities/);
  assert.match(clients, /clientReportRows/);
  assert.doesNotMatch(clients, /function exportCsv/);
});

test("cuentas por pagar incluye facturas pagos y notas de crédito", () => {
  assert.match(suppliers, /Estado de pagos de proveedores/);
  assert.match(suppliers, /supplierPaymentByInvoice/);
  assert.match(suppliers, /supplier_credit_note_summary/);
  assert.match(suppliers, /creditNotes\.map/);
  assert.doesNotMatch(suppliers, /function exportStatement/);
});
