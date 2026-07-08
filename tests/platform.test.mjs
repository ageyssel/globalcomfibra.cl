import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRut, safeText, formatDate } from "../lib/format.ts";
import { clientSchema, leadSchema } from "../lib/validation.ts";

test("normaliza RUT sin puntos ni guion", () => {
  assert.equal(normalizeRut("12.345.678-k"), "12345678K");
});

test("limpia texto no string", () => {
  assert.equal(safeText("  Fibra Global  "), "Fibra Global");
  assert.equal(safeText(null), "");
});

test("fecha inválida no rompe la interfaz", () => {
  assert.equal(formatDate("fecha-invalida"), "—");
});

test("cliente exige contraseña robusta", () => {
  const result = clientSchema.safeParse({ empresa: "Empresa SPA", rut: "12345678-9", email: "cliente@empresa.cl", password: "corta", dias_pago: 30 });
  assert.equal(result.success, false);
});

test("lead válido pasa el contrato", () => {
  const result = leadSchema.safeParse({ name: "Ana Pérez", company: "Empresa SPA", email: "ana@empresa.cl", phone: "+56912345678", commune: "Santiago", service: "Internet dedicado", website: "" });
  assert.equal(result.success, true);
});
