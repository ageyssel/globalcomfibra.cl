import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

test("migración habilita RLS y buckets privados", async () => {
  const sql = await readFile(path.join(root, "supabase/migrations/20260708090000_platform_core_and_finance.sql"), "utf8");
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql, /supplier-invoices','supplier-invoices',false/);
  assert.match(sql, /REVOKE SELECT ON public\.clientes/);
  assert.match(sql, /column_name NOT IN \('pass_noc','user_noc'\)/);
});

test("funciones privilegiadas validan identidad", async () => {
  const functionsRoot = path.join(root, "supabase/functions");
  const names = (await readdir(functionsRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && entry.name !== "submit-lead").map((entry) => entry.name);
  for (const name of names) {
    const source = await readFile(path.join(functionsRoot, name, "index.ts"), "utf8");
    assert.match(source, /requireIdentity\(/, `${name} debe validar identidad`);
    assert.doesNotMatch(source, /Access-Control-Allow-Origin['"]?\s*:\s*['"]\*['"]/, `${name} no debe usar CORS abierto`);
  }
});
