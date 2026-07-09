import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseSiiDteRows,
} from "../lib/sii-dte-excel.ts";

const rows = [
  [
    "TipoDTE",
    "Folio",
    "FechaEmision",
    "TipoDespacho",
    "FormaPago",
    "RutEmisor",
    "RazonSocialEmisor",
    "GiroEmisor",
    "Acteco",
    "CodSIISucursal",
    "Direccion",
    "Comuna",
    "Ciudad",
    "RutReceptor",
    "RazonSocialReceptor",
    "GiroReceptor",
    "Direccion",
    "Comuna",
    "Ciudad",
    "Total-Neto",
    "Total-Exento",
    "Total-IVA",
    "Total-MontoTotal",
  ],
  [
    33,
    3307,
    new Date("2026-05-01T12:00:00Z"),
    null,
    1,
    "76.958.131-6",
    "Proveedor de Prueba Ltda.",
    "Telecomunicaciones",
    null,
    null,
    "Dirección emisor 123",
    "Santiago",
    "Santiago",
    "77.812.215-4",
    "Servicio de Telecomunicaciones Globalcom Ltda.",
    "Telecomunicaciones",
    "Dirección receptor",
    "Providencia",
    "Santiago",
    321068,
    null,
    61003,
    382071,
  ],
  [
    "DETALLE",
    "Item",
    "Cod",
    "Codigo",
    "Descripcion",
    "Cantidad",
    "Precio",
    "Descuento %",
    "Descuento $",
    "Cod.ImptoAdic",
    "Monto-Item",
  ],
  [
    null,
    1,
    null,
    null,
    "Enlace Internet Dedicado",
    "1.00",
    "321068.00",
    null,
    null,
    null,
    321068,
  ],
  [],
  [
    "TipoDTE",
    "Folio",
    "FechaEmision",
    "TipoDespacho",
    "FormaPago",
    "RutEmisor",
    "RazonSocialEmisor",
    "GiroEmisor",
    "Acteco",
    "CodSIISucursal",
    "Direccion",
    "Comuna",
    "Ciudad",
    "RutReceptor",
    "RazonSocialReceptor",
    "GiroReceptor",
    "Direccion",
    "Comuna",
    "Ciudad",
    "Total-Neto",
    "Total-Exento",
    "Total-IVA",
    "Total-MontoTotal",
  ],
  [
    61,
    118,
    new Date("2026-05-04T12:00:00Z"),
    null,
    1,
    "76.958.131-6",
    "Proveedor de Prueba Ltda.",
    "Telecomunicaciones",
    null,
    null,
    "Dirección emisor 123",
    "Santiago",
    "Santiago",
    "77.812.215-4",
    "Servicio de Telecomunicaciones Globalcom Ltda.",
    "Telecomunicaciones",
    "Dirección receptor",
    "Providencia",
    "Santiago",
    321068,
    null,
    61003,
    382071,
  ],
  [
    "DETALLE",
    "Item",
    "Cod",
    "Codigo",
    "Descripcion",
    "Cantidad",
    "Precio",
    "Descuento %",
    "Descuento $",
    "Cod.ImptoAdic",
    "Monto-Item",
  ],
  [
    null,
    1,
    null,
    null,
    "Anulación de servicio",
    "1.00",
    "321068.00",
    null,
    null,
    null,
    321068,
  ],
  [],
  [
    "TipoDTE",
    "Folio",
    "FechaEmision",
    "TipoDespacho",
    "FormaPago",
    "RutEmisor",
    "RazonSocialEmisor",
    "GiroEmisor",
    "Acteco",
    "CodSIISucursal",
    "Direccion",
    "Comuna",
    "Ciudad",
    "RutReceptor",
    "RazonSocialReceptor",
    "GiroReceptor",
    "Direccion",
    "Comuna",
    "Ciudad",
    "Total-Neto",
    "Total-Exento",
    "Total-IVA",
    "Total-MontoTotal",
  ],
  [
    52,
    500,
    new Date("2026-05-06T12:00:00Z"),
    null,
    1,
    "96.806.110-0",
    "Proveedor Logístico SpA",
    "Logística",
    null,
    null,
    "Dirección 1",
    "Santiago",
    "Santiago",
    "77.812.215-4",
    "Servicio de Telecomunicaciones Globalcom Ltda.",
    "Telecomunicaciones",
    "Dirección receptor",
    "Providencia",
    "Santiago",
    100000,
    null,
    19000,
    119000,
  ],
];

test("parser reconoce factura, nota de crédito y guía", () => {
  const result = parseSiiDteRows(rows);
  assert.equal(result.documents.length, 3);
  assert.equal(result.documents[0].dteType, 33);
  assert.equal(result.documents[0].folio, "3307");
  assert.equal(result.documents[0].issueDate, "2026-05-01");
  assert.equal(result.documents[0].totalAmount, 382071);
  assert.equal(
    result.documents[0].description,
    "Enlace Internet Dedicado",
  );
  assert.equal(result.documents[1].dteType, 61);
  assert.equal(result.documents[1].folio, "118");
  assert.equal(result.documents[2].dteType, 52);
});

test("parser conserva el primer domicilio duplicado como emisor", () => {
  const result = parseSiiDteRows(rows);
  assert.equal(
    result.documents[0].supplierAddress,
    "Dirección emisor 123",
  );
  assert.equal(result.documents[0].supplierCommune, "Santiago");
});

test("migración descuenta créditos en el saldo de factura", () => {
  const migration = readFileSync(
    "supabase/migrations/20260709120000_sii_xlsx_credit_notes.sql",
    "utf8",
  );

  assert.match(migration, /supplier_credit_notes/);
  assert.match(migration, /supplier_credit_allocations/);
  assert.match(
    migration,
    /i\.total_amount[\s\S]*coalesce\(ca\.credited_amount,0\)/,
  );
  assert.match(
    migration,
    /auto_allocate_supplier_credit/,
  );
  assert.match(
    migration,
    /supplier_invoice_apply_available_credits/,
  );
});

test("función separa facturas, créditos y guías", () => {
  const source = readFileSync(
    "supabase/functions/import-sii-dte-excel/index.ts",
    "utf8",
  );

  assert.match(source, /const invoiceTypes = new Set/);
  assert.match(source, /const creditTypes = new Set/);
  assert.match(source, /const excludedTypes = new Set/);
  assert.match(source, /credit_imported/);
  assert.match(source, /pending_review/);
});

test("interfaz acepta xlsx y exige vista previa", () => {
  const source = readFileSync(
    "components/admin/supplier-sii-excel-importer.tsx",
    "utf8",
  );

  assert.match(source, /readSheet/);
  assert.match(source, /accept="\.xlsx/);
  assert.match(source, /mode: "preview"/);
  assert.match(source, /Confirmar facturas y créditos/);
  assert.match(source, /descontarán automáticamente/);
});

test("cuentas por pagar muestra créditos por factura", () => {
  const source = readFileSync(
    "components/admin/supplier-accounts-manager.tsx",
    "utf8",
  );

  assert.match(source, /credited_amount/);
  assert.match(source, /Notas de crédito/);
  assert.match(source, /SupplierSiiExcelImporter/);
  assert.doesNotMatch(source, /Archivo CSV\/TSV/);
});
