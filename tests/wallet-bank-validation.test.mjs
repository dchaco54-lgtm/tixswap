import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { loadModule } from "./helpers/module-loader.mjs";

test("acepta nombres habituales de Santander y conserva la validación bancaria", async () => {
  const { validateBankData } = await loadModule(path.join(process.cwd(), "lib/security/bankValidation.js"));
  const data = { account_type: "Cuenta Corriente", account_number: "12345678", transfer_email: "test@example.com", transfer_phone: "+56912345678" };
  for (const bank_name of ["Banco Santander", " Santander ", "Santander Chile"]) {
    const result = validateBankData({ ...data, bank_name });
    assert.equal(result.valid, true);
    assert.equal(result.normalized.bank_name, "Santander Chile");
  }
  assert.equal(validateBankData({ ...data, bank_name: "Banco desconocido" }).valid, false);
  assert.equal(validateBankData({ ...data, bank_name: "Santander", account_number: "abc" }).valid, false);
});
