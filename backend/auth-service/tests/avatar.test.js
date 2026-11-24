//ARXIU QUE PROVA LA VALIDACIÓ DE L'AVATAR

//=====================
//IMPORTEM
//=====================
import test from "node:test";
import assert from "node:assert/strict";
import { esAvatarValid } from "../src/avatar.js";

//=====================
//CASOS QUE HAN DE PASSAR
//=====================
test("accepta un enllaç https", () => {
  assert.equal(esAvatarValid("https://exemple.com/imatge.png"), true);
});

test("accepta un png en data uri", () => {
  assert.equal(esAvatarValid("data:image/png;base64,AAAA"), true);
});

//=====================
//CASOS QUE HAN DE FALLAR
//=====================
test("rebutja un svg, que pot portar script", () => {
  assert.equal(esAvatarValid("data:image/svg+xml;base64,AAAA"), false);
});

test("rebutja http, que és contingut no segur", () => {
  assert.equal(esAvatarValid("http://exemple.com/imatge.png"), false);
});

test("rebutja un text buit", () => {
  assert.equal(esAvatarValid(""), false);
});

test("rebutja un valor que no és text", () => {
  assert.equal(esAvatarValid(null), false);
});
