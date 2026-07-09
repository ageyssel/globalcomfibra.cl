import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync(
  "components/admin/supplier-accounts-manager.tsx",
  "utf8",
);

test("cada factura pendiente tiene botón de pago rápido", () => {
  assert.match(component, /Marcar pagada/);
  assert.match(component, /invoice\.balance_due > 0/);
  assert.match(component, /markInvoicePaid\(invoice\)/);
});

test("el pago rápido usa el saldo posterior a notas de crédito", () => {
  assert.match(
    component,
    /const balance = Number\(invoice\.balance_due\)/,
  );
  assert.match(
    component,
    /amount: balance[\s\S]*invoiceId: invoice\.id[\s\S]*amount: balance/,
  );
});

test("el pago rápido registra historial y requiere confirmación", () => {
  assert.match(component, /register-supplier-payment-v2/);
  assert.match(component, /window\.confirm/);
  assert.match(component, /method: "Marcación rápida"/);
  assert.match(
    component,
    /Factura marcada como pagada mediante el botón rápido/,
  );
});

test("el estado compensado con nota de crédito tiene nombre visible", () => {
  assert.match(
    component,
    /credit_compensated: "Compensada con crédito"/,
  );
});
