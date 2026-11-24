//ARXIU QUE PROVA EL HASH I LA VERIFICACIÓ DE CONTRASENYES

//=====================
//IMPORTEM
//=====================
import test from "node:test";
import assert from "node:assert/strict";

//=====================
//CONSTANT: SECRET DE PROVA
//=====================
//EL MÒDUL LLANÇA UN ERROR SI NO HI HA AUTH_SECRET: L'HEM DE DEFINIR ABANS D'IMPORTAR-LO
process.env.AUTH_SECRET = "test-secret";

//CARREGUEM EL MÒDUL DESPRÉS DE DEFINIR EL SECRET
const { hashPassword, verifyPassword } = await import("../src/authService.js");

//=====================
//PROVA: HASH I VERIFICACIÓ DE CONTRASENYES
//=====================
test("hashPassword i verifyPassword funcionen amb scrypt", function () {
  const stored = hashPassword("Prova1234");

  //EL HASH NO POT CONTENIR LA CONTRASENYA EN CLAR
  assert.equal(stored.includes("Prova1234"), false);

  //FORMAT: SALT DE 16 BYTES (32 HEX) I CLAU DE 64 BYTES (128 HEX)
  assert.match(stored, /^[0-9a-f]{32}:[0-9a-f]{128}$/);

  assert.equal(verifyPassword("Prova1234", stored), true);
  assert.equal(verifyPassword("altra", stored), false);
});
