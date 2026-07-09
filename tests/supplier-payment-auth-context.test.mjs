import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const register = readFileSync(
  "supabase/functions/register-supplier-payment-v2/index.ts",
  "utf8",
);

const reverse = readFileSync(
  "supabase/functions/reverse-supplier-payment/index.ts",
  "utf8",
);

test("registro de pago conserva el JWT del usuario al invocar el RPC", () => {
  assert.match(register, /authenticatedClient\(req\)/);
  assert.match(
    register,
    /auth\.rpc\("register_supplier_payment_v2"/,
  );
  assert.doesNotMatch(
    register,
    /admin\.rpc\("register_supplier_payment_v2"/,
  );
});

test("reversa de pago conserva el JWT del usuario al invocar el RPC", () => {
  assert.match(reverse, /authenticatedClient\(req\)/);
  assert.match(
    reverse,
    /auth\.rpc\("reverse_supplier_payment"/,
  );
  assert.doesNotMatch(
    reverse,
    /admin\.rpc\("reverse_supplier_payment"/,
  );
});

test("los errores SQL se muestran como errores funcionales y no 500 genérico", () => {
  assert.match(register, /new HttpError\(400, error\.message/);
  assert.match(reverse, /new HttpError\(400, error\.message/);
});
