import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260709090000_finance_communications_v2.sql", "utf8");
const payment = readFileSync("supabase/functions/register-supplier-payment-v2/index.ts", "utf8");
const importer = readFileSync("supabase/functions/import-supplier-invoices/index.ts", "utf8");
const mailer = readFileSync("supabase/functions/send-globalcom-email/index.ts", "utf8");
const shell = readFileSync("components/admin/admin-shell.tsx", "utf8");

test("pagos tienen código, reversa y distribución múltiple", () => {
  assert.match(migration, /payment_code text/);
  assert.match(migration, /register_supplier_payment_v2/);
  assert.match(migration, /reverse_supplier_payment/);
  assert.match(migration, /jsonb_array_elements/);
});

test("importación masiva valida identidad y duplicados", () => {
  assert.match(importer, /requireIdentity\(req, \["superadmin", "admin", "finance"\]\)/);
  assert.match(importer, /duplicate/);
  assert.match(importer, /1000/);
});

test("correo corporativo usa bcc y auditoría", () => {
  assert.match(mailer, /bcc: \["contacto@globalcomfibra\.cl"\]/);
  assert.match(mailer, /audit\(admin, user, "send_email"/);
  assert.match(mailer, /requireIdentity/);
});

test("menú expone los tres módulos operacionales", () => {
  assert.match(shell, /\/admin\/facturacion-clientes/);
  assert.match(shell, /\/admin\/cuentas-por-pagar/);
  assert.match(shell, /\/admin\/comunicaciones/);
});

test("función de pagos exige identidad financiera", () => {
  assert.match(payment, /requireIdentity\(req, \["superadmin", "admin", "finance"\]\)/);
});

test("facturas nuevas conservan RUT, folio, vencimiento y huella", () => {
  const processor = readFileSync("supabase/functions/process-invoice/index.ts", "utf8");
  assert.match(processor, /cliente_rut: client\.rut/);
  assert.match(processor, /fecha_vencimiento: dueDate/);
  assert.match(processor, /source_hash: sourceHash/);
  assert.match(processor, /folio/);
});

test("carga de facturas incorpora lectura PDF real", () => {
  const manager = readFileSync("components/admin/customer-billing-manager.tsx", "utf8");
  assert.match(manager, /pdfjs-dist\/legacy\/build\/pdf\.mjs/);
  assert.match(manager, /getTextContent/);
  assert.match(manager, /Monto\\s\+Neto/i);
});

test("correo adjunta el PDF y filtra cuenta por RUT", () => {
  const mailer = readFileSync("supabase/functions/send-globalcom-email/index.ts", "utf8");
  assert.match(mailer, /attachments/);
  assert.match(mailer, /cliente_rut/);
  assert.match(mailer, /bytesToBase64/);
});
